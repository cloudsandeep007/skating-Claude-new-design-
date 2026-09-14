-- =============================================================================
-- 0008_dashboard.sql — RPCs for the admin dashboard and reports
-- =============================================================================
-- Phase 0 already added the core dashboard views (student/batch attendance
-- summaries, monthly_collection_totals, at_risk_students); skill progression
-- added level_distribution(). This migration adds what's still missing so
-- every chart on the dashboard reads a view or RPC — never a raw table
-- query from a chart component:
--   1. dashboard_stat_cards()      — the 4 top stat cards, one round trip
--   2. monthly_attendance_trend()  — 6-month attendance % line, batch-filterable
--   3. batch_capacity_summary()    — enrolled vs capacity per batch
--   4. monthly_active_students()   — active-student retention line
--   5. coach_load_summary()        — students & sessions per coach
--   6. needs_attention()           — at_risk_students, plus level and an
--                                    overdue-fee flag, for the dashboard panel
-- All are SECURITY INVOKER — RLS on the underlying tables scopes every one
-- of them to the caller's own academy automatically.
-- =============================================================================


-- ## 1. dashboard_stat_cards ----------------------------------------------------
-- One row: each stat plus its "vs last month" comparison. Where there's no
-- historical snapshot to compare against (this app doesn't keep one), the
-- comparison is the closest honest proxy, not invented history:
--   - active_students: compared against students who joined this month
--     (there's no count of "active as of last month" without a snapshot)
--   - attendance: today's % vs last calendar month's overall %
--   - fees collected / outstanding: straight from monthly_collection_totals,
--     which already tracks by month

create or replace function public.dashboard_stat_cards()
returns table (
  active_students            bigint,
  new_students_this_month    bigint,
  today_attendance_pct       numeric,
  last_month_attendance_pct  numeric,
  fees_collected_this_month  numeric,
  fees_collected_last_month  numeric,
  outstanding_total          numeric,
  outstanding_students       bigint,
  outstanding_due_this_month numeric,
  outstanding_due_last_month numeric
)
language sql stable
as $$
  with today_att as (
    select
      count(*) filter (where a.status in ('present', 'late'))            as attended,
      count(*) filter (where a.status in ('present', 'absent', 'late'))   as counted
    from public.schedule_sessions ss
    join public.attendance a on a.session_id = ss.id
    where ss.session_date = current_date
  ),
  last_month_att as (
    select
      count(*) filter (where a.status in ('present', 'late'))            as attended,
      count(*) filter (where a.status in ('present', 'absent', 'late'))   as counted
    from public.schedule_sessions ss
    join public.attendance a on a.session_id = ss.id
    where date_trunc('month', ss.session_date)
        = date_trunc('month', current_date) - interval '1 month'
  ),
  fees_this as (
    select collected, outstanding from public.monthly_collection_totals
    where academy_id = (select public.current_academy_id())
      and month = date_trunc('month', current_date)::date
  ),
  fees_last as (
    select collected, outstanding from public.monthly_collection_totals
    where academy_id = (select public.current_academy_id())
      and month = (date_trunc('month', current_date) - interval '1 month')::date
  ),
  outstanding_now as (
    select
      coalesce(sum(f.amount - coalesce(pay.paid, 0)), 0) as total,
      count(distinct f.student_id)                       as students
    from public.student_fees f
    left join lateral (
      select sum(p.amount) as paid from public.payments p where p.student_fee_id = f.id
    ) pay on true
    where f.status in ('pending', 'overdue')
  )
  select
    (select count(*) from public.students where status = 'active'),
    (select count(*) from public.students
      where status = 'active' and joined_date >= date_trunc('month', current_date)),
    (select round(100.0 * attended / nullif(counted, 0), 1) from today_att),
    (select round(100.0 * attended / nullif(counted, 0), 1) from last_month_att),
    coalesce((select collected from fees_this), 0),
    coalesce((select collected from fees_last), 0),
    (select total from outstanding_now),
    (select students from outstanding_now),
    coalesce((select outstanding from fees_this), 0),
    coalesce((select outstanding from fees_last), 0);
$$;


-- ## 2. monthly_attendance_trend -------------------------------------------------

create or replace function public.monthly_attendance_trend(
  p_months   integer default 6,
  p_batch_id uuid    default null
)
returns table (
  month          date,
  attendance_pct numeric
)
language sql stable
as $$
  select
    date_trunc('month', ss.session_date)::date,
    round(100.0 * count(*) filter (where a.status in ('present', 'late'))
          / nullif(count(*) filter (where a.status in ('present', 'absent', 'late')), 0), 1)
  from public.schedule_sessions ss
  join public.attendance a on a.session_id = ss.id
  where ss.session_date >= date_trunc('month', current_date) - (p_months - 1) * interval '1 month'
    and (p_batch_id is null or ss.batch_id = p_batch_id)
  group by 1
  order by 1;
$$;


-- ## 3. batch_capacity_summary --------------------------------------------------

create or replace function public.batch_capacity_summary()
returns table (
  batch_id       uuid,
  batch_name     text,
  enrolled_count bigint,
  capacity       integer
)
language sql stable
as $$
  select
    b.id,
    b.name,
    count(sb.student_id) filter (where sb.status = 'active'),
    b.capacity
  from public.batches b
  left join public.student_batches sb on sb.batch_id = b.id
  where b.status = 'active'
  group by b.id, b.name, b.capacity
  order by b.name;
$$;


-- ## 4. monthly_active_students ---------------------------------------------------
-- "Active" for a past month means "had at least one attendance record that
-- month" — the closest available proxy without a historical status snapshot.

create or replace function public.monthly_active_students(p_months integer default 6)
returns table (
  month        date,
  active_count bigint
)
language sql stable
as $$
  select
    date_trunc('month', ss.session_date)::date,
    count(distinct a.student_id)
  from public.schedule_sessions ss
  join public.attendance a on a.session_id = ss.id
  where ss.session_date >= date_trunc('month', current_date) - (p_months - 1) * interval '1 month'
  group by 1
  order by 1;
$$;


-- ## 5. coach_load_summary --------------------------------------------------------

create or replace function public.coach_load_summary(p_days integer default 30)
returns table (
  coach_id       uuid,
  coach_name     text,
  student_count  bigint,
  session_count  bigint
)
language sql stable
as $$
  select
    c.id,
    p.full_name,
    (
      select count(distinct sb.student_id)
      from public.batches b
      join public.student_batches sb on sb.batch_id = b.id
      where b.coach_id = c.id and sb.status = 'active'
    ),
    (
      select count(*)
      from public.schedule_sessions ss
      where ss.coach_id = c.id
        and ss.session_date > current_date - p_days
        and ss.session_date <= current_date
        and ss.status <> 'cancelled'
    )
  from public.coaches c
  join public.profiles p on p.id = c.profile_id
  where c.status = 'active'
  order by p.full_name;
$$;


-- ## 6. needs_attention -----------------------------------------------------------
-- Same rule as the at_risk_students view (< 60% over the last 30 days, at
-- least 3 counted sessions) with the extra columns the dashboard panel
-- needs: current level and whether they also have an overdue fee.

create or replace function public.needs_attention(
  p_days         integer default 30,
  p_threshold    numeric default 60,
  p_min_sessions integer default 3
)
returns table (
  student_id        uuid,
  full_name         text,
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


-- ## 7. fee_collection_report -------------------------------------------------
-- Same shape as student_fees_list(), but filtered by an explicit due_date
-- range instead of one calendar month — the Reports page's date-range filter.

create or replace function public.fee_collection_report(
  p_from     date,
  p_to       date,
  p_batch_id uuid default null
)
returns table (
  student_fee_id uuid,
  student_id     uuid,
  full_name      text,
  batch_names    text,
  fee_plan_name  text,
  due_date       date,
  amount         numeric,
  paid           numeric,
  balance        numeric,
  status         public.fee_status
)
language sql stable
as $$
  select
    f.id,
    s.id,
    s.full_name,
    (
      select string_agg(b.name, ', ' order by b.name)
      from public.student_batches sb
      join public.batches b on b.id = sb.batch_id
      where sb.student_id = s.id and sb.status = 'active'
    ),
    fp.name,
    f.due_date,
    f.amount,
    coalesce(pay.paid, 0),
    f.amount - coalesce(pay.paid, 0),
    f.status
  from public.student_fees f
  join public.students s on s.id = f.student_id
  left join public.fee_plans fp on fp.id = f.fee_plan_id
  left join lateral (
    select sum(p.amount) as paid from public.payments p where p.student_fee_id = f.id
  ) pay on true
  where f.due_date between p_from and p_to
    and (
      p_batch_id is null or exists (
        select 1 from public.student_batches sb
        where sb.student_id = s.id and sb.batch_id = p_batch_id and sb.status = 'active'
      )
    )
  order by f.due_date desc, s.full_name;
$$;


-- ## 8. student_progress_report ------------------------------------------------
-- Per student: current level, skills achieved in the date range vs. their
-- current level's total, and attendance % within the same range.

create or replace function public.student_progress_report(
  p_from     date,
  p_to       date,
  p_batch_id uuid default null
)
returns table (
  student_id            uuid,
  full_name             text,
  batch_names           text,
  level_name            text,
  skills_achieved_range bigint,
  skills_in_level       bigint,
  attendance_pct        numeric
)
language sql stable
as $$
  with att as (
    select
      a.student_id,
      count(*) filter (where a.status in ('present', 'absent', 'late')) as counted,
      count(*) filter (where a.status in ('present', 'late'))           as attended
    from public.attendance a
    join public.schedule_sessions ss on ss.id = a.session_id
    where ss.session_date between p_from and p_to
    group by a.student_id
  )
  select
    s.id,
    s.full_name,
    (
      select string_agg(b.name, ', ' order by b.name)
      from public.student_batches sb
      join public.batches b on b.id = sb.batch_id
      where sb.student_id = s.id and sb.status = 'active'
    ),
    l.name,
    (
      select count(*) from public.student_skills ss2
      where ss2.student_id = s.id and ss2.status = 'achieved'
        and ss2.updated_at::date between p_from and p_to
    ),
    (select count(*) from public.skills sk where sk.level_id = s.current_level_id),
    round(100.0 * coalesce(att.attended, 0) / nullif(att.counted, 0), 1)
  from public.students s
  left join public.levels l on l.id = s.current_level_id
  left join att on att.student_id = s.id
  where s.status = 'active'
    and (
      p_batch_id is null or exists (
        select 1 from public.student_batches sb
        where sb.student_id = s.id and sb.batch_id = p_batch_id and sb.status = 'active'
      )
    )
  order by s.full_name;
$$;


-- ## 9. coach_activity_report ---------------------------------------------------

create or replace function public.coach_activity_report(
  p_from     date,
  p_to       date,
  p_batch_id uuid default null
)
returns table (
  coach_id       uuid,
  coach_name     text,
  batch_names    text,
  session_count  bigint,
  student_count  bigint,
  attendance_pct numeric
)
language sql stable
as $$
  select
    c.id,
    p.full_name,
    (
      select string_agg(distinct b.name, ', ' order by b.name)
      from public.batches b
      where b.coach_id = c.id and b.status = 'active'
    ),
    count(distinct ss.id) filter (where ss.status <> 'cancelled'),
    count(distinct a.student_id),
    round(100.0 * count(*) filter (where a.status in ('present', 'late'))
          / nullif(count(*) filter (where a.status in ('present', 'absent', 'late')), 0), 1)
  from public.coaches c
  join public.profiles p on p.id = c.profile_id
  left join public.schedule_sessions ss on ss.coach_id = c.id
    and ss.session_date between p_from and p_to
    and (p_batch_id is null or ss.batch_id = p_batch_id)
  left join public.attendance a on a.session_id = ss.id
  where c.status = 'active'
  group by c.id, p.full_name
  order by p.full_name;
$$;
