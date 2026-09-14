-- =============================================================================
-- 0006_skill_progression.sql — RPCs for the skill progression feature
-- =============================================================================
-- The tables (levels, skills, students.current_level_id, student_skills) and
-- their RLS already exist from 0001_initial_schema.sql — coaches can already
-- insert/update student_skills for their academy, and admins have full CRUD
-- on levels/skills. This migration adds only the server-side logic that
-- can't be expressed as a plain RLS-guarded table write:
--   1. promote_student(student)      — validates "all skills achieved" and
--                                       moves the student to the next level.
--                                       SECURITY DEFINER because coaches may
--                                       not otherwise write to `students`.
--   2. reorder_levels / reorder_skills — sets `sequence` from an ordered
--                                       id array, for the drag-reorder UI.
--   3. level_distribution()          — admin report: active skaters per level.
--   4. stale_students(days)          — admin report: active skaters with no
--                                       skill achieved in the window.
-- =============================================================================


-- ## 1. promote_student -------------------------------------------------------
-- Moves a student to the next level by sequence, after checking every skill
-- in their current level is 'achieved'. Coaches and academy admins only, and
-- only within their own academy. The existing audit_students trigger records
-- who promoted whom and when — no extra bookkeeping needed here.

create or replace function public.promote_student(p_student_id uuid)
returns table (level_id uuid, level_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student   public.students%rowtype;
  v_cur_seq   integer;
  v_total     integer;
  v_remaining integer;
  v_next      public.levels%rowtype;
begin
  select * into v_student from public.students where id = p_student_id;
  if not found then
    raise exception 'Skater not found';
  end if;

  if v_student.academy_id <> (select public.current_academy_id())
     or not ((select public.is_coach()) or (select public.is_academy_admin())) then
    raise exception 'Not permitted';
  end if;

  if v_student.current_level_id is null then
    raise exception 'This skater has no current level set yet';
  end if;

  select sequence into v_cur_seq from public.levels where id = v_student.current_level_id;

  select count(*) into v_total from public.skills sk where sk.level_id = v_student.current_level_id;
  if v_total = 0 then
    raise exception 'This level has no skills set up yet';
  end if;

  select count(*) into v_remaining
  from public.skills sk
  where sk.level_id = v_student.current_level_id
    and not exists (
      select 1 from public.student_skills ss
      where ss.student_id = p_student_id
        and ss.skill_id = sk.id
        and ss.status = 'achieved'
    );
  if v_remaining > 0 then
    raise exception 'Not every skill in the current level is marked achieved yet';
  end if;

  select * into v_next
  from public.levels
  where academy_id = v_student.academy_id and sequence = v_cur_seq + 1;
  if not found then
    raise exception 'This skater is already at the highest level';
  end if;

  update public.students set current_level_id = v_next.id where id = p_student_id;

  return query select v_next.id, v_next.name;
end;
$$;


-- ## 2. reorder_levels / reorder_skills ---------------------------------------
-- SECURITY INVOKER (default) — each update is subject to the existing
-- levels_admin_all / skills_admin_all RLS policies, so only an academy admin
-- reordering their own academy's rows actually changes anything.

create or replace function public.reorder_levels(p_ids uuid[])
returns void
language plpgsql
as $$
declare
  v_id  uuid;
  v_seq integer := 1;
begin
  foreach v_id in array p_ids loop
    update public.levels set sequence = v_seq where id = v_id;
    v_seq := v_seq + 1;
  end loop;
end;
$$;

create or replace function public.reorder_skills(p_level_id uuid, p_ids uuid[])
returns void
language plpgsql
as $$
declare
  v_id  uuid;
  v_seq integer := 1;
begin
  foreach v_id in array p_ids loop
    update public.skills set sequence = v_seq where id = v_id and level_id = p_level_id;
    v_seq := v_seq + 1;
  end loop;
end;
$$;


-- ## 3. level_distribution -----------------------------------------------------
-- SECURITY INVOKER — RLS on levels/students scopes this to the caller's
-- academy automatically. Admin "distribution of students across levels" report.

create or replace function public.level_distribution()
returns table (
  level_id      uuid,
  level_name    text,
  sequence      integer,
  student_count bigint
)
language sql stable
as $$
  select l.id, l.name, l.sequence, count(s.id)
  from public.levels l
  left join public.students s on s.current_level_id = l.id and s.status = 'active'
  group by l.id, l.name, l.sequence
  order by l.sequence;
$$;


-- ## 4. stale_students ----------------------------------------------------------
-- Active skaters with no skill marked 'achieved' in the last p_days days
-- (or never, in which case the clock starts at joined_date). is_top_level
-- flags a skater who has nowhere left to progress to, so the admin screen
-- can de-emphasize rather than hide them.

create or replace function public.stale_students(p_days integer default 60)
returns table (
  student_id       uuid,
  full_name        text,
  level_id         uuid,
  level_name       text,
  last_achieved_at timestamptz,
  days_since       integer,
  is_top_level     boolean
)
language sql stable
as $$
  select
    s.id                                                              as student_id,
    s.full_name                                                       as full_name,
    s.current_level_id                                                as level_id,
    l.name                                                             as level_name,
    la.last_achieved_at                                                as last_achieved_at,
    extract(day from now() - coalesce(la.last_achieved_at, s.joined_date::timestamptz))::integer
                                                                        as days_since,
    not exists (
      select 1 from public.levels nl
      where nl.academy_id = s.academy_id and nl.sequence = l.sequence + 1
    )                                                                   as is_top_level
  from public.students s
  join public.levels l on l.id = s.current_level_id
  left join lateral (
    select max(ss.updated_at) as last_achieved_at
    from public.student_skills ss
    where ss.student_id = s.id and ss.status = 'achieved'
  ) la on true
  where s.status = 'active'
    and coalesce(la.last_achieved_at, s.joined_date::timestamptz) < now() - make_interval(days => p_days)
  order by days_since desc;
$$;
