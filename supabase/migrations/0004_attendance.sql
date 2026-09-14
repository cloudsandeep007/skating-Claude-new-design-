-- =============================================================================
-- 0004_attendance.sql — attendance marking rules and the save RPC
-- =============================================================================
-- Run once after 0003_scheduling.sql. Adds:
--   1. session_is_editable(session_id) — true from the start of the session's
--      day until 24 hours after it ends, in the ACADEMY's timezone
--      (academies.settings->>'timezone', default UTC), so an evening batch in
--      Kolkata doesn't get an extra 5½ hours from the server running in UTC
--   2. Coaches may only insert/update attendance while (1) is true; admins
--      can override at any time (the existing audit trigger records who)
--   3. Coaches may mark their own session 'completed'
--   4. save_attendance(session_id, marks) — upserts every mark and completes
--      the session in ONE transaction: one request from a rink with bad wifi
-- =============================================================================


-- ## 1. session_is_editable ---------------------------------------------------

create or replace function public.session_is_editable(p_session_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    now() >= (s.session_date::timestamp) at time zone coalesce(a.settings->>'timezone', 'UTC')
    and now() <= ((s.session_date + s.end_time) at time zone coalesce(a.settings->>'timezone', 'UTC'))
                 + interval '24 hours'
  from public.schedule_sessions s
  join public.academies a on a.id = s.academy_id
  where s.id = p_session_id;
$$;


-- ## 2. Coach attendance writes are time-locked ------------------------------

drop policy attendance_coach_insert on public.attendance;
drop policy attendance_coach_update on public.attendance;

create policy attendance_coach_insert on public.attendance for insert to authenticated
  with check (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and marked_by = (select auth.uid())
    and public.session_is_editable(session_id)
  );

create policy attendance_coach_update on public.attendance for update to authenticated
  using (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and public.session_is_editable(session_id)
  )
  with check (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and marked_by = (select auth.uid())
    and public.session_is_editable(session_id)
  );


-- ## 3. Coaches can complete their own sessions ------------------------------

create policy sessions_coach_complete on public.schedule_sessions for update to authenticated
  using (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and coach_id in (select c.id from public.coaches c where c.profile_id = (select auth.uid()))
  )
  with check (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and status in ('scheduled', 'completed')
  );


-- ## 4. save_attendance --------------------------------------------------------
-- p_marks: [{"student_id": "...", "status": "present"|"absent"|"late"|"excused"}, ...]
-- SECURITY INVOKER — the policies above still decide whether the caller may.

create or replace function public.save_attendance(
  p_session_id uuid,
  p_marks      jsonb
)
returns integer
language plpgsql
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_count   integer := 0;
  v_mark    jsonb;
begin
  select * into v_session from public.schedule_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'This session was cancelled';
  end if;

  for v_mark in select * from jsonb_array_elements(p_marks) loop
    insert into public.attendance (academy_id, session_id, student_id, status, marked_by, marked_at)
    values (
      v_session.academy_id,
      p_session_id,
      (v_mark->>'student_id')::uuid,
      (v_mark->>'status')::public.attendance_status,
      auth.uid(),
      now()
    )
    on conflict (session_id, student_id) do update
      set status    = excluded.status,
          marked_by = excluded.marked_by,
          marked_at = excluded.marked_at;
    v_count := v_count + 1;
  end loop;

  if v_session.status = 'scheduled' then
    update public.schedule_sessions set status = 'completed' where id = p_session_id;
  end if;

  return v_count;
end;
$$;
