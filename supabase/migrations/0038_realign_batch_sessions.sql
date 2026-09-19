-- =============================================================================
-- 0038_realign_batch_sessions.sql
-- =============================================================================
-- Changing a batch's days used to leave the sessions generated under the old
-- days on the calendar; "Generate schedule" only ever adds, so the old
-- Mon/Wed/Fri sessions sat next to the new Sat/Sun ones. When the admin
-- ticks "also update upcoming sessions", the sessions that no longer match
-- the batch's days are now taken off the calendar:
--   * no bookings, no attendance → deleted outright (nobody was affected);
--   * anyone booked or requested  → cancelled through cancel_session(), which
--     releases their credits and notifies the parents.
-- Make-up sessions are deliberate one-offs and are never touched; nor is
-- anything in the past, completed or already cancelled.
-- =============================================================================

create or replace function public.realign_batch_sessions(p_batch_id uuid)
returns table (removed integer, cancelled integer)
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch public.batches%rowtype;
  v_today date;
  r       record;
begin
  if not public.is_academy_admin() then
    raise exception 'Only an academy admin can change a batch''s sessions';
  end if;
  select * into v_batch from public.batches where id = p_batch_id
    and academy_id = public.current_academy_id();
  if not found then
    raise exception 'Batch not found';
  end if;
  v_today := public.academy_today(v_batch.academy_id);
  removed := 0;
  cancelled := 0;

  for r in
    select s.id,
           exists (select 1 from public.class_bookings b
                   where b.session_id = s.id and b.status in ('booked', 'pending')) as has_bookings,
           exists (select 1 from public.attendance a where a.session_id = s.id) as has_marks
    from public.schedule_sessions s
    where s.batch_id = p_batch_id
      and s.status = 'scheduled'
      and s.session_date >= v_today
      and s.makeup_for_session_id is null
      and not (extract(dow from s.session_date)::smallint = any (v_batch.days_of_week))
  loop
    if r.has_bookings or r.has_marks then
      perform public.cancel_session(r.id, 'The batch no longer meets on this day');
      cancelled := cancelled + 1;
    else
      delete from public.schedule_sessions where id = r.id;
      removed := removed + 1;
    end if;
  end loop;

  return next;
end;
$$;

grant execute on function public.realign_batch_sessions(uuid) to authenticated;
