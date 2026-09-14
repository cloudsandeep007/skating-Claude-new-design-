-- =============================================================================
-- 0009_photos_and_needs_attention.sql — coach photos, and photo on the
-- dashboard's Needs attention panel
-- =============================================================================
-- Students already had photo_url + a private storage bucket (0002_storage.sql).
-- This gives coaches the same capability, and threads student photo_url
-- through to needs_attention() so the dashboard panel can show a real photo
-- instead of always falling back to initials.
-- =============================================================================

alter table public.coaches add column photo_url text;

-- Private bucket, same shape as student-photos: "<academy_id>/<coach_id>/<filename>".
insert into storage.buckets (id, name, public)
values ('coach-photos', 'coach-photos', false)
on conflict (id) do nothing;

create policy coach_photos_super_all on storage.objects for all to authenticated
  using (bucket_id = 'coach-photos' and (select public.is_super_admin()))
  with check (bucket_id = 'coach-photos' and (select public.is_super_admin()));

create policy coach_photos_academy_select on storage.objects for select to authenticated
  using (
    bucket_id = 'coach-photos'
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  );

create policy coach_photos_admin_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'coach-photos'
    and (select public.is_academy_admin())
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  );

create policy coach_photos_admin_update on storage.objects for update to authenticated
  using (
    bucket_id = 'coach-photos'
    and (select public.is_academy_admin())
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  )
  with check (
    bucket_id = 'coach-photos'
    and (select public.is_academy_admin())
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  );

create policy coach_photos_admin_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'coach-photos'
    and (select public.is_academy_admin())
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  );

-- Postgres won't let create-or-replace change a function's return columns,
-- so drop first. Same body as 0008_dashboard.sql's needs_attention(), with
-- one added column (photo_url).
drop function if exists public.needs_attention(integer, numeric, integer);

create function public.needs_attention(
  p_days         integer default 30,
  p_threshold    numeric default 60,
  p_min_sessions integer default 3
)
returns table (
  student_id        uuid,
  full_name         text,
  photo_url         text,
  batch_names       text,
  level_name        text,
  counted_sessions  bigint,
  attended_sessions bigint,
  missed_sessions   bigint,
  attendance_pct    numeric,
  parent_name       text,
  parent_phone      text,
  has_overdue_fee   boolean
)
language sql stable
as $$
  with recent as (
    select
      a.student_id,
      count(*) filter (where a.status in ('present', 'absent', 'late')) as counted,
      count(*) filter (where a.status in ('present', 'late'))           as attended,
      count(*) filter (where a.status = 'absent')                      as missed
    from public.attendance a
    join public.schedule_sessions ss on ss.id = a.session_id
    where ss.session_date > current_date - p_days
      and ss.session_date <= current_date
    group by a.student_id
  )
  select
    s.id,
    s.full_name,
    s.photo_url,
    (
      select string_agg(b.name, ', ' order by b.name)
      from public.student_batches sb
      join public.batches b on b.id = sb.batch_id
      where sb.student_id = s.id and sb.status = 'active'
    ),
    l.name,
    r.counted,
    r.attended,
    r.missed,
    round(100.0 * r.attended / nullif(r.counted, 0), 1),
    (
      select p.full_name from public.parents_students ps
      join public.profiles p on p.id = ps.parent_profile_id
      where ps.student_id = s.id order by ps.relationship limit 1
    ),
    (
      select p.phone from public.parents_students ps
      join public.profiles p on p.id = ps.parent_profile_id
      where ps.student_id = s.id order by ps.relationship limit 1
    ),
    exists (select 1 from public.student_fees sf where sf.student_id = s.id and sf.status = 'overdue')
  from recent r
  join public.students s on s.id = r.student_id
  left join public.levels l on l.id = s.current_level_id
  where s.status = 'active'
    and r.counted >= p_min_sessions
    and 100.0 * r.attended / nullif(r.counted, 0) < p_threshold
  order by 100.0 * r.attended / nullif(r.counted, 0) asc, s.full_name;
$$;

-- Note on delete permissions: coaches_admin_all and batches_admin_all
-- (0001_initial_schema.sql) already grant academy_admin "for all" — select,
-- insert, update, delete — so a hard delete of a coach or a batch needs no
-- new RLS policy, just the UI/mutation to call it.
