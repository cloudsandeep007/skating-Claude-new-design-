-- =============================================================================
-- 0002_storage.sql — Storage bucket for student photos
-- =============================================================================
-- Private bucket (never public — these are photos of minors). Objects are
-- stored at "<academy_id>/<student_id>/<filename>", so the same RLS helper
-- functions used everywhere else can scope access by reading path segments
-- with storage.foldername(name).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do nothing;

create policy student_photos_super_all on storage.objects for all to authenticated
  using (bucket_id = 'student-photos' and (select public.is_super_admin()))
  with check (bucket_id = 'student-photos' and (select public.is_super_admin()));

create policy student_photos_academy_select on storage.objects for select to authenticated
  using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  );

create policy student_photos_admin_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and (select public.is_academy_admin())
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  );

create policy student_photos_admin_update on storage.objects for update to authenticated
  using (
    bucket_id = 'student-photos'
    and (select public.is_academy_admin())
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  )
  with check (
    bucket_id = 'student-photos'
    and (select public.is_academy_admin())
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  );

create policy student_photos_admin_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'student-photos'
    and (select public.is_academy_admin())
    and (storage.foldername(name))[1] = (select public.current_academy_id())::text
  );
