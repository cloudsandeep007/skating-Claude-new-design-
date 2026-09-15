-- =============================================================================
-- 0012_class_bookings.sql — universal class-credit + weekly booking system
-- =============================================================================
-- Run once after 0011_makeup_credits_and_per_class_billing.sql. Adds:
--   1. student_fees.credits_granted — how many classes that period paid for,
--      computed the same way for every plan (cycle or per_class)
--   2. class_bookings — one row per student per session they've reserved
--   3. class_credit_balance() — the one running, never-reset balance a
--      student can spend: credits granted, minus active bookings, plus any
--      pending make-up credits (0011) as a bonus
--   4. book_class_slot() / cancel_class_slot() — reserve / free a slot
--   5. cancel_session() gains one line: cancelling frees any bookings on it
--   6. generate_upcoming_fees() sets credits_granted alongside amount
-- =============================================================================


-- ## 1. student_fees.credits_granted -------------------------------------------
-- Same rationale as `amount`: copied at generation time so a later plan or
-- schedule edit never rewrites history. Null for an academy-wide (no batch)
-- plan — those students aren't part of the booking system.

alter table public.student_fees
  add column credits_granted integer;


-- ## 2. class_bookings -----------------------------------------------------------

create table public.class_bookings (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references public.academies (id) on delete cascade,
  student_id   uuid not null,
  session_id   uuid not null,
  status       text not null default 'booked' check (status in ('booked', 'cancelled')),
  booked_at    timestamptz not null default now(),
  cancelled_at timestamptz,
  foreign key (student_id, academy_id) references public.students (id, academy_id) on delete cascade,
  foreign key (session_id, academy_id) references public.schedule_sessions (id, academy_id) on delete cascade,
  unique (student_id, session_id)
);

create index class_bookings_student_idx on public.class_bookings (student_id, status);
create index class_bookings_session_idx on public.class_bookings (session_id, status);

alter table public.class_bookings enable row level security;

create policy class_bookings_super_all on public.class_bookings for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy class_bookings_admin_all on public.class_bookings for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy class_bookings_coach_select on public.class_bookings for select to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()));
create policy class_bookings_parent_select on public.class_bookings for select to authenticated
  using (student_id = any ((select public.parent_student_ids())::uuid[]));

create trigger audit_class_bookings after insert or update or delete on public.class_bookings
  for each row execute function public.audit_row_change();


-- ## 3. class_credit_balance -----------------------------------------------------
-- available = every credit ever granted, minus every active booking ever
-- made, plus every still-pending make-up credit (0011) as a bonus. Nothing
-- is period-scoped on purpose — see DECISIONS.md: this is what makes
-- unused credits "carry forward" with no separate rollover step.

create or replace function public.class_credit_balance(p_student_id uuid)
returns integer
language sql stable
as $$
  select
    coalesce((select sum(credits_granted) from public.student_fees where student_id = p_student_id), 0)
    - coalesce((select count(*) from public.class_bookings
                where student_id = p_student_id and status = 'booked'), 0)
    + coalesce((select count(*) from public.makeup_credits
                where student_id = p_student_id and status = 'pending'), 0);
$$;


-- ## 4. book_class_slot / cancel_class_slot ---------------------------------------
-- SECURITY INVOKER — class_bookings has no parent insert/update policy, so
-- these RPCs (SECURITY DEFINER) are the only way a parent can book/cancel;
-- each re-checks the caller owns the student via parent_student_ids().

create or replace function public.book_class_slot(p_session_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_session  public.schedule_sessions%rowtype;
  v_student_id uuid;
  v_booking  public.class_bookings%rowtype;
begin
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

  select sb.student_id into v_student_id
  from public.student_batches sb
  where sb.batch_id = v_session.batch_id
    and sb.status = 'active'
    and sb.student_id = any (public.parent_student_ids())
  limit 1;

  if v_student_id is null then
    raise exception 'No student of yours is enrolled in this batch';
  end if;

  if public.class_credit_balance(v_student_id) <= 0 then
    raise exception 'No class credits remaining';
  end if;

  insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at)
  values (v_session.academy_id, v_student_id, p_session_id, 'booked', now(), null)
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

create or replace function public.cancel_class_slot(p_session_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_booking public.class_bookings%rowtype;
begin
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
     and status = 'booked'
     and student_id = any (public.parent_student_ids())
   returning * into v_booking;

  if not found then
    raise exception 'No active booking found for this class';
  end if;

  return v_booking;
end;
$$;


-- ## 5. cancel_session() also frees any bookings on it -----------------------------
-- The class never happened, so nobody's credit should be held hostage —
-- everyone who was booked can book the make-up session (or any other day)
-- with the freed credit. Recreated in full since create or replace can't
-- be partially patched; body is 0003_scheduling.sql's version plus this.

create or replace function public.cancel_session(
  p_session_id uuid,
  p_reason     text
)
returns void
language plpgsql
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_batch_name text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A cancellation reason is required';
  end if;

  update public.schedule_sessions
     set status = 'cancelled', cancellation_reason = btrim(p_reason)
   where id = p_session_id and status = 'scheduled'
   returning * into v_session;

  if not found then
    raise exception 'Only a scheduled session can be cancelled';
  end if;

  update public.class_bookings
     set status = 'cancelled', cancelled_at = now()
   where session_id = p_session_id and status = 'booked';

  select name into v_batch_name from public.batches where id = v_session.batch_id;

  insert into public.notifications (academy_id, profile_id, type, title, body, link)
  select distinct
    v_session.academy_id,
    ps.parent_profile_id,
    'session_cancelled',
    'Session cancelled: ' || v_batch_name,
    to_char(v_session.session_date, 'Dy DD Mon') || ' at '
      || to_char(v_session.start_time, 'HH12:MI AM') || ' — ' || btrim(p_reason),
    '/parent'
  from public.student_batches sb
  join public.parents_students ps on ps.student_id = sb.student_id
  where sb.batch_id = v_session.batch_id
    and sb.status = 'active';
end;
$$;


-- ## 6. generate_upcoming_fees() also sets credits_granted -------------------------
-- Same weekday-count function already used for per-class billing, now
-- computed for every plan that has a batch (cycle or per_class alike).
-- Billing math (`amount`) is completely unchanged.

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
      pricing_mode, per_class_rate, batch_id,
      coalesce(last_period_end, joined_date - 1) + 1 as period_start
    from eligible
    where last_period_end is null or last_period_end < current_date
  ),
  next_period as (
    select
      student_id, academy_id, fee_plan_id, amount, pricing_mode, per_class_rate, batch_id,
      period_start,
      (case billing_cycle
         when 'monthly'   then period_start + interval '1 month'
         when 'quarterly' then period_start + interval '3 months'
         when 'annual'    then period_start + interval '1 year'
       end - interval '1 day')::date          as period_end
    from due
  )
  insert into public.student_fees
    (academy_id, student_id, fee_plan_id, period_start, period_end, amount, due_date, status, credits_granted)
  select
    academy_id, student_id, fee_plan_id, period_start, period_end,
    case
      when pricing_mode = 'per_class'
        then per_class_rate * public.expected_classes_from_schedule(batch_id, period_start, period_end)
      else amount
    end,
    period_start, 'pending',
    case
      when batch_id is not null
        then public.expected_classes_from_schedule(batch_id, period_start, period_end)
      else null
    end
  from next_period np
  where not exists (
    select 1 from public.student_fees sf2
    where sf2.student_id = np.student_id and sf2.period_start = np.period_start
  )
  returning *;
end;
$$;
