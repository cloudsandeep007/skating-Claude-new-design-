-- =============================================================================
-- 0036_credits_reserved_vs_attended_and_join_date_guard.sql
-- =============================================================================
-- A balance that drops at booking looked like a double charge when the same
-- skater was later marked present on an *unbooked* (walk-in) class. Two
-- changes so the numbers explain themselves and the accidental case can't
-- happen:
--
--   1. class_credit_summary() also reports `reserved` (credits held by
--      bookings on classes not yet marked) and `attended` (classes actually
--      taken), so every screen can say "bought · attended · booked ahead ·
--      left" instead of a bare "spent".
--   2. Attendance can't be recorded for a session that took place before the
--      skater joined — that is how a brand-new skater got charged for two
--      classes from the previous week.
-- =============================================================================

drop function if exists public.class_credit_summary(uuid);

create function public.class_credit_summary(p_student_id uuid)
returns table (
  granted     integer,
  spent       integer,
  refunded    integer,
  expired     integer,
  adjusted    integer,
  available   integer,
  term_end    date,
  term_status text,
  /** Credits held by bookings (pending or confirmed) on classes not yet marked. */
  reserved    integer,
  /** Classes attended: a live booking whose session has a present/late mark. */
  attended    integer
)
language sql stable
as $$
  select
    coalesce((select sum(delta) from public.credit_ledger where student_id = p_student_id and kind in ('grant', 'clawback')), 0)::integer,
    coalesce((select -sum(delta) from public.credit_ledger where student_id = p_student_id and kind = 'spend'), 0)::integer,
    coalesce((select sum(delta) from public.credit_ledger where student_id = p_student_id and kind = 'refund'), 0)::integer,
    coalesce((select -sum(delta) from public.credit_ledger where student_id = p_student_id and kind = 'expire'), 0)::integer,
    coalesce((select sum(delta) from public.credit_ledger where student_id = p_student_id and kind = 'adjust'), 0)::integer,
    public.class_credit_balance(p_student_id),
    (select ps.term_end from public.credit_plan_status(p_student_id) ps),
    (select ps.term_status from public.credit_plan_status(p_student_id) ps),
    (select count(*)::integer
       from public.class_bookings b
      where b.student_id = p_student_id
        and b.status in ('booked', 'pending')
        and not exists (select 1 from public.attendance a
                        where a.session_id = b.session_id and a.student_id = b.student_id
                          and a.status in ('present', 'late'))),
    (select count(*)::integer
       from public.class_bookings b
       join public.attendance a on a.session_id = b.session_id and a.student_id = b.student_id
      where b.student_id = p_student_id
        and b.status = 'booked'
        and a.status in ('present', 'late'));
$$;

grant execute on function public.class_credit_summary(uuid) to authenticated;


-- ## 2. No attendance before the skater joined -------------------------------------------

create or replace function public.attendance_after_join()
returns trigger
language plpgsql
as $$
declare
  v_joined date;
  v_date   date;
  v_name   text;
begin
  select st.joined_date, st.full_name into v_joined, v_name
    from public.students st where st.id = new.student_id;
  select ss.session_date into v_date
    from public.schedule_sessions ss where ss.id = new.session_id;
  if v_date < v_joined then
    raise exception '% joined on % — a class on % can''t be marked for them',
      v_name, to_char(v_joined, 'DD Mon'), to_char(v_date, 'DD Mon');
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_after_join on public.attendance;
create trigger attendance_after_join
  before insert on public.attendance
  for each row execute function public.attendance_after_join();
