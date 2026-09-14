-- =============================================================================
-- 0005_announcements.sql — announcement fan-out and realtime notifications
-- =============================================================================
-- Run once after 0004_attendance.sql. Adds:
--   1. announcements.notified_at — set when notification rows were created,
--      so a scheduled announcement is fanned out exactly once, when due
--   2. notifications.announcement_id — links a notification to its post so
--      the feed can show read/unread per announcement
--   3. publish_due_announcements() — creates one notification per recipient
--      for every due, not-yet-notified announcement in the caller's academy.
--      Called by the app when an admin publishes and whenever a feed loads
--      (cheap and idempotent), so scheduled posts go out without a cron job.
--   4. Realtime on notifications, so a new one appears without a refresh
-- =============================================================================


-- ## 1 & 2. Columns -------------------------------------------------------------

alter table public.announcements
  add column notified_at timestamptz;

alter table public.notifications
  add column announcement_id uuid references public.announcements (id) on delete cascade;

create index notifications_announcement_idx on public.notifications (announcement_id);
create index announcements_due_idx
  on public.announcements (academy_id, published_at)
  where notified_at is null;


-- ## 3. publish_due_announcements --------------------------------------------
-- SECURITY DEFINER because it inserts notifications for OTHER users, which a
-- parent or coach loading their feed couldn't do under their own RLS. It is
-- still scoped: only the caller's academy, only announcements an admin there
-- already published, and never twice.

create or replace function public.publish_due_announcements()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_academy uuid := public.current_academy_id();
  v_ann     public.announcements%rowtype;
  v_count   integer := 0;
begin
  if v_academy is null then
    return 0;
  end if;

  for v_ann in
    select * from public.announcements a
    where a.academy_id = v_academy
      and a.notified_at is null
      and a.published_at is not null
      and a.published_at <= now()
    for update skip locked
  loop
    insert into public.notifications
      (academy_id, profile_id, type, title, body, link, announcement_id)
    select distinct
      v_ann.academy_id,
      p.id,
      'announcement',
      v_ann.title,
      left(v_ann.body, 140),
      case p.role
        when 'parent' then '/parent/announcements'
        when 'coach'  then '/coach/inbox'
        else '/admin/announcements'
      end,
      v_ann.id
    from public.profiles p
    left join public.coaches c on c.profile_id = p.id
    where p.academy_id = v_ann.academy_id
      and p.status <> 'inactive'
      and p.id is distinct from v_ann.created_by
      and (
        v_ann.audience = 'all'
        or (v_ann.audience = 'parents' and p.role = 'parent')
        or (v_ann.audience = 'coaches' and p.role = 'coach')
        or (v_ann.audience = 'batch' and (
              (p.role = 'parent' and exists (
                 select 1
                 from public.parents_students ps
                 join public.student_batches sb on sb.student_id = ps.student_id
                 where ps.parent_profile_id = p.id
                   and sb.batch_id = v_ann.batch_id
                   and sb.status = 'active'))
              or (p.role = 'coach' and exists (
                 select 1 from public.batches b
                 where b.id = v_ann.batch_id and b.coach_id = c.id))
        ))
      );

    update public.announcements set notified_at = now() where id = v_ann.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


-- ## 4. Realtime -------------------------------------------------------------
-- Clients subscribe to inserts filtered to their own profile_id; RLS on the
-- table still applies to what realtime delivers.

alter publication supabase_realtime add table public.notifications;
