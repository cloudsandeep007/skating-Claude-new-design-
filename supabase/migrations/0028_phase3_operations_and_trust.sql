-- =============================================================================
-- 0028_phase3_operations_and_trust.sql
-- =============================================================================
-- Phase 3 of the payments & credits audit. Run once after 0027.
--
--   1. student_advances — a small ledger of money a family has paid ahead:
--      +deposit when a payment exceeds what's owed (with the admin's
--      explicit "keep the extra as an advance"), −applied when it covers a
--      later fee. record_payment() gains p_accept_advance; an applied
--      advance is a payment row with method 'advance' (covers the fee, but
--      is NOT new money — every "collected" figure excludes it).
--   2. Parents are told when a payment is recorded (receipt number, amount,
--      and for a top-up the classes and term) and when an advance is used.
--   3. reconciliation_report(from, to) — collected per day by method, voided
--      and advance-applied amounts, counts. The month-end screen.
--   4. student_activity(student, limit) — that skater's audit trail (fees,
--      payments, bookings, credits, the student row) with actor names.
--   5. run_auto_reminders() — nightly, only when the academy has turned on
--      auto_fee_reminders: due-soon, just-overdue and lapsing-term nudges,
--      each at most once a week per fee / skater.
-- =============================================================================


-- ## 1. Advances ---------------------------------------------------------------------

create table public.student_advances (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null,
  delta      numeric(10, 2) not null check (delta <> 0),
  kind       text not null check (kind in ('deposit', 'applied')),
  payment_id uuid references public.payments (id) on delete set null,
  fee_id     uuid references public.student_fees (id) on delete set null,
  reason     text,
  actor_id   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (student_id, academy_id) references public.students (id, academy_id) on delete cascade
);

create index student_advances_student_idx on public.student_advances (student_id, created_at desc);

alter table public.student_advances enable row level security;
create policy student_advances_super_all on public.student_advances for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy student_advances_admin_select on public.student_advances for select to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy student_advances_parent_select on public.student_advances for select to authenticated
  using (student_id = any ((select public.parent_student_ids())::uuid[]));

create or replace function public.student_advance_balance(p_student_id uuid)
returns numeric
language sql stable
as $$
  select coalesce(sum(delta), 0) from public.student_advances where student_id = p_student_id;
$$;

-- Parent notification helper shared by the functions below.
create or replace function public.notify_parents_of(
  p_student_id uuid,
  p_type       text,
  p_title      text,
  p_body       text,
  p_link       text
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_academy uuid;
  v_count   integer;
begin
  select academy_id into v_academy from public.students where id = p_student_id;
  insert into public.notifications (academy_id, profile_id, type, title, body, link)
  select v_academy, x.parent_profile_id, p_type, p_title, p_body, p_link
  from public.parents_students x
  where x.student_id = p_student_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cover an open fee from the skater's advance balance, as far as it goes.
create or replace function public.apply_student_advance(p_fee_id uuid)
returns numeric
language plpgsql security definer
set search_path = public
as $$
declare
  v_fee     public.student_fees%rowtype;
  v_owed    numeric;
  v_adv     numeric;
  v_use     numeric;
  v_payment public.payments%rowtype;
begin
  select * into v_fee from public.student_fees where id = p_fee_id;
  if not found or v_fee.status not in ('pending', 'overdue') then
    return 0;
  end if;
  v_owed := v_fee.amount - public.fee_paid_total(p_fee_id);
  v_adv  := public.student_advance_balance(v_fee.student_id);
  if v_owed <= 0 or v_adv <= 0 then
    return 0;
  end if;
  v_use := least(v_owed, v_adv);

  insert into public.payments
    (academy_id, student_fee_id, amount, paid_date, method, reference, recorded_by, notes)
  values
    (v_fee.academy_id, p_fee_id, v_use, public.academy_today(v_fee.academy_id), 'advance',
     'ADVANCE', null, 'Covered from advance balance')
  returning * into v_payment;

  insert into public.student_advances (academy_id, student_id, delta, kind, payment_id, fee_id, reason)
  values (v_fee.academy_id, v_fee.student_id, -v_use, 'applied', v_payment.id, p_fee_id,
          'Applied to ' || to_char(v_fee.period_start, 'DD Mon') || ' – ' || to_char(v_fee.period_end, 'DD Mon YYYY'));

  perform public.rederive_fee_status(p_fee_id);

  perform public.notify_parents_of(
    v_fee.student_id, 'advance_applied',
    '₹' || trim(to_char(v_use, 'FM99,99,99,990')) || ' advance applied',
    'Your advance balance covered ₹' || trim(to_char(v_use, 'FM99,99,99,990')) || ' of the '
      || to_char(v_fee.period_start, 'DD Mon') || ' – ' || to_char(v_fee.period_end, 'DD Mon') || ' fee'
      || case when v_owed - v_use > 0
           then '. ₹' || trim(to_char(v_owed - v_use, 'FM99,99,99,990')) || ' is still due.'
           else '. Nothing more to pay for it.' end,
    '/parent/fees'
  );

  return v_use;
end;
$$;

-- Apply a skater's advance to every open fee, oldest due first.
create or replace function public.apply_student_advances(p_student_id uuid)
returns numeric
language plpgsql security definer
set search_path = public
as $$
declare
  r       record;
  v_total numeric := 0;
begin
  for r in
    select id from public.student_fees
    where student_id = p_student_id and status in ('pending', 'overdue')
    order by due_date, period_start
  loop
    exit when public.student_advance_balance(p_student_id) <= 0;
    v_total := v_total + public.apply_student_advance(r.id);
  end loop;
  return v_total;
end;
$$;

-- Nightly sweep for every skater holding an advance.
create or replace function public.apply_all_advances()
returns numeric
language plpgsql security definer
set search_path = public
as $$
declare
  r       record;
  v_total numeric := 0;
begin
  for r in
    select student_id from public.student_advances
    group by student_id having sum(delta) > 0
  loop
    v_total := v_total + public.apply_student_advances(r.student_id);
  end loop;
  return v_total;
end;
$$;


-- ## 2. record_payment: advances + parent receipt --------------------------------------

drop function if exists public.record_payment(uuid, numeric, date, public.payment_method, text, text, uuid);

create or replace function public.record_payment(
  p_student_fee_id  uuid,
  p_amount          numeric,
  p_paid_date       date default null,
  p_method          public.payment_method default 'cash',
  p_reference       text default null,
  p_notes           text default null,
  p_idempotency_key uuid default null,
  p_accept_advance  boolean default false
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
  v_extra    numeric := 0;
  v_year     integer;
  v_no       integer;
  v_prefix   text;
  v_receipt  text;
  v_body     text;
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
  if p_method = 'advance' then
    raise exception 'An advance is applied automatically — record what the family actually paid';
  end if;

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
    if not p_accept_advance then
      raise exception 'That''s more than the ₹% still owed on this fee — tick "keep the extra as an advance" to accept it',
        trim(to_char(v_balance, 'FM99,99,99,990.00'));
    end if;
    v_extra := p_amount - v_balance;
  end if;

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
    select * into v_payment from public.payments
    where academy_id = v_fee.academy_id and idempotency_key = p_idempotency_key;
    if found then
      return v_payment;
    end if;
    raise;
  end;

  if v_extra > 0 then
    insert into public.student_advances (academy_id, student_id, delta, kind, payment_id, reason, actor_id)
    values (v_fee.academy_id, v_fee.student_id, v_extra, 'deposit', v_payment.id,
            'Paid ₹' || trim(to_char(p_amount, 'FM99,99,99,990')) || ' against ₹'
              || trim(to_char(v_balance, 'FM99,99,99,990')) || ' owed',
            auth.uid());
  end if;

  perform public.rederive_fee_status(p_student_fee_id);

  -- The receipt, to the family.
  v_body := 'Receipt ' || v_receipt || ' · ' || initcap(replace(p_method::text, '_', ' '));
  if v_fee.kind = 'topup' then
    v_body := v_body || ' · ' || coalesce(v_fee.credits_granted, 0) || ' class'
      || case when v_fee.credits_granted = 1 then '' else 'es' end
      || ' added, valid till ' || to_char(v_fee.period_end, 'DD Mon YYYY') || '.';
  else
    v_body := v_body || ' · ' || to_char(v_fee.period_start, 'DD Mon') || ' – '
      || to_char(v_fee.period_end, 'DD Mon YYYY') || ' fee'
      || case when v_balance - p_amount > 0
           then '. ₹' || trim(to_char(v_balance - p_amount, 'FM99,99,99,990')) || ' still due.'
           else '. Fully paid.' end;
  end if;
  if v_extra > 0 then
    v_body := v_body || ' ₹' || trim(to_char(v_extra, 'FM99,99,99,990'))
      || ' kept as an advance for the next fee.';
  end if;
  perform public.notify_parents_of(
    v_fee.student_id, 'payment_recorded',
    'Payment received — ₹' || trim(to_char(p_amount, 'FM99,99,99,990')),
    v_body, '/parent/fees'
  );

  -- Any other open fee this advance can already cover.
  if v_extra > 0 then
    perform public.apply_student_advances(v_fee.student_id);
  end if;

  return v_payment;
end;
$$;

-- Applied advances cover a fee but aren't new money.
create or replace view public.monthly_collection_totals
with (security_invoker = true) as
with collected as (
  select
    p.academy_id,
    date_trunc('month', p.paid_date)::date as month,
    sum(p.amount)                          as collected,
    count(*)                               as payment_count
  from public.payments p
  where p.voided_at is null and p.method <> 'advance'
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

-- New periods pick up any advance straight away.
create or replace function public.generate_upcoming_fees(p_academy_id uuid default null)
returns setof public.student_fees
language plpgsql
as $$
declare
  r record;
begin
  create temp table if not exists _new_fees (id uuid) on commit drop;
  delete from _new_fees;

  with eligible as (
    select
      s.id                                  as student_id,
      s.academy_id                          as academy_id,
      s.fee_plan_id                         as fee_plan_id,
      fp.amount                             as amount,
      fp.billing_cycle                      as billing_cycle,
      fp.batch_id                           as batch_id,
      (
        select max(sf.period_end)
        from public.student_fees sf
        where sf.student_id = s.id and sf.kind = 'period'
      )                                      as last_period_end,
      s.joined_date                         as joined_date,
      coalesce((a.settings->>'fee_generate_lead_days')::integer, 7) as lead_days,
      coalesce((a.settings->>'fee_grace_days')::integer, 5)         as grace_days
    from public.students s
    join public.fee_plans fp on fp.id = s.fee_plan_id and fp.academy_id = s.academy_id
    join public.academies a  on a.id = s.academy_id
    where s.status = 'active'
      and s.fee_plan_id is not null
      and fp.pricing_mode = 'cycle'
      and (p_academy_id is null or s.academy_id = p_academy_id)
  ),
  due as (
    select *, coalesce(last_period_end + 1, joined_date) as period_start
    from eligible
    where last_period_end is null or last_period_end < current_date + lead_days
  ),
  next_period as (
    select
      *,
      extract(day from period_start) <> 1 as is_stub,
      case
        when extract(day from period_start) = 1 then
          (period_start
             + case billing_cycle
                 when 'monthly'   then interval '1 month'
                 when 'quarterly' then interval '3 months'
                 else                  interval '1 year'
               end
             - interval '1 day')::date
        else
          (date_trunc('month', period_start) + interval '1 month' - interval '1 day')::date
      end as period_end
    from due
  ),
  priced as (
    select
      *,
      case
        when is_stub then
          round(
            amount
              / case billing_cycle when 'monthly' then 1 when 'quarterly' then 3 else 12 end
              * (period_end - period_start + 1)
              / extract(day from (date_trunc('month', period_start) + interval '1 month' - interval '1 day')),
            2
          )
        else amount
      end as fee_amount,
      case
        when batch_id is not null
          then public.expected_classes_from_schedule(batch_id, period_start, period_end)
        else null
      end as credits
    from next_period
  ),
  inserted as (
    insert into public.student_fees
      (academy_id, student_id, fee_plan_id, kind, period_start, period_end, amount, due_date, status, credits_granted)
    select
      academy_id, student_id, fee_plan_id, 'period', period_start, period_end, fee_amount,
      greatest(period_start, current_date) + grace_days,
      case when fee_amount = 0 then 'paid'::public.fee_status else 'pending'::public.fee_status end,
      credits
    from priced np
    where not exists (
      select 1 from public.student_fees sf2
      where sf2.student_id = np.student_id and sf2.kind = 'period' and sf2.period_start = np.period_start
    )
    returning id
  )
  insert into _new_fees select id from inserted;

  for r in select id from _new_fees loop
    perform public.apply_student_advance(r.id);
  end loop;

  return query select f.* from public.student_fees f where f.id in (select id from _new_fees);
end;
$$;


-- ## 3. Reconciliation --------------------------------------------------------------------

create or replace function public.reconciliation_report(p_from date, p_to date)
returns table (
  day             date,
  cash            numeric,
  upi             numeric,
  card            numeric,
  bank_transfer   numeric,
  cheque          numeric,
  other           numeric,
  collected       numeric,
  payment_count   bigint,
  voided_total    numeric,
  voided_count    bigint,
  advance_applied numeric,
  first_receipt   text,
  last_receipt    text
)
language sql stable
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  ),
  live as (
    select p.paid_date as day, p.method, p.amount, p.receipt_no
    from public.payments p
    where p.voided_at is null and p.paid_date between p_from and p_to
  )
  select
    d.day,
    coalesce(sum(l.amount) filter (where l.method = 'cash'), 0),
    coalesce(sum(l.amount) filter (where l.method = 'upi'), 0),
    coalesce(sum(l.amount) filter (where l.method = 'card'), 0),
    coalesce(sum(l.amount) filter (where l.method = 'bank_transfer'), 0),
    coalesce(sum(l.amount) filter (where l.method = 'cheque'), 0),
    coalesce(sum(l.amount) filter (where l.method = 'other'), 0),
    coalesce(sum(l.amount) filter (where l.method <> 'advance'), 0),
    count(l.amount) filter (where l.method <> 'advance'),
    coalesce((select sum(v.amount) from public.payments v
              where v.voided_at is not null and v.paid_date = d.day and v.method <> 'advance'), 0),
    (select count(*) from public.payments v
      where v.voided_at is not null and v.paid_date = d.day and v.method <> 'advance'),
    coalesce(sum(l.amount) filter (where l.method = 'advance'), 0),
    min(l.receipt_no) filter (where l.method <> 'advance'),
    max(l.receipt_no) filter (where l.method <> 'advance')
  from days d
  left join live l on l.day = d.day
  group by d.day
  having count(l.amount) > 0
      or exists (select 1 from public.payments v where v.voided_at is not null and v.paid_date = d.day)
  order by d.day;
$$;


-- ## 4. Activity trail --------------------------------------------------------------------

create or replace function public.student_activity(p_student_id uuid, p_limit integer default 100)
returns table (
  id          uuid,
  created_at  timestamptz,
  actor_name  text,
  action      text,
  entity_type text,
  entity_id   uuid,
  changes     jsonb
)
language plpgsql security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
begin
  select * into v_student from public.students where id = p_student_id;
  if not found then
    raise exception 'Skater not found';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_academy_admin() and v_student.academy_id = public.current_academy_id())
  ) then
    raise exception 'Only an admin of this academy can view activity';
  end if;

  return query
  select a.id, a.created_at, p.full_name, a.action, a.entity_type, a.entity_id, a.changes
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_profile_id
  where a.academy_id = v_student.academy_id
    and (
      (a.entity_type = 'students' and a.entity_id = p_student_id)
      or (a.entity_type = 'student_fees' and a.entity_id in
            (select f.id from public.student_fees f where f.student_id = p_student_id))
      or (a.entity_type = 'payments' and a.entity_id in
            (select pm.id from public.payments pm
             join public.student_fees f on f.id = pm.student_fee_id
             where f.student_id = p_student_id))
      or (a.entity_type = 'class_bookings' and a.entity_id in
            (select b.id from public.class_bookings b where b.student_id = p_student_id))
      or (a.entity_type = 'makeup_credits' and a.entity_id in
            (select m.id from public.makeup_credits m where m.student_id = p_student_id))
      or (a.entity_type = 'attendance' and a.entity_id in
            (select at.id from public.attendance at where at.student_id = p_student_id))
    )
  order by a.created_at desc
  limit p_limit;
end;
$$;


-- ## 5. Automatic reminders (opt-in per academy) ---------------------------------------------

create or replace function public.run_auto_reminders()
returns table (fee_reminders integer, renewal_reminders integer)
language plpgsql security definer
set search_path = public
as $$
declare
  v_fees     integer := 0;
  v_renewals integer := 0;
  r          record;
  v_today    date;
  v_before   integer;
  v_sent     integer;
begin
  for r in
    select a.id as academy_id,
           coalesce((a.settings->>'fee_reminder_days_before')::integer, 3) as days_before
    from public.academies a
    where coalesce((a.settings->>'auto_fee_reminders')::boolean, false)
  loop
    v_today := public.academy_today(r.academy_id);
    v_before := r.days_before;

    -- Fees due in `days_before` days, or that went overdue since the last
    -- run, not reminded in the past 7 days.
    with due_fees as (
      select f.id, f.student_id, f.status, f.due_date,
             f.amount - public.fee_paid_total(f.id) as balance
      from public.student_fees f
      where f.academy_id = r.academy_id
        and f.kind = 'period'
        and f.status in ('pending', 'overdue')
        and (f.due_date = v_today + v_before or f.due_date = v_today - 1)
        and (f.last_reminded_at is null or f.last_reminded_at < now() - interval '7 days')
        and f.amount - public.fee_paid_total(f.id) > 0
    ),
    sent as (
      insert into public.notifications (academy_id, profile_id, type, title, body, link)
      select r.academy_id, x.parent_profile_id, 'fee_due',
             'Fee reminder — ' || s.full_name,
             '₹' || trim(to_char(d.balance, 'FM99,99,99,999'))
               || case when d.due_date < v_today
                    then ' is overdue since ' else ' is due on ' end
               || to_char(d.due_date, 'DD Mon YYYY') || '.',
             '/parent/fees'
      from due_fees d
      join public.students s on s.id = d.student_id
      join public.parents_students x on x.student_id = d.student_id
      returning 1
    ),
    stamped as (
      update public.student_fees f set last_reminded_at = now()
      where f.id in (select id from due_fees)
      returning 1
    )
    select count(*) into v_sent from sent;
    v_fees := v_fees + v_sent;

    -- Plan terms ending within 7 days or lapsed, not reminded in the past 7 days.
    select coalesce(sum(public.send_renewal_reminders_for(r.academy_id, rd.student_id)), 0)
      into v_sent
    from public.renewals_due(7) rd
    join public.students st on st.id = rd.student_id and st.academy_id = r.academy_id
    where rd.last_reminded_at is null or rd.last_reminded_at < now() - interval '7 days';
    v_renewals := v_renewals + v_sent;
  end loop;

  return query select v_fees, v_renewals;
end;
$$;

-- send_renewal_reminders() checks the caller is an admin; the nightly job
-- runs as the service role, so this variant takes the academy explicitly.
create or replace function public.send_renewal_reminders_for(p_academy_id uuid, p_student_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  r      record;
  v_sent integer := 0;
begin
  select st.id, st.full_name, ps.*
    into r
  from public.students st
  cross join lateral public.credit_plan_status(st.id) ps
  where st.id = p_student_id and st.academy_id = p_academy_id and ps.uses_credits;
  if not found then
    return 0;
  end if;

  insert into public.notifications (academy_id, profile_id, type, title, body, link)
  select
    p_academy_id,
    x.parent_profile_id,
    'renewal_due',
    case when r.term_status = 'expired'
      then 'Plan ended — ' || r.full_name
      else 'Plan ending soon — ' || r.full_name end,
    case
      when r.term_status = 'expired' then
        r.full_name || '''s ' || r.billing_cycle || ' plan ended on ' || to_char(r.term_end, 'DD Mon') ||
        '. Top up at the academy to keep booking classes.'
      else
        r.full_name || '''s ' || r.billing_cycle || ' plan ends on ' || to_char(r.term_end, 'DD Mon') ||
        case when coalesce(r.available, 0) > 0
          then ' — top up before then to carry ' || r.available || ' unused class' ||
               case when r.available = 1 then '' else 'es' end || ' forward.'
          else ' — top up to keep booking classes.' end
    end,
    '/parent/fees'
  from public.parents_students x
  where x.student_id = p_student_id;
  get diagnostics v_sent = row_count;
  return v_sent;
end;
$$;
