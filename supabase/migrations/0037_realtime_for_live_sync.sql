-- =============================================================================
-- 0037_realtime_for_live_sync.sql
-- =============================================================================
-- Every screen refreshes itself when the data behind it changes — for the
-- person who made the change and for everyone else looking at it (a parent
-- sees "Awaiting approval" flip to "Confirmed" the moment the coach taps
-- Approve). The app subscribes to Postgres change events for these tables
-- (src/shared/hooks/useLiveSync.ts) and re-fetches the affected queries.
--
-- Realtime applies each table's RLS policies per subscriber, so a parent
-- only ever receives events for rows they could read anyway. Only
-- `notifications` was published before (0005).
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'academies', 'profiles', 'coaches', 'students', 'parents_students', 'student_batches',
    'batches', 'schedule_sessions', 'holidays',
    'class_bookings', 'attendance', 'makeup_credits',
    'fee_plans', 'student_fees', 'payments', 'student_advances', 'credit_ledger',
    'levels', 'skills', 'student_skills',
    'announcements'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
