-- =============================================================================
-- 0024_phase2_clawback_and_booking_guards.sql
-- =============================================================================
-- Remaining items of audit Phase 2 (the ledger, expiry and attendance rules
-- landed in 0021–0023). Run once after 0023.
--
--   1. Clawback policy (F-02, full). When a grant is reversed — a payment
--      voided, a waived period deleted — and the skater has already booked
--      with those credits, the admin sees exactly which upcoming classes
--      would be cancelled and confirms. The newest future bookings are
--      cancelled (refunds in the ledger) until the balance is back at zero,
--      and the parents are notified. Classes already attended are never
--      touched; if those alone put the skater negative, that's a debt
--      ("owes N classes"), consistent with attendance being the truth.
--   2. ₹0 periods are born paid (F-14) — nothing to collect, credits usable.
--   3. Booking window enforced in the database (F-15): a class can be
--      booked up to `booking_window_days` (setting, default 7) ahead.
--      (No cancel cutoff — see DECISIONS.)
--   4. Archiving a skater, or moving them out of a batch, cancels their
--      future bookings there (F-16).
--   5. A completed session, or one with attendance, can't be deleted —
--      cancel it instead (F-17).
--   6. A top-up is refused when the skater isn't enrolled in the plan's
--      batch (F-10).
-- =============================================================================


-- ## 1. Clawback -------------------------------------------------------------------

-- Which upcoming bookings would go, newest first, to cover a shortfall.
create or replace function public.clawback_preview(p_student_id uuid, p_credits_removed integer)
returns table (
  shortfall  integer,
  booking_id uuid,
  session_id uuid,
  session_date date,
  start_time time,
  batch_name text
)
language sql stable
as $$
  with bal as (
    select coalesce(public.class_credit_balance(p_student_id), 0) - coalesce(p_credits_removed, 0) as after
  ),
  need as (
    select greatest(-after, 0)::integer as shortfall from bal
  ),
  future as (
    select b.id, b.session_id, ss.session_date, ss.start_time, bt.name,
           row_number() over (order by ss.session_date desc, ss.start_time desc) as rn
    from public.class_bookings b
    join public.schedule_sessions ss on ss.id = b.session_id
    join public.batches bt on bt.id = ss.batch_id
    where b.student_id = p_student_id
      and b.status = 'booked'
      and ss.status = 'scheduled'
      and ss.session_date >= current_date
  )
  select need.shortfall, f.id, f.session_id, f.session_date, f.start_time, f.name
  from need
  left join future f on f.rn <= need.shortfall
  order by f.session_date, f.start_time;
$$;

-- Cancel the newest future bookings until the balance is ≥ 0 (or none are
-- left). Returns how many were cancelled; notifies the parents once.
create or replace function public.cancel_bookings_for_shortfall(p_student_id uuid, p_reason text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_student  public.students%rowtype;
  v_short    integer;
  v_ids      uuid[];
  v_dates    text;
  v_count    integer := 0;
begin
  select * into v_student from public.students where id = p_student_id;
  v_short := greatest(-coalesce(public.class_credit_balance(p_student_id), 0), 0);
  if v_short = 0 then
    return 0;
  end if;

  with future as (
    select b.id, ss.session_date
    from public.class_bookings b
    join public.schedule_sessions ss on ss.id = b.session_id
    where b.student_id = p_student_id
      and b.status = 'booked'
      and ss.status = 'scheduled'
      and ss.session_date >= current_date
    order by ss.session_date desc, ss.start_time desc
    limit v_short
  )
  select array_agg(id), string_agg(to_char(session_date, 'DD Mon'), ', ' order by session_date)
    into v_ids, v_dates
  from future;

  if v_ids is null then
    return 0;
  end if;

  update public.class_bookings
     set status = 'cancelled', cancelled_at = now()
   where id = any (v_ids);
  get diagnostics v_count = row_count;

  insert into public.notifications (academy_id, profile_id, type, title, body, link)
  select
    v_student.academy_id,
    x.parent_profile_id,
    'booking_cancelled',
    'Bookings cancelled — ' || v_student.full_name,
    v_count || ' upcoming class' || case when v_count = 1 then '' else 'es' end
      || ' (' || v_dates || ') ' || case when v_count = 1 then 'was' else 'were' end
      || ' cancelled: ' || p_reason || '. Book again once the classes are covered.',
    '/parent/schedule'
  from public.parents_students x
  where x.student_id = p_student_id;

  return v_count;
end;
$$;

-- assert_credits_not_negative() (0019) is replaced: the caller decides
-- whether a shortfall is refused or resolved by cancelling bookings.
create or replace function public.settle_credit_shortfall(
  p_student_id      uuid,
  p_action          text,
  p_before          integer,
  p_cancel_bookings boolean,
  p_reason          text
)
returns void
language plpgsql
as $$
declare
  v_after integer;
  v_short integer;
begin
  v_after := public.class_credit_balance(p_student_id);
  if v_after is null or v_after >= 0 or v_after >= coalesce(p_before, 0) then
    return;
  end if;
  v_short := -v_after;
  if not p_cancel_bookings then
    raise exception '% would leave this skater % class% short of credits — confirm to cancel their % newest upcoming booking% first',
      p_action,
      v_short, case when v_short = 1 then '' else 'es' end,
      v_short, case when v_short = 1 then '' else 's' end;
  end if;
  perform public.cancel_bookings_for_shortfall(p_student_id, p_reason);
  -- Whatever is still negative was already attended: a debt, not an error.
end;
$$;

drop function if exists public.void_payment(uuid, text);

create or replace function public.void_payment(
  p_payment_id      uuid,
  p_reason          text,
  p_cancel_bookings boolean default false
)
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
  perform public.settle_credit_shortfall(
    v_fee.student_id, 'Voiding this payment', v_before, p_cancel_bookings,
    'payment voided (' || btrim(p_reason) || ')'
  );

  return v_payment;
end;
$$;

drop function if exists public.delete_student_fee(uuid);

create or replace function public.delete_student_fee(p_fee_id uuid, p_cancel_bookings boolean default false)
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

  perform public.settle_credit_shortfall(
    v_fee.student_id, 'Deleting this period', v_before, p_cancel_bookings, 'fee period deleted'
  );
end;
$$;

drop function if exists public.assert_credits_not_negative(uuid, text, integer);


-- ## 2. ₹0 periods are born paid ----------------------------------------------------------

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
  )
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
  returning *;
end;
$$;


-- ## 3. Booking window in the database -----------------------------------------------------

drop function if exists public.credit_plan_status(uuid);

create function public.credit_plan_status(p_student_id uuid)
returns table (
  uses_credits  boolean,
  pricing_mode  public.fee_pricing_mode,
  billing_cycle public.billing_cycle,
  rate          numeric,
  min_topup     integer,
  term_start    date,
  term_end      date,
  days_left     integer,
  term_status   text,
  available     integer,
  booking_window_days integer
)
language sql stable
as $$
  with s as (
    select st.id, st.academy_id, fp.pricing_mode, fp.billing_cycle, fp.per_class_rate, a.settings
    from public.students st
    left join public.fee_plans fp on fp.id = st.fee_plan_id
    join public.academies a on a.id = st.academy_id
    where st.id = p_student_id
  ),
  term as (
    select f.period_start, f.period_end
    from public.student_fees f
    where f.student_id = p_student_id
      and f.status in ('paid', 'waived')
      and f.credits_granted is not null
    order by f.period_end desc
    limit 1
  )
  select
    public.student_uses_credits(p_student_id),
    s.pricing_mode,
    s.billing_cycle,
    s.per_class_rate,
    case s.billing_cycle
      when 'monthly'   then coalesce((s.settings->'topup_min_classes'->>'monthly')::integer, 8)
      when 'quarterly' then coalesce((s.settings->'topup_min_classes'->>'quarterly')::integer, 24)
      when 'annual'    then coalesce((s.settings->'topup_min_classes'->>'annual')::integer, 96)
    end,
    term.period_start,
    term.period_end,
    case when term.period_end is null then null
         else (term.period_end - public.academy_today(s.academy_id))::integer end,
    case
      when term.period_end is null then 'none'
      when term.period_end < public.academy_today(s.academy_id) then 'expired'
      when term.period_end - public.academy_today(s.academy_id) <= 7 then 'expiring'
      else 'active'
    end,
    public.class_credit_balance(p_student_id),
    coalesce((s.settings->>'booking_window_days')::integer, 7)
  from s
  left join term on true;
$$;

create or replace function public.book_class_slot(p_session_id uuid, p_student_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_booking public.class_bookings%rowtype;
  v_status  record;
  v_today   date;
begin
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

  v_today := public.academy_today(v_session.academy_id);
  if v_session.session_date < v_today then
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

  perform 1 from public.students where id = p_student_id for update;

  select * into v_status from public.credit_plan_status(p_student_id);

  if v_session.session_date > v_today + v_status.booking_window_days then
    raise exception 'Classes open for booking % days ahead — this one opens on %',
      v_status.booking_window_days,
      to_char(v_session.session_date - v_status.booking_window_days, 'DD Mon');
  end if;

  if v_status.term_status = 'expired' then
    raise exception 'The plan ended on % — top up at the academy to renew it',
      to_char(v_status.term_end, 'DD Mon');
  end if;

  if coalesce(v_status.available, 0) <= 0 then
    if v_status.pricing_mode = 'per_class' then
      if coalesce(v_status.available, 0) < 0 then
        raise exception 'This skater owes % class% from attending without credits — top up at the academy first',
          -v_status.available, case when v_status.available = -1 then '' else 'es' end;
      end if;
      raise exception 'No classes left — top up at the academy to book';
    elsif exists (
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

  insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at, source)
  values (v_session.academy_id, p_student_id, p_session_id, 'booked', now(), null, 'parent')
  on conflict (student_id, session_id) do update
    set status = 'booked', booked_at = now(), cancelled_at = null, source = 'parent'
    where class_bookings.status = 'cancelled'
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'This class is already booked';
  end if;

  return v_booking;
end;
$$;


-- ## 4. Leaving frees future bookings ---------------------------------------------------------

create or replace function public.release_future_bookings(p_student_id uuid, p_batch_id uuid default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with released as (
    update public.class_bookings b
       set status = 'cancelled', cancelled_at = now()
      from public.schedule_sessions ss
     where ss.id = b.session_id
       and b.student_id = p_student_id
       and b.status = 'booked'
       and ss.status = 'scheduled'
       and ss.session_date >= current_date
       and (p_batch_id is null or ss.batch_id = p_batch_id)
    returning 1
  )
  select count(*)::integer into v_count from released;
  return v_count;
end;
$$;

create or replace function public.trg_students_release_bookings()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status <> 'active' and old.status = 'active' then
    perform public.release_future_bookings(new.id);
  end if;
  return new;
end;
$$;

create trigger students_release_bookings
  after update of status on public.students
  for each row execute function public.trg_students_release_bookings();

create or replace function public.trg_student_batches_release_bookings()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.release_future_bookings(old.student_id, old.batch_id);
    return old;
  end if;
  if new.status <> 'active' and old.status = 'active' then
    perform public.release_future_bookings(new.student_id, new.batch_id);
  elsif new.batch_id is distinct from old.batch_id then
    perform public.release_future_bookings(new.student_id, old.batch_id);
  end if;
  return new;
end;
$$;

create trigger student_batches_release_bookings
  after update of status, batch_id or delete on public.student_batches
  for each row execute function public.trg_student_batches_release_bookings();


-- ## 5. Completed sessions can't be deleted ------------------------------------------------------

create or replace function public.guard_session_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'completed'
     or exists (select 1 from public.attendance where session_id = old.id) then
    raise exception 'This session has attendance recorded and can''t be deleted — cancel it instead';
  end if;
  return old;
end;
$$;

create trigger sessions_guard_delete
  before delete on public.schedule_sessions
  for each row execute function public.guard_session_delete();


-- ## 6. A top-up needs the skater in the plan's batch -----------------------------------------------

create or replace function public.record_credit_topup(
  p_student_id      uuid,
  p_classes         integer,
  p_paid_date       date default null,
  p_method          public.payment_method default 'cash',
  p_reference       text default null,
  p_notes           text default null,
  p_idempotency_key uuid default null
)
returns public.student_fees
language plpgsql security definer
set search_path = public
as $$
declare
  v_student  public.students%rowtype;
  v_plan     public.fee_plans%rowtype;
  v_status   record;
  v_today    date;
  v_date     date;
  v_start    date;
  v_end      date;
  v_fee      public.student_fees%rowtype;
  v_existing uuid;
  v_cycle    interval;
  v_batch    text;
begin
  select * into v_student from public.students where id = p_student_id;
  if not found then
    raise exception 'Skater not found';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_academy_admin() and v_student.academy_id = public.current_academy_id())
  ) then
    raise exception 'Only an admin of this academy can record a top-up';
  end if;

  if p_idempotency_key is not null then
    select student_fee_id into v_existing from public.payments
    where academy_id = v_student.academy_id and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      select * into v_fee from public.student_fees where id = v_existing;
      return v_fee;
    end if;
  end if;

  select * into v_plan from public.fee_plans where id = v_student.fee_plan_id;
  if not found or v_plan.pricing_mode <> 'per_class' or v_plan.batch_id is null then
    raise exception 'Top-ups are for skaters on a pay-per-class plan';
  end if;
  if not exists (
    select 1 from public.student_batches sb
    where sb.student_id = p_student_id and sb.batch_id = v_plan.batch_id and sb.status = 'active'
  ) then
    select name into v_batch from public.batches where id = v_plan.batch_id;
    raise exception 'This plan is for the % batch, which the skater isn''t enrolled in — fix the plan or the batch first', v_batch;
  end if;
  if p_classes is null or p_classes < 1 then
    raise exception 'Enter how many classes are being topped up';
  end if;

  select * into v_status from public.credit_plan_status(p_student_id);
  v_today := public.academy_today(v_student.academy_id);
  v_date  := coalesce(p_paid_date, v_today);
  if v_date > v_today then
    raise exception 'Payment date can''t be in the future';
  end if;

  v_cycle := case v_plan.billing_cycle
    when 'monthly'   then interval '1 month'
    when 'quarterly' then interval '3 months'
    else                  interval '1 year'
  end;

  if v_status.term_status in ('active', 'expiring') and p_classes < v_status.min_topup then
    v_start := v_status.term_start;
    v_end   := v_status.term_end;
  elsif v_status.term_status in ('active', 'expiring') then
    v_start := v_status.term_end + 1;
    v_end   := (v_start + v_cycle - interval '1 day')::date;
  else
    if p_classes < v_status.min_topup then
      raise exception 'A new % plan needs at least % classes (₹%)',
        v_plan.billing_cycle, v_status.min_topup,
        trim(to_char(v_status.min_topup * v_plan.per_class_rate, 'FM99,99,99,990'));
    end if;
    v_start := v_date;
    v_end   := (v_start + v_cycle - interval '1 day')::date;
  end if;

  perform set_config('app.fee_write', 'on', true);
  insert into public.student_fees
    (academy_id, student_id, fee_plan_id, kind, period_start, period_end, amount, due_date, status, credits_granted)
  values
    (v_student.academy_id, p_student_id, v_plan.id, 'topup', v_start, v_end,
     p_classes * v_plan.per_class_rate, v_date, 'pending', p_classes)
  returning * into v_fee;

  perform public.record_payment(
    v_fee.id, p_classes * v_plan.per_class_rate, v_date, p_method, p_reference,
    coalesce(p_notes, '') || case when p_notes is null then '' else ' · ' end
      || p_classes || ' class' || case when p_classes = 1 then '' else 'es' end || ' top-up',
    p_idempotency_key
  );

  select * into v_fee from public.student_fees where id = v_fee.id;
  return v_fee;
end;
$$;
