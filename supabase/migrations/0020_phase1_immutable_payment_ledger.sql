-- =============================================================================
-- 0020_phase1_immutable_payment_ledger.sql
-- =============================================================================
-- Phase 1 of the payments & credits audit (2026-09-15): the payments table
-- becomes an append-only ledger and fee status becomes something the
-- database derives, not something anyone types. Run once after
-- 0019_phase0_billing_and_credit_integrity.sql.
--
--   1. payments gains voided_at / voided_by / void_reason (F-22),
--      idempotency_key (F-09) and receipt_no (F-21). A voided payment stays
--      on record, struck through; every sum in the app now excludes it.
--   2. fee_paid_total(fee) — the one place that sums a fee's live payments.
--      monthly_collection_totals, student_fees_list, fee_collection_report,
--      dashboard_stat_cards, send_fee_reminders and
--      recompute_open_fees_for_plan are re-pointed at it.
--   3. record_payment() — SECURITY DEFINER with an explicit admin check;
--      idempotent on (academy, idempotency_key); refuses a future date, an
--      already-paid fee, and any amount over the balance (F-18, F-20);
--      mints a per-academy, per-year receipt number (PRSA-2026-000001).
--   4. void_payment(payment, reason) replaces delete_payment(): marks the
--      row voided, re-derives the fee's status, and refuses if that would
--      strand credits the skater has already booked with.
--   5. waive_fee(fee, reason) — the waive action moves from a raw table
--      update into a function with its own guards (F-08).
--   6. A BEFORE UPDATE trigger on student_fees blocks any change to
--      status / amount / credits_granted / waived_reason that doesn't come
--      through one of the functions above (F-08) — the "status is derived,
--      never typed" invariant.
--   7. Admins lose direct UPDATE/DELETE on payments (RLS becomes
--      select-only); every write goes through record_payment/void_payment.
--   8. mark_fees_overdue() uses each academy's own timezone (F-20).
-- =============================================================================


-- ## 1. payments: ledger columns ------------------------------------------------

alter table public.payments
  add column voided_at       timestamptz,
  add column voided_by       uuid references public.profiles (id) on delete set null,
  add column void_reason     text,
  add column idempotency_key uuid,
  add column receipt_no      text;

alter table public.payments
  add constraint payments_void_needs_reason
  check (voided_at is null or (void_reason is not null and btrim(void_reason) <> ''));

create unique index payments_idempotency_idx
  on public.payments (academy_id, idempotency_key)
  where idempotency_key is not null;

create unique index payments_receipt_no_idx
  on public.payments (academy_id, receipt_no)
  where receipt_no is not null;

create index payments_fee_live_idx
  on public.payments (student_fee_id)
  where voided_at is null;

-- Per-academy, per-year receipt counter. Only ever touched inside
-- record_payment() (SECURITY DEFINER), so no policies are needed — RLS is
-- enabled purely so nothing else can read or write it directly.
create table public.receipt_counters (
  academy_id uuid    not null references public.academies (id) on delete cascade,
  year       integer not null,
  last_no    integer not null default 0,
  primary key (academy_id, year)
);
alter table public.receipt_counters enable row level security;


-- ## 2. Shared helpers ------------------------------------------------------------

-- Today's date in the academy's own timezone (settings->>'timezone',
-- default UTC) — the same rule session_is_editable() already uses.
create or replace function public.academy_today(p_academy_id uuid)
returns date
language sql stable
as $$
  select (now() at time zone coalesce(a.settings->>'timezone', 'UTC'))::date
  from public.academies a
  where a.id = p_academy_id;
$$;

-- The one definition of "how much has been paid on this fee": every
-- payment that hasn't been voided.
create or replace function public.fee_paid_total(p_fee_id uuid)
returns numeric
language sql stable
as $$
  select coalesce(sum(p.amount), 0)
  from public.payments p
  where p.student_fee_id = p_fee_id
    and p.voided_at is null;
$$;

-- Re-derive a fee's status from what's actually been paid. Never touches a
-- waived fee. Called by record_payment / void_payment; sets the write flag
-- the guard trigger (section 6) looks for.
create or replace function public.rederive_fee_status(p_fee_id uuid)
returns void
language plpgsql
as $$
declare
  v_fee public.student_fees%rowtype;
begin
  select * into v_fee from public.student_fees where id = p_fee_id;
  if not found or v_fee.status = 'waived' then
    return;
  end if;

  perform set_config('app.fee_write', 'on', true);
  update public.student_fees
     set status = case
       when public.fee_paid_total(p_fee_id) >= v_fee.amount then 'paid'::public.fee_status
       when v_fee.due_date < public.academy_today(v_fee.academy_id) then 'overdue'::public.fee_status
       else 'pending'::public.fee_status
     end
   where id = p_fee_id;
end;
$$;


-- ## 2b. Every existing sum now excludes voided payments ---------------------------

create or replace view public.monthly_collection_totals
with (security_invoker = true) as
with collected as (
  select
    p.academy_id,
    date_trunc('month', p.paid_date)::date as month,
    sum(p.amount)                          as collected,
    count(*)                               as payment_count
  from public.payments p
  where p.voided_at is null
  group by p.academy_id, date_trunc('month', p.paid_date)::date
),
fee_balance as (
  select
    f.academy_id,
    date_trunc('month', f.due_date)::date as month,
    f.amount,
    f.status,
    f.amount - public.fee_paid_total(f.id) as balance
  from public.student_fees f
),
expected as (
  select
    academy_id,
    month,
    sum(amount) filter (where status <> 'waived')                            as expected,
    sum(greatest(balance, 0)) filter (where status in ('pending', 'overdue')) as outstanding,
    count(*) filter (where status = 'overdue')                               as overdue_count,
    count(*) filter (where status = 'pending')                               as pending_count,
    count(*) filter (where status = 'paid')                                  as paid_count,
    count(*) filter (where status = 'waived')                                as waived_count
  from fee_balance
  group by academy_id, month
)
select
  academy_id,
  month,
  coalesce(c.collected, 0)      as collected,
  coalesce(c.payment_count, 0)  as payment_count,
  coalesce(e.expected, 0)       as expected,
  coalesce(e.outstanding, 0)    as outstanding,
  coalesce(e.overdue_count, 0)  as overdue_count,
  coalesce(e.pending_count, 0)  as pending_count,
  coalesce(e.paid_count, 0)     as paid_count,
  coalesce(e.waived_count, 0)   as waived_count
from collected c
full join expected e using (academy_id, month);

create or replace function public.student_fees_list(
  p_status   public.fee_status default null,
  p_month    date default null,
  p_batch_id uuid default null
)
returns table (
  student_fee_id   uuid,
  student_id       uuid,
  full_name        text,
  batch_names      text,
  fee_plan_name    text,
  period_start     date,
  period_end       date,
  due_date         date,
  amount           numeric,
  paid             numeric,
  balance          numeric,
  status           public.fee_status,
  last_reminded_at timestamptz
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
    public.fee_paid_total(f.id),
    f.amount - public.fee_paid_total(f.id),
    f.status,
    f.last_reminded_at
  from public.student_fees f
  join public.students s on s.id = f.student_id
  left join public.fee_plans fp on fp.id = f.fee_plan_id
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

create or replace function public.fee_collection_report(
  p_from     date,
  p_to       date,
  p_batch_id uuid default null
)
returns table (
  student_fee_id uuid,
  student_id     uuid,
  full_name      text,
  batch_names    text,
  fee_plan_name  text,
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
    f.due_date,
    f.amount,
    public.fee_paid_total(f.id),
    f.amount - public.fee_paid_total(f.id),
    f.status
  from public.student_fees f
  join public.students s on s.id = f.student_id
  left join public.fee_plans fp on fp.id = f.fee_plan_id
  where f.due_date between p_from and p_to
    and (
      p_batch_id is null or exists (
        select 1 from public.student_batches sb
        where sb.student_id = s.id and sb.batch_id = p_batch_id and sb.status = 'active'
      )
    )
  order by f.due_date desc, s.full_name;
$$;

create or replace function public.dashboard_stat_cards()
returns table (
  active_students            bigint,
  new_students_this_month    bigint,
  today_attendance_pct       numeric,
  last_month_attendance_pct  numeric,
  fees_collected_this_month  numeric,
  fees_collected_last_month  numeric,
  outstanding_total          numeric,
  outstanding_students       bigint,
  outstanding_due_this_month numeric,
  outstanding_due_last_month numeric
)
language sql stable
as $$
  with today_att as (
    select
      count(*) filter (where a.status in ('present', 'late'))            as attended,
      count(*) filter (where a.status in ('present', 'absent', 'late'))   as counted
    from public.schedule_sessions ss
    join public.attendance a on a.session_id = ss.id
    where ss.session_date = current_date
  ),
  last_month_att as (
    select
      count(*) filter (where a.status in ('present', 'late'))            as attended,
      count(*) filter (where a.status in ('present', 'absent', 'late'))   as counted
    from public.schedule_sessions ss
    join public.attendance a on a.session_id = ss.id
    where date_trunc('month', ss.session_date)
        = date_trunc('month', current_date) - interval '1 month'
  ),
  fees_this as (
    select collected, outstanding from public.monthly_collection_totals
    where academy_id = (select public.current_academy_id())
      and month = date_trunc('month', current_date)::date
  ),
  fees_last as (
    select collected, outstanding from public.monthly_collection_totals
    where academy_id = (select public.current_academy_id())
      and month = (date_trunc('month', current_date) - interval '1 month')::date
  ),
  outstanding_now as (
    select
      coalesce(sum(f.amount - public.fee_paid_total(f.id)), 0) as total,
      count(distinct f.student_id)                              as students
    from public.student_fees f
    where f.status in ('pending', 'overdue')
  )
  select
    (select count(*) from public.students where status = 'active'),
    (select count(*) from public.students
      where status = 'active' and joined_date >= date_trunc('month', current_date)),
    (select round(100.0 * attended / nullif(counted, 0), 1) from today_att),
    (select round(100.0 * attended / nullif(counted, 0), 1) from last_month_att),
    coalesce((select collected from fees_this), 0),
    coalesce((select collected from fees_last), 0),
    (select total from outstanding_now),
    (select students from outstanding_now),
    coalesce((select outstanding from fees_this), 0),
    coalesce((select outstanding from fees_last), 0);
$$;

create or replace function public.send_fee_reminders(p_student_fee_ids uuid[])
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_academy   uuid := public.current_academy_id();
  v_fee       record;
  v_sent      integer := 0;
  v_this_fee  integer;
begin
  if not public.is_academy_admin() or v_academy is null then
    raise exception 'Only an academy admin can send fee reminders';
  end if;

  for v_fee in
    select
      f.id, f.due_date, f.status,
      f.amount - public.fee_paid_total(f.id) as balance,
      s.id as student_id, s.full_name
    from public.student_fees f
    join public.students s on s.id = f.student_id
    where f.id = any(p_student_fee_ids)
      and f.academy_id = v_academy
      and f.status in ('pending', 'overdue')
  loop
    insert into public.notifications (academy_id, profile_id, type, title, body, link)
    select
      v_academy,
      ps.parent_profile_id,
      'fee_due',
      'Fee reminder — ' || v_fee.full_name,
      case
        when v_fee.status = 'overdue' then
          '₹' || trim(to_char(v_fee.balance, 'FM99,99,99,999')) || ' overdue since ' || to_char(v_fee.due_date, 'DD Mon YYYY') || '.'
        else
          '₹' || trim(to_char(v_fee.balance, 'FM99,99,99,999')) || ' due ' || to_char(v_fee.due_date, 'DD Mon YYYY') || '.'
      end,
      '/parent/fees'
    from public.parents_students ps
    where ps.student_id = v_fee.student_id;

    get diagnostics v_this_fee = row_count;
    v_sent := v_sent + v_this_fee;

    update public.student_fees set last_reminded_at = now() where id = v_fee.id;
  end loop;

  return v_sent;
end;
$$;

create or replace function public.recompute_open_fees_for_plan(p_fee_plan_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('app.fee_write', 'on', true);

  update public.student_fees sf
  set amount = case
        when fp.pricing_mode = 'per_class'
          then fp.per_class_rate * public.expected_classes_from_schedule(fp.batch_id, sf.period_start, sf.period_end)
        else fp.amount
      end,
      credits_granted = case
        when fp.batch_id is not null
          then public.expected_classes_from_schedule(fp.batch_id, sf.period_start, sf.period_end)
        else null
      end
  from public.fee_plans fp
  where sf.fee_plan_id = fp.id
    and fp.id = p_fee_plan_id
    and sf.status in ('pending', 'overdue');

  update public.student_fees sf
  set status = case
        when public.fee_paid_total(sf.id) >= sf.amount then 'paid'::public.fee_status
        when sf.due_date < public.academy_today(sf.academy_id) then 'overdue'::public.fee_status
        else 'pending'::public.fee_status
      end
  from public.fee_plans fp
  where sf.fee_plan_id = fp.id
    and fp.id = p_fee_plan_id
    and sf.status in ('pending', 'overdue');
end;
$$;


-- ## 3. record_payment ----------------------------------------------------------
-- SECURITY DEFINER now (admins no longer have INSERT on payments directly —
-- see section 7), so the academy check that RLS used to do is explicit.

drop function if exists public.record_payment(uuid, numeric, date, public.payment_method, text, text);

create or replace function public.record_payment(
  p_student_fee_id  uuid,
  p_amount          numeric,
  p_paid_date       date default null,
  p_method          public.payment_method default 'cash',
  p_reference       text default null,
  p_notes           text default null,
  p_idempotency_key uuid default null
)
returns public.payments
language plpgsql security definer
set search_path = public
as $$
declare
  v_fee      public.student_fees%rowtype;
  v_payment  public.payments%rowtype;
  v_today    date;
  v_date     date;
  v_balance  numeric;
  v_year     integer;
  v_no       integer;
  v_prefix   text;
  v_receipt  text;
begin
  select * into v_fee from public.student_fees where id = p_student_fee_id;
  if not found then
    raise exception 'Fee not found';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_academy_admin() and v_fee.academy_id = public.current_academy_id())
  ) then
    raise exception 'Only an admin of this academy can record a payment';
  end if;

  -- Idempotency: the same request replayed returns the payment it already
  -- created, instead of a second one.
  if p_idempotency_key is not null then
    select * into v_payment from public.payments
    where academy_id = v_fee.academy_id and idempotency_key = p_idempotency_key;
    if found then
      return v_payment;
    end if;
  end if;

  v_today := public.academy_today(v_fee.academy_id);
  v_date  := coalesce(p_paid_date, v_today);

  if v_fee.status = 'waived' then
    raise exception 'This fee was waived — nothing to collect';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;
  if v_date > v_today then
    raise exception 'Payment date can''t be in the future';
  end if;

  v_balance := v_fee.amount - public.fee_paid_total(p_student_fee_id);
  if v_balance <= 0 then
    raise exception 'This fee is already fully paid';
  end if;
  if p_amount > v_balance then
    raise exception 'That''s more than the ₹% still owed on this fee',
      trim(to_char(v_balance, 'FM99,99,99,990.00'));
  end if;

  -- Receipt number: <prefix>-<year>-<000001>, per academy, per year.
  select coalesce(
           nullif(btrim(a.settings->>'receipt_prefix'), ''),
           upper(left(regexp_replace(a.name, '[^A-Za-z0-9]', '', 'g'), 4)),
           'RCPT'
         )
    into v_prefix
  from public.academies a where a.id = v_fee.academy_id;
  v_year := extract(year from v_today)::integer;

  insert into public.receipt_counters (academy_id, year, last_no)
  values (v_fee.academy_id, v_year, 1)
  on conflict (academy_id, year) do update
    set last_no = receipt_counters.last_no + 1
  returning last_no into v_no;
  v_receipt := v_prefix || '-' || v_year || '-' || lpad(v_no::text, 6, '0');

  begin
    insert into public.payments
      (academy_id, student_fee_id, amount, paid_date, method, reference, recorded_by, notes,
       idempotency_key, receipt_no)
    values
      (v_fee.academy_id, p_student_fee_id, p_amount, v_date, p_method, p_reference, auth.uid(), p_notes,
       p_idempotency_key, v_receipt)
    returning * into v_payment;
  exception when unique_violation then
    -- Two identical requests raced; the other one won. Return its row.
    select * into v_payment from public.payments
    where academy_id = v_fee.academy_id and idempotency_key = p_idempotency_key;
    if found then
      return v_payment;
    end if;
    raise;
  end;

  perform public.rederive_fee_status(p_student_fee_id);

  return v_payment;
end;
$$;


-- ## 4. void_payment replaces delete_payment ----------------------------------------

drop function if exists public.delete_payment(uuid);

create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns public.payments
language plpgsql security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_fee     public.student_fees%rowtype;
  v_before  integer;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_academy_admin() and v_payment.academy_id = public.current_academy_id())
  ) then
    raise exception 'Only an admin of this academy can void a payment';
  end if;
  if v_payment.voided_at is not null then
    raise exception 'This payment was already voided';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to void a payment';
  end if;

  select * into v_fee from public.student_fees where id = v_payment.student_fee_id;
  v_before := public.class_credit_balance(v_fee.student_id);

  update public.payments
     set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   where id = p_payment_id
   returning * into v_payment;

  perform public.rederive_fee_status(v_fee.id);
  perform public.assert_credits_not_negative(v_fee.student_id, 'Voiding this payment', v_before);

  return v_payment;
end;
$$;

-- delete_student_fee: "has payments" now means any payment row at all —
-- voided ones are history too, and payments.student_fee_id is ON DELETE
-- RESTRICT regardless.
create or replace function public.delete_student_fee(p_fee_id uuid)
returns void
language plpgsql
as $$
declare
  v_fee      public.student_fees%rowtype;
  v_payments integer;
  v_before   integer;
begin
  select * into v_fee from public.student_fees where id = p_fee_id;
  if not found then
    raise exception 'Fee not found';
  end if;
  v_before := public.class_credit_balance(v_fee.student_id);

  select count(*) into v_payments from public.payments where student_fee_id = p_fee_id;
  if v_payments > 0 then
    raise exception 'This period has payment history (% payment%, including any voided) and can''t be deleted',
      v_payments, case when v_payments = 1 then '' else 's' end;
  end if;

  delete from public.student_fees where id = p_fee_id;

  perform public.assert_credits_not_negative(v_fee.student_id, 'Deleting this period', v_before);
end;
$$;


-- ## 5. waive_fee -----------------------------------------------------------------

create or replace function public.waive_fee(p_fee_id uuid, p_reason text)
returns public.student_fees
language plpgsql
as $$
declare
  v_fee public.student_fees%rowtype;
begin
  select * into v_fee from public.student_fees where id = p_fee_id;
  if not found then
    raise exception 'Fee not found';
  end if;
  if v_fee.status not in ('pending', 'overdue') then
    raise exception 'Only a pending or overdue fee can be waived';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to waive a fee';
  end if;

  perform set_config('app.fee_write', 'on', true);
  update public.student_fees
     set status = 'waived', waived_reason = btrim(p_reason)
   where id = p_fee_id
   returning * into v_fee;

  return v_fee;
end;
$$;


-- ## 6. Status is derived, never typed -----------------------------------------------

create or replace function public.guard_student_fee_changes()
returns trigger
language plpgsql
as $$
begin
  if (
       new.status          is distinct from old.status
    or new.amount          is distinct from old.amount
    or new.credits_granted is distinct from old.credits_granted
    or new.waived_reason   is distinct from old.waived_reason
  )
  and coalesce(current_setting('app.fee_write', true), '') <> 'on' then
    raise exception 'A fee''s status, amount and credits can only change by recording, voiding or waiving a payment, or through a plan/schedule update';
  end if;
  return new;
end;
$$;

create trigger student_fees_guard
  before update on public.student_fees
  for each row execute function public.guard_student_fee_changes();


-- ## 7. Admins can read payments; only the functions above can write them --------

drop policy if exists payments_admin_all on public.payments;

create policy payments_admin_select on public.payments for select to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));


-- ## 8. mark_fees_overdue in the academy's own timezone --------------------------------

create or replace function public.mark_fees_overdue()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  perform set_config('app.fee_write', 'on', true);

  with updated as (
    update public.student_fees f
       set status = 'overdue'
     where f.status = 'pending'
       and f.due_date < public.academy_today(f.academy_id)
    returning 1
  )
  select count(*)::integer into v_count from updated;

  return v_count;
end;
$$;
