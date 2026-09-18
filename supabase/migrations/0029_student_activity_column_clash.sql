-- =============================================================================
-- 0029_student_activity_column_clash.sql
-- =============================================================================
-- student_activity() (0028) declares OUT columns named id / created_at /
-- action…, and plpgsql then treats those names in the body's SELECT as the
-- OUT variables — "column reference id is ambiguous". Tell plpgsql to
-- prefer the table columns.
-- =============================================================================

create or replace function public.student_activity(p_student_id uuid, p_limit integer default 100)
returns table (
  id          uuid,
  created_at  timestamptz,
  actor_name  text,
  action      text,
  entity_type text,
  entity_id   uuid,
  changes     jsonb
)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_student public.students%rowtype;
begin
  select * into v_student from public.students where students.id = p_student_id;
  if not found then
    raise exception 'Skater not found';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_academy_admin() and v_student.academy_id = public.current_academy_id())
  ) then
    raise exception 'Only an admin of this academy can view activity';
  end if;

  return query
  select a.id, a.created_at, p.full_name, a.action, a.entity_type, a.entity_id, a.changes
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_profile_id
  where a.academy_id = v_student.academy_id
    and (
      (a.entity_type = 'students' and a.entity_id = p_student_id)
      or (a.entity_type = 'student_fees' and a.entity_id in
            (select f.id from public.student_fees f where f.student_id = p_student_id))
      or (a.entity_type = 'payments' and a.entity_id in
            (select pm.id from public.payments pm
             join public.student_fees f on f.id = pm.student_fee_id
             where f.student_id = p_student_id))
      or (a.entity_type = 'class_bookings' and a.entity_id in
            (select b.id from public.class_bookings b where b.student_id = p_student_id))
      or (a.entity_type = 'makeup_credits' and a.entity_id in
            (select m.id from public.makeup_credits m where m.student_id = p_student_id))
      or (a.entity_type = 'attendance' and a.entity_id in
            (select at.id from public.attendance at where at.student_id = p_student_id))
    )
  order by a.created_at desc
  limit p_limit;
end;
$$;
