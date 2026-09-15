-- =============================================================================
-- 0010_fee_batch_plans_and_reminders.sql — batch-scoped fee plans + reminders
-- =============================================================================
-- Adds:
--   1. fee_plans.batch_id — optional; null means "academy-wide" (today's only
--      behavior, unchanged for every existing row). Purely an organizing/
--      filtering field for the plan picker — generate_upcoming_fees() still
--      reads a student's explicit fee_plan_id assignment, so this never makes
--      billing ambiguous for a student in more than one batch.
--   2. student_fees.last_reminded_at — set by send_fee_reminders(), shown in
--      the admin fee list so a reminder isn't sent blind twice in a row.
--   3. send_fee_reminders(fee_ids[]) — one notifications row per parent
--      linked to each fee's student, reusing the existing notifications
--      delivery pipeline (realtime toast + unread badge) that
--      'session_cancelled' notifications already use the same way.
--   4. student_fees_list() gains last_reminded_at in its return shape.
-- =============================================================================


-- ## 1. Batch-scoped fee plans --------------------------------------------------

alter table public.fee_plans
  add column batch_id uuid;

alter table public.fee_plans
  add constraint fee_plans_batch_id_fkey
  foreign key (batch_id, academy_id) references public.batches (id, academy_id)
  on delete set null (batch_id);

create index fee_plans_batch_idx on public.fee_plans (batch_id);


-- ## 2. Reminder tracking ---------------------------------------------------------

alter table public.student_fees
  add column last_reminded_at timestamptz;


-- ## 3. send_fee_reminders ---------------------------------------------------------
-- SECURITY DEFINER because it inserts notifications for other users (the
-- parents), which they couldn't do under their own RLS — same reasoning as
-- publish_due_announcements(). Scoped to: caller must be an academy_admin,
-- and every fee id must belong to the caller's own academy; anything outside
-- that is silently skipped, not an error, so a stale/foreign id in the input
-- array can't be used to probe another academy's data.

create or replace function public.send_fee_reminders(p_student_fee_ids uuid[])
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_academy   uuid := public.current_academy_id();
  v_fee       record;
  v_sent      integer := 0;
  v_this_fee  integer;
begin
  if not public.is_academy_admin() or v_academy is null then
    raise exception 'Only an academy admin can send fee reminders';
  end if;

  for v_fee in
    select
      f.id, f.due_date, f.status,
      f.amount - coalesce((select sum(p.amount) from public.payments p where p.student_fee_id = f.id), 0) as balance,
      s.id as student_id, s.full_name
    from public.student_fees f
    join public.students s on s.id = f.student_id
    where f.id = any(p_student_fee_ids)
      and f.academy_id = v_academy
      and f.status in ('pending', 'overdue')
  loop
    insert into public.notifications (academy_id, profile_id, type, title, body, link)
    select
      v_academy,
      ps.parent_profile_id,
      'fee_due',
      'Fee reminder — ' || v_fee.full_name,
      case
        when v_fee.status = 'overdue' then
          '₹' || trim(to_char(v_fee.balance, 'FM99,99,99,999')) || ' overdue since ' || to_char(v_fee.due_date, 'DD Mon YYYY') || '.'
        else
          '₹' || trim(to_char(v_fee.balance, 'FM99,99,99,999')) || ' due ' || to_char(v_fee.due_date, 'DD Mon YYYY') || '.'
      end,
      '/parent/fees'
    from public.parents_students ps
    where ps.student_id = v_fee.student_id;

    get diagnostics v_this_fee = row_count;
    v_sent := v_sent + v_this_fee;

    update public.student_fees set last_reminded_at = now() where id = v_fee.id;
  end loop;

  return v_sent;
end;
$$;


-- ## 4. student_fees_list gains last_reminded_at -----------------------------------
-- Return shape changed (new OUT column), so Postgres requires a drop first —
-- create or replace alone can't widen a function's result columns.

drop function public.student_fees_list(public.fee_status, date, uuid);

create function public.student_fees_list(
  p_status   public.fee_status default null,
  p_month    date default null,
  p_batch_id uuid default null
)
returns table (
  student_fee_id   uuid,
  student_id       uuid,
  full_name        text,
  batch_names      text,
  fee_plan_name    text,
  period_start     date,
  period_end       date,
  due_date         date,
  amount           numeric,
  paid             numeric,
  balance          numeric,
  status           public.fee_status,
  last_reminded_at timestamptz
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
    f.period_start,
    f.period_end,
    f.due_date,
    f.amount,
    coalesce(pay.paid, 0),
    f.amount - coalesce(pay.paid, 0),
    f.status,
    f.last_reminded_at
  from public.student_fees f
  join public.students s on s.id = f.student_id
  left join public.fee_plans fp on fp.id = f.fee_plan_id
  left join lateral (
    select sum(p.amount) as paid from public.payments p where p.student_fee_id = f.id
  ) pay on true
  where (p_status is null or f.status = p_status)
    and (p_month is null or date_trunc('month', f.due_date) = date_trunc('month', p_month))
    and (
      p_batch_id is null or exists (
        select 1 from public.student_batches sb
        where sb.student_id = s.id and sb.batch_id = p_batch_id and sb.status = 'active'
      )
    )
  order by f.due_date desc, s.full_name;
$$;
