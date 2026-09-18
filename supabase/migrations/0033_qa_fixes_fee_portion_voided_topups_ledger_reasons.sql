-- =============================================================================
-- 0033_qa_fixes_fee_portion_voided_topups_ledger_reasons.sql
-- =============================================================================
-- Fixes from the 18 Sep QA cycle (qa/QA_EXECUTION_REPORT.md):
--
--   BUG-010  A payment that carried an advance (₹740 paid against ₹240 owed,
--            ₹500 kept ahead) counted its full amount toward the fee, so the
--            Fees dashboard read "Balance ₹-500". fee_paid_total() now counts
--            only the portion that went to the fee (amount minus the deposit
--            taken out of that payment).
--   BUG-011  A voided top-up (amount 0, classes 0) is a record, not a fee:
--            it no longer appears in the Fees dashboard list or the fee
--            collection report. It stays on the skater's Fees tab, labelled.
--   BUG-012  Advances sat unapplied until the nightly job. generate_upcoming_
--            fees() now applies advances at the end of every run (so "Generate
--            now" applies them), and apply_student_advances() is exposed for
--            the "Apply now" button on the skater's Fees tab.
--   BUG-016  Credit-statement lines for attendance read "Booking cancelled"
--            / "Attended without booking". The attendance trigger now names
--            the reason it wants ("Marked absent" / "Marked present") through
--            a transaction-local setting the ledger sync reads.
-- =============================================================================


-- ## 1. BUG-010: only the fee's share of a payment counts toward the fee ------------

-- What part of a payment went to the fee it was recorded against — the
-- amount minus anything deposited as an advance out of that same payment.
create or replace function public.payment_fee_portion(p_payment_id uuid)
returns numeric
language sql stable
as $$
  select p.amount
       - coalesce((select sum(a.delta) from public.student_advances a
                   where a.payment_id = p.id and a.kind = 'deposit'), 0)
  from public.payments p
  where p.id = p_payment_id;
$$;

create or replace function public.fee_paid_total(p_fee_id uuid)
returns numeric
language sql stable
as $$
  select coalesce(sum(public.payment_fee_portion(p.id)), 0)
  from public.payments p
  where p.student_fee_id = p_fee_id
    and p.voided_at is null;
$$;

-- Any fee whose status was derived from the old total is re-derived now.
-- (rederive_fee_status is idempotent and sets the guard flag itself.)
do $$
declare r record;
begin
  for r in
    select distinct p.student_fee_id
    from public.payments p
    join public.student_advances a on a.payment_id = p.id and a.kind = 'deposit'
  loop
    perform public.rederive_fee_status(r.student_fee_id);
  end loop;
end $$;


-- ## 2. BUG-011: voided top-ups are not fees ---------------------------------------------

drop function if exists public.student_fees_list(public.fee_status, date, uuid);
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
  kind             public.fee_kind,
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
    f.kind,
    f.period_start,
    f.period_end,
    f.due_date,
    f.amount,
    public.fee_paid_total(f.id),
    greatest(f.amount - public.fee_paid_total(f.id), 0),
    f.status,
    f.last_reminded_at
  from public.student_fees f
  join public.students s on s.id = f.student_id
  left join public.fee_plans fp on fp.id = f.fee_plan_id
  where not (f.kind = 'topup' and f.amount = 0)          -- BUG-011
    and (p_status is null or f.status = p_status)
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
    greatest(f.amount - public.fee_paid_total(f.id), 0),
    f.status
  from public.student_fees f
  join public.students s on s.id = f.student_id
  left join public.fee_plans fp on fp.id = f.fee_plan_id
  where not (f.kind = 'topup' and f.amount = 0)          -- BUG-011
    and f.due_date between p_from and p_to
    and (
      p_batch_id is null or exists (
        select 1 from public.student_batches sb
        where sb.student_id = s.id and sb.batch_id = p_batch_id and sb.status = 'active'
      )
    )
  order by f.due_date desc, s.full_name;
$$;

grant execute on function public.student_fees_list(public.fee_status, date, uuid) to authenticated;
grant execute on function public.payment_fee_portion(uuid) to authenticated;


-- ## 3. BUG-012: advances are applied whenever fees are generated ---------------------------
-- generate_upcoming_fees() (0030) is wrapped rather than rewritten: the
-- original body stays as-is under a new name, and the public name runs it
-- then sweeps advances for the same academy.

alter function public.generate_upcoming_fees(uuid) rename to generate_upcoming_fees_core;

create or replace function public.generate_upcoming_fees(p_academy_id uuid default null)
returns setof public.student_fees
language plpgsql
as $$
begin
  return query select * from public.generate_upcoming_fees_core(p_academy_id);
  -- Anything a family has paid ahead goes onto what is open now.
  perform public.apply_all_advances();
end;
$$;

grant execute on function public.generate_upcoming_fees(uuid) to authenticated;
grant execute on function public.apply_student_advances(uuid) to authenticated;


-- ## 4. BUG-016: attendance names its own ledger reasons -----------------------------------

create or replace function public.ledger_sync_booking(p_booking_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_b      public.class_bookings%rowtype;
  v_net    integer;
  v_reason text := nullif(current_setting('app.ledger_reason', true), '');
begin
  select * into v_b from public.class_bookings where id = p_booking_id;
  if not found then
    return;
  end if;

  select coalesce(sum(delta), 0) into v_net
  from public.credit_ledger
  where booking_id = p_booking_id and kind in ('spend', 'refund');

  if v_b.status in ('booked', 'pending') and v_net = 0 then
    insert into public.credit_ledger (academy_id, student_id, delta, kind, booking_id, reason, actor_id)
    values (v_b.academy_id, v_b.student_id, -1, 'spend', p_booking_id,
            coalesce(v_reason,
              case
                when v_b.source = 'attendance' then 'Attended without booking'
                when v_b.status = 'pending'    then 'Class requested'
                else 'Class booked'
              end),
            auth.uid());
  elsif v_b.status in ('cancelled', 'rejected') and v_net < 0 then
    insert into public.credit_ledger (academy_id, student_id, delta, kind, booking_id, reason, actor_id)
    values (v_b.academy_id, v_b.student_id, 1, 'refund', p_booking_id,
            coalesce(v_reason,
              case when v_b.status = 'rejected' then 'Request declined' else 'Booking cancelled' end),
            auth.uid());
  end if;
end;
$$;

create or replace function public.attendance_credit_truth()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_had_booking boolean;
begin
  if not public.student_uses_credits(new.student_id) then
    return null;
  end if;

  select exists (
    select 1 from public.class_bookings
    where student_id = new.student_id and session_id = new.session_id
      and status in ('booked', 'pending')
  ) into v_had_booking;

  if new.status in ('present', 'late') then
    perform set_config('app.ledger_reason',
      case when v_had_booking then 'Marked present' else 'Attended without booking' end, true);
    insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at, source)
    values (new.academy_id, new.student_id, new.session_id, 'booked', now(), null, 'attendance')
    on conflict (student_id, session_id) do update
      set status = 'booked', cancelled_at = null,
          source = case when class_bookings.status = 'pending' then class_bookings.source else 'attendance' end,
          decided_by = coalesce(class_bookings.decided_by, auth.uid()),
          decided_at = coalesce(class_bookings.decided_at, now())
      where class_bookings.status in ('cancelled', 'pending', 'rejected');
  else
    perform set_config('app.ledger_reason', 'Marked absent — class returned', true);
    update public.class_bookings
       set status = 'cancelled', cancelled_at = now()
     where student_id = new.student_id
       and session_id = new.session_id
       and status in ('booked', 'pending');
  end if;
  perform set_config('app.ledger_reason', '', true);
  return null;
end;
$$;

-- Sessions completing without a mark: say so.
create or replace function public.resolve_session_bookings(p_session_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform set_config('app.ledger_reason', 'Not marked — class returned', true);
  with released as (
    update public.class_bookings b
       set status = 'cancelled', cancelled_at = now()
     where b.session_id = p_session_id
       and b.status in ('booked', 'pending')
       and not exists (
         select 1 from public.attendance a
         where a.session_id = b.session_id and a.student_id = b.student_id
       )
    returning 1
  )
  select count(*)::integer into v_count from released;
  perform set_config('app.ledger_reason', '', true);
  return v_count;
end;
$$;
