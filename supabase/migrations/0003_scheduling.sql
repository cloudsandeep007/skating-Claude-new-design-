-- =============================================================================
-- 0003_scheduling.sql — holidays, schedule generation, session cancellation
-- =============================================================================
-- Run once after 0002_storage.sql. Adds:
--   1. holidays table — dates the academy is closed; generation skips them
--   2. generate_sessions() — expands a batch's weekly rule over a date range,
--      skipping holidays, already-existing sessions, and dates where the
--      batch's coach is already booked at an overlapping time
--   3. cancel_session() — marks a session cancelled with a reason and writes
--      one notification per parent of every enrolled student, atomically
-- Both functions run as the caller (SECURITY INVOKER), so the existing RLS
-- policies decide who may do what — an academy_admin can, a parent cannot.
-- =============================================================================


-- ## 1. holidays -------------------------------------------------------------

create table public.holidays (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references public.academies (id) on delete cascade,
  holiday_date  date not null,
  name          text not null,
  created_at    timestamptz not null default now(),
  unique (academy_id, holiday_date)
);

create index holidays_academy_date_idx on public.holidays (academy_id, holiday_date);

alter table public.holidays enable row level security;

create policy holidays_super_all on public.holidays for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy holidays_admin_all on public.holidays for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy holidays_member_select on public.holidays for select to authenticated
  using (academy_id = (select public.current_academy_id()));


-- ## 2. generate_sessions ----------------------------------------------------
-- Returns one row per candidate day (a day matching the batch's days_of_week)
-- saying what happened to it, so the UI can report "created 12, skipped 2
-- holidays, 1 coach clash" instead of a bare count.

create or replace function public.generate_sessions(
  p_batch_id uuid,
  p_from     date,
  p_to       date
)
returns table (day date, outcome text)
language plpgsql
as $$
declare
  v_batch public.batches%rowtype;
  v_day   date;
begin
  select * into v_batch from public.batches where id = p_batch_id;
  if not found then
    raise exception 'Batch not found';
  end if;
  if p_to < p_from then
    raise exception 'End date must be on or after the start date';
  end if;
  if p_to - p_from > 366 then
    raise exception 'Generate at most one year at a time';
  end if;

  for v_day in select generate_series(p_from, p_to, interval '1 day')::date loop
    if not (extract(dow from v_day)::smallint = any (v_batch.days_of_week)) then
      continue;
    end if;

    day := v_day;

    if exists (
      select 1 from public.holidays h
      where h.academy_id = v_batch.academy_id and h.holiday_date = v_day
    ) then
      outcome := 'holiday';
      return next;
      continue;
    end if;

    if exists (
      select 1 from public.schedule_sessions s
      where s.batch_id = p_batch_id
        and s.session_date = v_day
        and s.start_time = v_batch.start_time
    ) then
      outcome := 'exists';
      return next;
      continue;
    end if;

    if v_batch.coach_id is not null and exists (
      select 1 from public.schedule_sessions s
      where s.coach_id = v_batch.coach_id
        and s.session_date = v_day
        and s.status <> 'cancelled'
        and s.start_time < v_batch.end_time
        and s.end_time > v_batch.start_time
    ) then
      outcome := 'coach_conflict';
      return next;
      continue;
    end if;

    insert into public.schedule_sessions
      (academy_id, batch_id, session_date, start_time, end_time, coach_id, status)
    values
      (v_batch.academy_id, p_batch_id, v_day, v_batch.start_time, v_batch.end_time,
       v_batch.coach_id, 'scheduled');

    outcome := 'created';
    return next;
  end loop;
end;
$$;


-- ## 3. cancel_session -------------------------------------------------------

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

  select name into v_batch_name from public.batches where id = v_session.batch_id;

  -- One notification per parent, even if two of their children are in the batch.
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
