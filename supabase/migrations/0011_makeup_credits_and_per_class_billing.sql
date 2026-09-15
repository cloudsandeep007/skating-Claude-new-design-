-- =============================================================================
-- 0011_makeup_credits_and_per_class_billing.sql
-- =============================================================================
-- Run once after 0010_fee_batch_plans_and_reminders.sql. Adds:
--   1. schedule_sessions.makeup_for_session_id — links a make-up session back
--      to the cancelled session it replaces
--   2. schedule_makeup_session() — admin schedules a make-up for a whole
--      batch after cancel_session(); reuses generate_sessions()'s holiday
--      and coach-conflict checks for the single new date
--   3. makeup_credits — one row per student per personally-missed session
--   4. attendance_makeup_credit trigger — grants/revokes a credit as
--      attendance is marked 'absent' / corrected, with zero changes to
--      save_attendance() or any attendance UI
--   5. fulfill_makeup_credit() — admin marks a credit used
--   6. expected_classes_from_schedule() — weekday count from a batch's
--      schedule, minus holidays, for a date range (billing math)
--   7. fee_plans.pricing_mode / per_class_rate — a plan can bill a flat
--      cycle amount (existing behaviour) or a per-class rate computed
--      upfront from the batch's weekly schedule
--   8. attendance_summary_for_range() gains expected_sessions and
--      pending_makeup_credits columns for the admin report
-- =============================================================================


-- ## 1. Make-up linkage on schedule_sessions ----------------------------------

alter table public.schedule_sessions
  add column makeup_for_session_id uuid references public.schedule_sessions (id) on delete set null;

-- At most one make-up session per cancelled session.
create unique index schedule_sessions_makeup_for_idx
  on public.schedule_sessions (makeup_for_session_id)
  where makeup_for_session_id is not null;


-- ## 2. schedule_makeup_session ------------------------------------------------
-- Schedules one new session for the same batch as p_original_session_id,
-- linked back to it. Reuses generate_sessions()'s holiday-skip and
-- coach-conflict checks (as exceptions, since this is a single explicit
-- date chosen by the admin, not a range to silently skip over) and notifies
-- every parent in the batch, same fan-out shape as cancel_session().
-- SECURITY INVOKER — sessions_admin_all decides who may insert.

create or replace function public.schedule_makeup_session(
  p_original_session_id uuid,
  p_date                date,
  p_start               time,
  p_end                 time
)
returns public.schedule_sessions
language plpgsql
as $$
declare
  v_original public.schedule_sessions%rowtype;
  v_batch    public.batches%rowtype;
  v_batch_name text;
  v_session  public.schedule_sessions%rowtype;
begin
  select * into v_original from public.schedule_sessions where id = p_original_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_original.status <> 'cancelled' then
    raise exception 'Only a cancelled session can get a make-up scheduled';
  end if;
  if exists (
    select 1 from public.schedule_sessions
    where makeup_for_session_id = p_original_session_id
  ) then
    raise exception 'A make-up session is already scheduled for this one';
  end if;
  if p_end <= p_start then
    raise exception 'End time must be after the start time';
  end if;

  select * into v_batch from public.batches where id = v_original.batch_id;

  if exists (
    select 1 from public.holidays h
    where h.academy_id = v_original.academy_id and h.holiday_date = p_date
  ) then
    raise exception 'That date is a holiday';
  end if;

  if v_batch.coach_id is not null and exists (
    select 1 from public.schedule_sessions s
    where s.coach_id = v_batch.coach_id
      and s.session_date = p_date
      and s.status <> 'cancelled'
      and s.start_time < p_end
      and s.end_time > p_start
  ) then
    raise exception 'The coach already has a session at that time';
  end if;

  insert into public.schedule_sessions
    (academy_id, batch_id, session_date, start_time, end_time, coach_id, status, makeup_for_session_id)
  values
    (v_original.academy_id, v_original.batch_id, p_date, p_start, p_end,
     v_batch.coach_id, 'scheduled', p_original_session_id)
  returning * into v_session;

  select name into v_batch_name from public.batches where id = v_original.batch_id;

  insert into public.notifications (academy_id, profile_id, type, title, body, link)
  select distinct
    v_original.academy_id,
    ps.parent_profile_id,
    'makeup_scheduled',
    'Make-up class scheduled: ' || v_batch_name,
    to_char(p_date, 'Dy DD Mon') || ' at ' || to_char(p_start, 'HH12:MI AM')
      || ' — replaces ' || to_char(v_original.session_date, 'Dy DD Mon'),
    '/parent'
  from public.student_batches sb
  join public.parents_students ps on ps.student_id = sb.student_id
  where sb.batch_id = v_original.batch_id
    and sb.status = 'active';

  return v_session;
end;
$$;


-- ## 3. makeup_credits ---------------------------------------------------------
-- One row per student per session they personally missed. Batch-wide
-- make-ups (an academy cancellation) don't create rows here at all — the
-- whole batch simply gets a new session via schedule_makeup_session() above.

create table public.makeup_credits (
  id                uuid primary key default gen_random_uuid(),
  academy_id        uuid not null references public.academies (id) on delete cascade,
  student_id        uuid not null,
  reason_session_id uuid not null,
  status            text not null default 'pending' check (status in ('pending', 'fulfilled')),
  granted_at        timestamptz not null default now(),
  fulfilled_at      timestamptz,
  fulfilled_by      uuid references public.profiles (id) on delete set null,
  notes             text,
  foreign key (student_id, academy_id) references public.students (id, academy_id) on delete cascade,
  foreign key (reason_session_id, academy_id) references public.schedule_sessions (id, academy_id) on delete cascade,
  unique (student_id, reason_session_id)
);

create index makeup_credits_student_idx on public.makeup_credits (student_id, status);

alter table public.makeup_credits enable row level security;

create policy makeup_credits_super_all on public.makeup_credits for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy makeup_credits_admin_all on public.makeup_credits for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy makeup_credits_parent_select on public.makeup_credits for select to authenticated
  using (student_id = any ((select public.parent_student_ids())::uuid[]));

create trigger audit_makeup_credits after insert or update or delete on public.makeup_credits
  for each row execute function public.audit_row_change();


-- ## 4. attendance_makeup_credit trigger ---------------------------------------
-- Grants a pending credit the moment a mark becomes 'absent'; removes a
-- still-pending one if a mark is corrected away from 'absent'. Fires from
-- save_attendance()'s per-mark insert/update, so this is the entire
-- mechanism for "a personal absence earns that student a credit" — no
-- changes needed to save_attendance() itself or the coach attendance UI.

create or replace function public.grant_or_revoke_makeup_credit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status = 'absent' then
    insert into public.makeup_credits (academy_id, student_id, reason_session_id)
    values (new.academy_id, new.student_id, new.session_id)
    on conflict (student_id, reason_session_id) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'absent' and new.status <> 'absent' then
    delete from public.makeup_credits
    where student_id = new.student_id
      and reason_session_id = new.session_id
      and status = 'pending';
  end if;
  return null;
end;
$$;

create trigger attendance_makeup_credit
  after insert or update of status on public.attendance
  for each row execute function public.grant_or_revoke_makeup_credit();


-- ## 5. fulfill_makeup_credit ---------------------------------------------------
-- SECURITY INVOKER — makeup_credits_admin_all decides who may update.

create or replace function public.fulfill_makeup_credit(
  p_credit_id uuid,
  p_notes     text default null
)
returns public.makeup_credits
language plpgsql
as $$
declare
  v_credit public.makeup_credits%rowtype;
begin
  update public.makeup_credits
     set status = 'fulfilled', fulfilled_at = now(), fulfilled_by = auth.uid(),
         notes = coalesce(p_notes, notes)
   where id = p_credit_id and status = 'pending'
   returning * into v_credit;

  if not found then
    raise exception 'Credit not found, or already fulfilled';
  end if;

  return v_credit;
end;
$$;


-- ## 6. expected_classes_from_schedule ------------------------------------------
-- Weekday count from the batch's days_of_week, minus holidays, over
-- [p_from, p_to] — mirrors generate_sessions()'s day-loop but only counts,
-- never inserts. Used to price a per-class plan BEFORE the period's
-- sessions necessarily exist.

create or replace function public.expected_classes_from_schedule(
  p_batch_id uuid,
  p_from     date,
  p_to       date
)
returns integer
language sql stable
as $$
  select count(*)::integer
  from generate_series(p_from, p_to, interval '1 day') as d(day)
  join public.batches b on b.id = p_batch_id
  where extract(dow from d.day)::smallint = any (b.days_of_week)
    and not exists (
      select 1 from public.holidays h
      where h.academy_id = b.academy_id and h.holiday_date = d.day::date
    );
$$;


-- ## 7. Per-class fee plans -----------------------------------------------------

create type public.fee_pricing_mode as enum ('cycle', 'per_class');

alter table public.fee_plans
  add column pricing_mode public.fee_pricing_mode not null default 'cycle',
  add column per_class_rate numeric(10, 2);

alter table public.fee_plans
  add constraint fee_plans_per_class_needs_batch_and_rate
  check (
    pricing_mode = 'cycle'
    or (batch_id is not null and per_class_rate is not null and per_class_rate >= 0)
  );

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
    (academy_id, student_id, fee_plan_id, period_start, period_end, amount, due_date, status)
  select
    academy_id, student_id, fee_plan_id, period_start, period_end,
    case
      when pricing_mode = 'per_class'
        then per_class_rate * public.expected_classes_from_schedule(batch_id, period_start, period_end)
      else amount
    end,
    period_start, 'pending'
  from next_period np
  where not exists (
    select 1 from public.student_fees sf2
    where sf2.student_id = np.student_id and sf2.period_start = np.period_start
  )
  returning *;
end;
$$;


-- ## 8. attendance_summary_for_range: expected + make-up columns ----------------
-- Return shape changes, so the old function must be dropped first
-- (create or replace cannot change output columns — see 0010 for the same
-- issue with student_fees_list).

drop function public.attendance_summary_for_range(date, date, uuid);

create function public.attendance_summary_for_range(
  p_from     date,
  p_to       date,
  p_batch_id uuid default null
)
returns table (
  student_id             uuid,
  full_name              text,
  counted_sessions       bigint,
  attended_sessions      bigint,
  absent_sessions        bigint,
  late_sessions          bigint,
  excused_sessions       bigint,
  attendance_pct         numeric,
  expected_sessions      bigint,
  pending_makeup_credits bigint
)
language sql stable
as $$
  select
    s.id,
    s.full_name,
    count(*) filter (where a.status in ('present', 'absent', 'late')),
    count(*) filter (where a.status in ('present', 'late')),
    count(*) filter (where a.status = 'absent'),
    count(*) filter (where a.status = 'late'),
    count(*) filter (where a.status = 'excused'),
    round(100.0 * count(*) filter (where a.status in ('present', 'late'))
          / nullif(count(*) filter (where a.status in ('present', 'absent', 'late')), 0), 1),
    (
      select count(*) from public.schedule_sessions ss2
      join public.student_batches sb2 on sb2.batch_id = ss2.batch_id
      where sb2.student_id = s.id
        and sb2.status = 'active'
        and ss2.session_date between p_from and p_to
        and ss2.status <> 'cancelled'
        and (p_batch_id is null or ss2.batch_id = p_batch_id)
    ),
    (
      select count(*) from public.makeup_credits mc
      where mc.student_id = s.id and mc.status = 'pending'
    )
  from public.attendance a
  join public.schedule_sessions ss on ss.id = a.session_id
  join public.students s on s.id = a.student_id
  where ss.session_date between p_from and p_to
    and (p_batch_id is null or ss.batch_id = p_batch_id)
  group by s.id, s.full_name
  order by s.full_name;
$$;
