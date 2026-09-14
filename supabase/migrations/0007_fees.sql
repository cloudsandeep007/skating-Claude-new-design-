-- =============================================================================
-- 0007_fees.sql — fee management: plan assignment, generation, payments, waivers
-- =============================================================================
-- fee_plans / student_fees / payments (and their RLS) already exist from
-- 0001_initial_schema.sql — admin has full CRUD, parents read their own
-- children's rows. This migration adds:
--   1. students.fee_plan_id — the plan a student is currently billed on
--   2. student_fees.waived_reason — so waiving a fee (with a reason) is a
--      plain update the existing audit_student_fees trigger already logs
--   3. generate_upcoming_fees(academy?) — one row per student whose current
--      period has ended (or who has none yet); callable by an admin for
--      their own academy (RLS-scoped) or by the service role for everyone
--      (the scheduled Edge Function)
--   4. mark_fees_overdue() — flips pending -> overdue past the due date
--   5. record_payment(...) — insert a payment, flip the fee to paid once
--      fully covered; supports partial payments by simply not flipping yet
--   6. student_fees_list(status?, month?, batch?) — the admin fee list,
--      with paid-so-far/balance computed so partial payments show correctly
-- =============================================================================


-- ## 1. Fee plan assignment ----------------------------------------------------

alter table public.students
  add column fee_plan_id uuid;

alter table public.students
  add constraint students_fee_plan_id_fkey
  foreign key (fee_plan_id, academy_id) references public.fee_plans (id, academy_id)
  on delete set null (fee_plan_id);

create index students_fee_plan_idx on public.students (fee_plan_id);


-- ## 2. Waive reason ------------------------------------------------------------
-- No new policy or RPC needed to waive: an admin update of
-- {status: 'waived', waived_reason: '...'} is already covered by
-- student_fees_admin_all, and audit_student_fees logs the before/after of
-- every changed column — reason included — automatically.

alter table public.student_fees
  add column waived_reason text;

-- A fee period can start on the same day at most once per student, across
-- any fee plan — belt-and-braces against a race between two generation runs.
alter table public.student_fees
  add constraint student_fees_no_dup_period unique (student_id, period_start);


-- ## 3. generate_upcoming_fees --------------------------------------------------
-- SECURITY INVOKER: every insert is subject to student_fees_admin_all, so an
-- admin calling this with their own academy_id only ever creates rows in
-- their own academy (RLS silently drops anything else); the scheduled Edge
-- Function calls it with the service role, which bypasses RLS, to cover
-- every academy in one run (p_academy_id left null).
--
-- One row is generated per eligible student only once their current period
-- has ended (or they have none yet) — never further ahead than "the coming
-- period", and never a duplicate (the unique constraint above is the
-- backstop; the NOT EXISTS below avoids relying on it raising an error).

create or replace function public.generate_upcoming_fees(p_academy_id uuid default null)
returns setof public.student_fees
language plpgsql
as $$
begin
  return query
  with eligible as (
    select
      s.id                                  as student_id,
      s.academy_id                          as academy_id,
      s.fee_plan_id                         as fee_plan_id,
      fp.amount                             as amount,
      fp.billing_cycle                      as billing_cycle,
      (
        select max(sf.period_end)
        from public.student_fees sf
        where sf.student_id = s.id and sf.fee_plan_id = s.fee_plan_id
      )                                      as last_period_end,
      s.joined_date                         as joined_date
    from public.students s
    join public.fee_plans fp on fp.id = s.fee_plan_id and fp.academy_id = s.academy_id
    where s.status = 'active'
      and s.fee_plan_id is not null
      and (p_academy_id is null or s.academy_id = p_academy_id)
  ),
  due as (
    select
      student_id, academy_id, fee_plan_id, amount, billing_cycle,
      coalesce(last_period_end, joined_date - 1) + 1 as period_start
    from eligible
    where last_period_end is null or last_period_end < current_date
  ),
  next_period as (
    select
      student_id, academy_id, fee_plan_id, amount, period_start,
      (case billing_cycle
         when 'monthly'   then period_start + interval '1 month'
         when 'quarterly' then period_start + interval '3 months'
         when 'annual'    then period_start + interval '1 year'
       end - interval '1 day')::date          as period_end
    from due
  )
  insert into public.student_fees
    (academy_id, student_id, fee_plan_id, period_start, period_end, amount, due_date, status)
  select
    academy_id, student_id, fee_plan_id, period_start, period_end, amount, period_start, 'pending'
  from next_period np
  where not exists (
    select 1 from public.student_fees sf2
    where sf2.student_id = np.student_id and sf2.period_start = np.period_start
  )
  returning *;
end;
$$;


-- ## 4. mark_fees_overdue --------------------------------------------------------
-- SECURITY INVOKER — same reasoning: admin's own academy under RLS, or every
-- academy when called with the service role (the scheduled function).

create or replace function public.mark_fees_overdue()
returns integer
language sql
as $$
  with updated as (
    update public.student_fees
    set status = 'overdue'
    where status = 'pending' and due_date < current_date
    returning 1
  )
  select count(*)::integer from updated;
$$;


-- ## 5. record_payment ------------------------------------------------------------
-- SECURITY INVOKER — the insert and the possible status flip are each
-- subject to payments_admin_all / student_fees_admin_all, so only an admin
-- in the fee's own academy can call this successfully. Bundles "add a
-- payment" and "flip to paid once fully covered" into one round trip, the
-- same way save_attendance bundles marks + session completion.

create or replace function public.record_payment(
  p_student_fee_id uuid,
  p_amount         numeric,
  p_paid_date      date default current_date,
  p_method         public.payment_method default 'cash',
  p_reference      text default null,
  p_notes          text default null
)
returns public.payments
language plpgsql
as $$
declare
  v_fee        public.student_fees%rowtype;
  v_payment    public.payments%rowtype;
  v_total_paid numeric;
begin
  select * into v_fee from public.student_fees where id = p_student_fee_id;
  if not found then
    raise exception 'Fee not found';
  end if;
  if v_fee.status = 'waived' then
    raise exception 'This fee was waived — nothing to collect';
  end if;
  if p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  insert into public.payments
    (academy_id, student_fee_id, amount, paid_date, method, reference, recorded_by, notes)
  values
    (v_fee.academy_id, p_student_fee_id, p_amount, p_paid_date, p_method, p_reference, auth.uid(), p_notes)
  returning * into v_payment;

  select coalesce(sum(amount), 0) into v_total_paid
  from public.payments where student_fee_id = p_student_fee_id;

  if v_total_paid >= v_fee.amount then
    update public.student_fees set status = 'paid' where id = p_student_fee_id;
  end if;

  return v_payment;
end;
$$;


-- ## 6. student_fees_list -----------------------------------------------------
-- SECURITY INVOKER, scoped by student_fees_admin_all — the admin fee list
-- with filters and the paid/balance amounts pre-computed so a partially
-- paid fee renders correctly without N extra queries.

create or replace function public.student_fees_list(
  p_status   public.fee_status default null,
  p_month    date default null,
  p_batch_id uuid default null
)
returns table (
  student_fee_id uuid,
  student_id     uuid,
  full_name      text,
  batch_names    text,
  fee_plan_name  text,
  period_start   date,
  period_end     date,
  due_date       date,
  amount         numeric,
  paid           numeric,
  balance        numeric,
  status         public.fee_status
)
language sql stable
as $$
  select
    f.id,
    s.id,
    s.full_name,
    (
      select string_agg(b.name, ', ' order by b.name)
      from public.student_batches sb
      join public.batches b on b.id = sb.batch_id
      where sb.student_id = s.id and sb.status = 'active'
    ),
    fp.name,
    f.period_start,
    f.period_end,
    f.due_date,
    f.amount,
    coalesce(pay.paid, 0),
    f.amount - coalesce(pay.paid, 0),
    f.status
  from public.student_fees f
  join public.students s on s.id = f.student_id
  left join public.fee_plans fp on fp.id = f.fee_plan_id
  left join lateral (
    select sum(p.amount) as paid from public.payments p where p.student_fee_id = f.id
  ) pay on true
  where (p_status is null or f.status = p_status)
    and (p_month is null or date_trunc('month', f.due_date) = date_trunc('month', p_month))
    and (
      p_batch_id is null or exists (
        select 1 from public.student_batches sb
        where sb.student_id = s.id and sb.batch_id = p_batch_id and sb.status = 'active'
      )
    )
  order by f.due_date desc, s.full_name;
$$;
