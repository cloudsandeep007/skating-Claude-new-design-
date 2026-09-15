-- =============================================================================
-- 0019_phase0_billing_and_credit_integrity.sql
-- =============================================================================
-- Phase 0 of the payments & credits audit (2026-09-15) — the fixes that stop
-- money being lost or credits going negative. Each section names the audit
-- finding it closes. Run once after 0018_sync_open_fees_with_plan_and_schedule.sql.
--
--   1. generate_upcoming_fees()
--        F-01  next period is anchored on the student's latest period on ANY
--              plan (not just the current one), so switching or deleting a
--              plan no longer restarts at the join month and collides forever
--        F-04  a period that doesn't start on the 1st is a short "stub" to
--              the end of that month, priced pro-rata; every period after it
--              is a clean calendar month. Snaps FORWARD, never back, so an
--              existing anniversary-style period is never double-billed
--        F-03  the coming period is generated `fee_generate_lead_days` (7)
--              before the current one ends, and due_date is
--              greatest(period_start, today) + `fee_grace_days` (5) — a fee
--              is never overdue on the day it's created. Both are read from
--              academies.settings so an academy can tune them without a deploy
--   2. book_class_slot() / cancel_class_slot()
--        F-05  take the student explicitly instead of guessing with LIMIT 1 —
--              a parent with two children in one batch books for the child
--              whose page they're on
--        F-06  lock the student row for the duration of the booking so two
--              overlapping requests can't both pass the balance check
--   3. delete_payment() / delete_student_fee()
--        F-07  a period with payments recorded can't be deleted — the
--              payments have to go first, one by one, on purpose
--        F-02  (interim guard; the full clawback policy is Phase 2) either
--              deletion is refused if it would leave the skater with more
--              booked classes than credits, and says how many to cancel
-- =============================================================================


-- ## 1. generate_upcoming_fees ------------------------------------------------

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
      fp.pricing_mode                       as pricing_mode,
      fp.per_class_rate                     as per_class_rate,
      fp.batch_id                           as batch_id,
      -- F-01: every fee the student has ever had, on any plan (including a
      -- since-deleted one where fee_plan_id is now null).
      (
        select max(sf.period_end)
        from public.student_fees sf
        where sf.student_id = s.id
      )                                      as last_period_end,
      s.joined_date                         as joined_date,
      coalesce((a.settings->>'fee_generate_lead_days')::integer, 7) as lead_days,
      coalesce((a.settings->>'fee_grace_days')::integer, 5)         as grace_days
    from public.students s
    join public.fee_plans fp on fp.id = s.fee_plan_id and fp.academy_id = s.academy_id
    join public.academies a  on a.id = s.academy_id
    where s.status = 'active'
      and s.fee_plan_id is not null
      and (p_academy_id is null or s.academy_id = p_academy_id)
  ),
  due as (
    select
      *,
      -- F-04: the day after the last period, never earlier. First-ever period
      -- starts on the join date.
      coalesce(last_period_end + 1, joined_date) as period_start
    from eligible
    -- F-03: generate lead_days ahead so the bill exists before it's due.
    where last_period_end is null
       or last_period_end < current_date + lead_days
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
          -- stub: to the end of the month it starts in
          (date_trunc('month', period_start) + interval '1 month' - interval '1 day')::date
      end as period_end
    from due
  ),
  priced as (
    select
      *,
      case
        when pricing_mode = 'per_class' then
          -- already pro-rata: counts only the classes inside the period
          per_class_rate * public.expected_classes_from_schedule(batch_id, period_start, period_end)
        when is_stub then
          -- cycle plan, partial month: monthly-equivalent × days covered / days in month
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
  )
  insert into public.student_fees
    (academy_id, student_id, fee_plan_id, period_start, period_end, amount, due_date, status, credits_granted)
  select
    academy_id, student_id, fee_plan_id, period_start, period_end, fee_amount,
    -- F-03: never born overdue
    greatest(period_start, current_date) + grace_days,
    'pending',
    credits
  from priced np
  where not exists (
    select 1 from public.student_fees sf2
    where sf2.student_id = np.student_id and sf2.period_start = np.period_start
  )
  returning *;
end;
$$;


-- ## 2. book_class_slot / cancel_class_slot ------------------------------------
-- Signature changes (a second argument), so the old one-argument versions
-- are dropped rather than left as ambiguous overloads.

drop function if exists public.book_class_slot(uuid);
drop function if exists public.cancel_class_slot(uuid);

create or replace function public.book_class_slot(p_session_id uuid, p_student_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_booking public.class_bookings%rowtype;
begin
  -- F-05: the caller names the skater; we verify they're allowed to.
  if not (p_student_id = any (public.parent_student_ids())) then
    raise exception 'That skater is not linked to your account';
  end if;

  select * into v_session from public.schedule_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'This session is not open for booking';
  end if;
  if v_session.session_date < current_date then
    raise exception 'This session has already passed';
  end if;

  if not exists (
    select 1 from public.student_batches sb
    where sb.batch_id = v_session.batch_id
      and sb.student_id = p_student_id
      and sb.status = 'active'
  ) then
    raise exception 'This skater is not enrolled in this batch';
  end if;

  -- F-06: one booking at a time per skater. Two requests racing for the
  -- last credit queue here; the second re-reads the balance after the
  -- first commits and is refused.
  perform 1 from public.students where id = p_student_id for update;

  if coalesce(public.class_credit_balance(p_student_id), 0) <= 0 then
    if exists (
      select 1 from public.student_fees
      where student_id = p_student_id
        and credits_granted is not null
        and status in ('pending', 'overdue')
    ) then
      raise exception 'Pay this period''s fee to unlock class credits';
    else
      raise exception 'No class credits remaining';
    end if;
  end if;

  insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at)
  values (v_session.academy_id, p_student_id, p_session_id, 'booked', now(), null)
  on conflict (student_id, session_id) do update
    set status = 'booked', booked_at = now(), cancelled_at = null
    where class_bookings.status = 'cancelled'
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'This class is already booked';
  end if;

  return v_booking;
end;
$$;

create or replace function public.cancel_class_slot(p_session_id uuid, p_student_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_booking public.class_bookings%rowtype;
begin
  if not (p_student_id = any (public.parent_student_ids())) then
    raise exception 'That skater is not linked to your account';
  end if;

  select * into v_session from public.schedule_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'This class has already been marked — the credit is no longer refundable';
  end if;

  update public.class_bookings
     set status = 'cancelled', cancelled_at = now()
   where session_id = p_session_id
     and student_id = p_student_id
     and status = 'booked'
   returning * into v_booking;

  if not found then
    raise exception 'No active booking found for this class';
  end if;

  return v_booking;
end;
$$;


-- ## 3. Delete guards -----------------------------------------------------------

-- F-02 (interim): refuse a change that would take a skater's balance below
-- zero — or, if it's already below zero from before this guard existed,
-- any change that pushes it further down. A change that doesn't touch
-- credits (e.g. deleting an unpaid period) is always allowed, so legacy
-- negative balances can still be cleaned up. Raises with the exact number
-- of bookings to cancel.
drop function if exists public.assert_credits_not_negative(uuid, text);
create or replace function public.assert_credits_not_negative(
  p_student_id uuid,
  p_action     text,
  p_before     integer
)
returns void
language plpgsql
as $$
declare
  v_after integer;
  v_short integer;
begin
  v_after := public.class_credit_balance(p_student_id);
  if v_after is not null and v_after < 0 and v_after < coalesce(p_before, 0) then
    v_short := -v_after;
    raise exception '% would leave this skater % class% short of credits — cancel % upcoming booking% first',
      p_action,
      v_short, case when v_short = 1 then '' else 'es' end,
      v_short, case when v_short = 1 then '' else 's' end;
  end if;
end;
$$;

create or replace function public.delete_payment(p_payment_id uuid)
returns void
language plpgsql
as $$
declare
  v_fee_id    uuid;
  v_fee       public.student_fees%rowtype;
  v_remaining numeric;
  v_before    integer;
begin
  select student_fee_id into v_fee_id from public.payments where id = p_payment_id;
  if v_fee_id is null then
    raise exception 'Payment not found';
  end if;

  select * into v_fee from public.student_fees where id = v_fee_id;
  v_before := public.class_credit_balance(v_fee.student_id);

  delete from public.payments where id = p_payment_id;

  if v_fee.status = 'waived' then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_remaining
  from public.payments where student_fee_id = v_fee_id;

  -- Branches cast explicitly: a bare-literal CASE resolves to text, which
  -- Postgres won't assign to the enum (0016's version failed on every call).
  update public.student_fees
     set status = case
       when v_remaining >= v_fee.amount then 'paid'::public.fee_status
       when v_fee.due_date < current_date then 'overdue'::public.fee_status
       else 'pending'::public.fee_status
     end
   where id = v_fee_id;

  perform public.assert_credits_not_negative(v_fee.student_id, 'Deleting this payment', v_before);
end;
$$;

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

  -- F-07: money that was actually received is never wiped out as a side
  -- effect. Each payment has its own delete, with its own confirmation.
  select count(*) into v_payments from public.payments where student_fee_id = p_fee_id;
  if v_payments > 0 then
    raise exception 'This period has % payment% recorded — delete % first',
      v_payments,
      case when v_payments = 1 then '' else 's' end,
      case when v_payments = 1 then 'it' else 'them' end;
  end if;

  delete from public.student_fees where id = p_fee_id;

  perform public.assert_credits_not_negative(v_fee.student_id, 'Deleting this period', v_before);
end;
$$;
