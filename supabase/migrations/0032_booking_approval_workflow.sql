-- =============================================================================
-- 0032_booking_approval_workflow.sql
-- =============================================================================
-- A parent's booking is now a *request* that the batch coach or an academy
-- admin approves. Statuses:
--
--   pending   — requested by the parent, credit held, awaiting a decision
--   booked    — approved (or auto-approved / walk-in) — the place is theirs
--   rejected  — declined by coach/admin, credit returned, reason kept
--   cancelled — cancelled by the parent, the academy, or a rule
--
-- Design choices (see DECISIONS.md, 2026-09-19):
--   * The credit is HELD when the request is made and returned if it is
--     declined or cancelled. This keeps the balance honest (a family cannot
--     request 10 classes on 2 credits) and needs no new ledger kinds —
--     'pending' counts as spent, 'rejected' as refunded.
--   * Existing 'booked' rows are untouched: they were approved under the old
--     rule. Walk-ins recorded at marking stay 'booked' (the coach marked them
--     present, which is the strongest approval there is).
--   * Attendance is still the last word: a pending request that is marked
--     present becomes 'booked'; one never marked is released at completion.
--   * academies.settings.booking_approval_required (default true) lets an
--     academy switch back to instant booking without a code change.
--
-- Who may decide: an academy admin, or the coach on the session (or the
-- batch's coach when the session has none).
-- =============================================================================


-- ## 1. Schema ------------------------------------------------------------------

alter table public.class_bookings drop constraint if exists class_bookings_status_check;
alter table public.class_bookings
  add constraint class_bookings_status_check
  check (status in ('pending', 'booked', 'rejected', 'cancelled'));

alter table public.class_bookings
  add column if not exists decided_by    uuid references public.profiles (id) on delete set null,
  add column if not exists decided_at    timestamptz,
  add column if not exists decision_note text;

comment on column public.class_bookings.decided_by is
  'Who approved or declined this request (null for auto-approved / walk-in / legacy rows).';
comment on column public.class_bookings.decision_note is
  'Reason given when a request was declined; shown to the parent.';


-- ## 2. Helpers ---------------------------------------------------------------------

create or replace function public.booking_approval_required(p_academy_id uuid)
returns boolean
language sql stable
as $$
  select coalesce((select (settings->>'booking_approval_required')::boolean
                   from public.academies where id = p_academy_id), true);
$$;

-- The coach record for the signed-in user, or null.
create or replace function public.my_coach_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select c.id from public.coaches c where c.profile_id = auth.uid() limit 1;
$$;

-- The coach responsible for a session: the session's own coach, else the
-- batch's coach.
create or replace function public.session_coach_id(p_session_id uuid)
returns uuid
language sql stable
as $$
  select coalesce(ss.coach_id, b.coach_id)
  from public.schedule_sessions ss
  join public.batches b on b.id = ss.batch_id
  where ss.id = p_session_id;
$$;

create or replace function public.can_decide_booking(p_session_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_academy_admin()
      or (public.is_coach() and public.session_coach_id(p_session_id) = public.my_coach_id());
$$;


-- ## 3. Ledger: pending holds a credit, rejected returns it -------------------------

create or replace function public.ledger_sync_booking(p_booking_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_b   public.class_bookings%rowtype;
  v_net integer;
begin
  select * into v_b from public.class_bookings where id = p_booking_id;
  if not found then
    return;
  end if;

  select coalesce(sum(delta), 0) into v_net
  from public.credit_ledger
  where booking_id = p_booking_id and kind in ('spend', 'refund');

  if v_b.status in ('booked', 'pending') and v_net = 0 then
    insert into public.credit_ledger (academy_id, student_id, delta, kind, booking_id, reason, actor_id)
    values (v_b.academy_id, v_b.student_id, -1, 'spend', p_booking_id,
            case
              when v_b.source = 'attendance' then 'Attended without booking'
              when v_b.status = 'pending'    then 'Class requested'
              else 'Class booked'
            end,
            auth.uid());
  elsif v_b.status in ('cancelled', 'rejected') and v_net < 0 then
    insert into public.credit_ledger (academy_id, student_id, delta, kind, booking_id, reason, actor_id)
    values (v_b.academy_id, v_b.student_id, 1, 'refund', p_booking_id,
            case when v_b.status = 'rejected' then 'Request declined' else 'Booking cancelled' end,
            auth.uid());
  end if;
end;
$$;


-- ## 4. Requesting and cancelling (parent) ---------------------------------------------

create or replace function public.book_class_slot(p_session_id uuid, p_student_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_session  public.schedule_sessions%rowtype;
  v_booking  public.class_bookings%rowtype;
  v_status   record;
  v_today    date;
  v_needs    boolean;
  v_student  text;
  v_batch    text;
  v_coach_pr uuid;
begin
  if not (p_student_id = any (public.parent_student_ids())) then
    raise exception 'That skater is not linked to your account';
  end if;

  select * into v_session from public.schedule_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'This session is not open for booking';
  end if;

  v_today := public.academy_today(v_session.academy_id);
  if v_session.session_date < v_today then
    raise exception 'This session has already passed';
  end if;

  if not exists (
    select 1 from public.student_batches sb
    where sb.batch_id = v_session.batch_id
      and sb.student_id = p_student_id
      and sb.status = 'active'
  ) then
    raise exception 'This skater is not enrolled in this batch';
  end if;

  perform 1 from public.students where id = p_student_id for update;

  select * into v_status from public.credit_plan_status(p_student_id);

  if v_session.session_date > v_today + v_status.booking_window_days then
    raise exception 'Classes open for booking % days ahead — this one opens on %',
      v_status.booking_window_days,
      to_char(v_session.session_date - v_status.booking_window_days, 'DD Mon');
  end if;

  if v_status.term_status = 'expired' then
    raise exception 'The plan ended on % — top up at the academy to renew it',
      to_char(v_status.term_end, 'DD Mon');
  end if;

  if coalesce(v_status.available, 0) <= 0 then
    if v_status.pricing_mode = 'per_class' then
      if coalesce(v_status.available, 0) < 0 then
        raise exception 'This skater owes % class% from attending without credits — top up at the academy first',
          -v_status.available, case when v_status.available = -1 then '' else 'es' end;
      end if;
      raise exception 'No classes left — top up at the academy to book';
    elsif exists (
      select 1 from public.student_fees
      where student_id = p_student_id
        and credits_granted is not null
        and status in ('pending', 'overdue')
    ) then
      raise exception 'Pay this period''s fee to unlock class credits';
    else
      raise exception 'No class credits remaining';
    end if;
  end if;

  v_needs := public.booking_approval_required(v_session.academy_id);

  insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at, source,
                                     decided_by, decided_at, decision_note)
  values (v_session.academy_id, p_student_id, p_session_id,
          case when v_needs then 'pending' else 'booked' end, now(), null, 'parent', null, null, null)
  on conflict (student_id, session_id) do update
    set status = case when v_needs then 'pending' else 'booked' end,
        booked_at = now(), cancelled_at = null, source = 'parent',
        decided_by = null, decided_at = null, decision_note = null
    where class_bookings.status in ('cancelled', 'rejected')
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'This class is already requested or booked';
  end if;

  -- Tell the coach (or the admins when the session has no coach) that a
  -- request is waiting.
  if v_needs then
    select st.full_name, b.name into v_student, v_batch
    from public.students st, public.batches b
    where st.id = p_student_id and b.id = v_session.batch_id;

    select c.profile_id into v_coach_pr
    from public.coaches c where c.id = public.session_coach_id(p_session_id);

    if v_coach_pr is not null then
      insert into public.notifications (academy_id, profile_id, type, title, body, link)
      values (v_session.academy_id, v_coach_pr, 'booking_request',
              'Booking request — ' || v_student,
              v_batch || ' · ' || to_char(v_session.session_date, 'Dy DD Mon') || ' at '
                || to_char(v_session.start_time, 'HH12:MI AM') || '. Approve or decline in Bookings.',
              '/coach/bookings');
    else
      insert into public.notifications (academy_id, profile_id, type, title, body, link)
      select v_session.academy_id, p.id, 'booking_request',
             'Booking request — ' || v_student,
             v_batch || ' · ' || to_char(v_session.session_date, 'Dy DD Mon') || ' at '
               || to_char(v_session.start_time, 'HH12:MI AM') || '. Approve or decline in Bookings.',
             '/admin/schedule/bookings'
      from public.profiles p
      where p.academy_id = v_session.academy_id and p.role = 'academy_admin';
    end if;
  end if;

  return v_booking;
end;
$$;

create or replace function public.cancel_class_slot(p_session_id uuid, p_student_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_booking public.class_bookings%rowtype;
begin
  if not (p_student_id = any (public.parent_student_ids())) then
    raise exception 'That skater is not linked to your account';
  end if;

  select * into v_session from public.schedule_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'This class has already been marked — the credit is no longer refundable';
  end if;

  update public.class_bookings
     set status = 'cancelled', cancelled_at = now()
   where session_id = p_session_id
     and student_id = p_student_id
     and status in ('booked', 'pending')
   returning * into v_booking;

  if not found then
    raise exception 'No active booking found for this class';
  end if;

  return v_booking;
end;
$$;


-- ## 5. Deciding (coach / admin) --------------------------------------------------------

create or replace function public.approve_booking(p_booking_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_b       public.class_bookings%rowtype;
  v_session public.schedule_sessions%rowtype;
  v_batch   text;
begin
  select * into v_b from public.class_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if not public.can_decide_booking(v_b.session_id) then
    raise exception 'Only the batch coach or an academy admin can approve bookings';
  end if;
  if v_b.status = 'booked' then
    return v_b;
  end if;
  if v_b.status <> 'pending' then
    raise exception 'Only a pending request can be approved';
  end if;

  select * into v_session from public.schedule_sessions where id = v_b.session_id;
  if v_session.status <> 'scheduled' then
    raise exception 'This session is no longer open';
  end if;

  update public.class_bookings
     set status = 'booked', decided_by = auth.uid(), decided_at = now(), decision_note = null
   where id = p_booking_id
   returning * into v_b;

  select name into v_batch from public.batches where id = v_session.batch_id;
  perform public.notify_parents_of(
    v_b.student_id, 'booking_approved',
    'Booking confirmed — ' || v_batch,
    to_char(v_session.session_date, 'Dy DD Mon') || ' at ' || to_char(v_session.start_time, 'HH12:MI AM')
      || ' is confirmed. See you at the rink!',
    '/parent/schedule');

  return v_b;
end;
$$;

create or replace function public.reject_booking(p_booking_id uuid, p_note text default null)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_b       public.class_bookings%rowtype;
  v_session public.schedule_sessions%rowtype;
  v_batch   text;
begin
  select * into v_b from public.class_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if not public.can_decide_booking(v_b.session_id) then
    raise exception 'Only the batch coach or an academy admin can decline bookings';
  end if;
  if v_b.status not in ('pending', 'booked') then
    raise exception 'Only a pending or confirmed booking can be declined';
  end if;

  select * into v_session from public.schedule_sessions where id = v_b.session_id;
  if v_session.status <> 'scheduled' then
    raise exception 'This session has already been marked';
  end if;

  update public.class_bookings
     set status = 'rejected', decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_booking_id
   returning * into v_b;

  select name into v_batch from public.batches where id = v_session.batch_id;
  perform public.notify_parents_of(
    v_b.student_id, 'booking_declined',
    'Booking declined — ' || v_batch,
    to_char(v_session.session_date, 'Dy DD Mon') || ' at ' || to_char(v_session.start_time, 'HH12:MI AM')
      || ' could not be confirmed'
      || case when v_b.decision_note is null then '' else ': ' || v_b.decision_note end
      || '. The class credit is back in your balance.',
    '/parent/schedule');

  return v_b;
end;
$$;

-- Approve everything still waiting on one session.
create or replace function public.approve_session_bookings(p_session_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_count integer := 0;
begin
  if not public.can_decide_booking(p_session_id) then
    raise exception 'Only the batch coach or an academy admin can approve bookings';
  end if;
  for v_id in
    select id from public.class_bookings where session_id = p_session_id and status = 'pending'
  loop
    perform public.approve_booking(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


-- ## 6. The queue -----------------------------------------------------------------------

-- Requests and recent decisions on upcoming sessions. A coach sees their own
-- sessions; an admin sees the academy. p_status: 'pending' | 'decided' | 'all'.
create or replace function public.booking_requests(p_status text default 'pending', p_days integer default 30)
returns table (
  booking_id    uuid,
  status        text,
  source        text,
  requested_at  timestamptz,
  decided_at    timestamptz,
  decided_by    text,
  decision_note text,
  session_id    uuid,
  session_date  date,
  start_time    time,
  end_time      time,
  batch_id      uuid,
  batch_name    text,
  venue         text,
  coach_name    text,
  student_id    uuid,
  full_name     text,
  photo_url     text,
  credits_left  integer
)
language sql stable security definer
set search_path = public
as $$
  select
    cb.id, cb.status, cb.source, cb.booked_at, cb.decided_at,
    (select full_name from public.profiles where id = cb.decided_by),
    cb.decision_note,
    ss.id, ss.session_date, ss.start_time, ss.end_time,
    b.id, b.name, b.venue,
    (select p.full_name from public.coaches c join public.profiles p on p.id = c.profile_id
      where c.id = coalesce(ss.coach_id, b.coach_id)),
    st.id, st.full_name, st.photo_url,
    public.class_credit_balance(st.id)
  from public.class_bookings cb
  join public.schedule_sessions ss on ss.id = cb.session_id
  join public.batches b on b.id = ss.batch_id
  join public.students st on st.id = cb.student_id
  where cb.academy_id = public.current_academy_id()
    and ss.session_date between public.academy_today(cb.academy_id) - 7
                            and public.academy_today(cb.academy_id) + p_days
    and (
      public.is_academy_admin()
      or (public.is_coach() and coalesce(ss.coach_id, b.coach_id) = public.my_coach_id())
    )
    and case p_status
          when 'pending' then cb.status = 'pending' and ss.status = 'scheduled'
          when 'decided' then cb.status in ('booked', 'rejected') and cb.decided_at is not null
          else true
        end
  order by
    case when cb.status = 'pending' then 0 else 1 end,
    ss.session_date, ss.start_time, b.name, st.full_name;
$$;

create or replace function public.pending_booking_count()
returns integer
language sql stable security definer
set search_path = public
as $$
  select count(*)::integer
  from public.class_bookings cb
  join public.schedule_sessions ss on ss.id = cb.session_id
  join public.batches b on b.id = ss.batch_id
  where cb.academy_id = public.current_academy_id()
    and cb.status = 'pending'
    and ss.status = 'scheduled'
    and ss.session_date >= public.academy_today(cb.academy_id)
    and (
      public.is_academy_admin()
      or (public.is_coach() and coalesce(ss.coach_id, b.coach_id) = public.my_coach_id())
    );
$$;


-- ## 7. Everything that used to mean "status = 'booked'" ------------------------------------

-- Attendance is the last word: present → booked (whatever it was), absent →
-- released (pending or booked).
create or replace function public.attendance_credit_truth()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.student_uses_credits(new.student_id) then
    return null;
  end if;

  if new.status in ('present', 'late') then
    insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at, source)
    values (new.academy_id, new.student_id, new.session_id, 'booked', now(), null, 'attendance')
    on conflict (student_id, session_id) do update
      set status = 'booked', cancelled_at = null,
          source = case when class_bookings.status = 'pending' then class_bookings.source else 'attendance' end,
          decided_by = coalesce(class_bookings.decided_by, auth.uid()),
          decided_at = coalesce(class_bookings.decided_at, now())
      where class_bookings.status in ('cancelled', 'pending', 'rejected');
  else
    update public.class_bookings
       set status = 'cancelled', cancelled_at = now()
     where student_id = new.student_id
       and session_id = new.session_id
       and status in ('booked', 'pending');
  end if;
  return null;
end;
$$;

create or replace function public.resolve_session_bookings(p_session_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with released as (
    update public.class_bookings b
       set status = 'cancelled', cancelled_at = now()
     where b.session_id = p_session_id
       and b.status in ('booked', 'pending')
       and not exists (
         select 1 from public.attendance a
         where a.session_id = b.session_id and a.student_id = b.student_id
       )
    returning 1
  )
  select count(*)::integer into v_count from released;
  return v_count;
end;
$$;

-- Who's coming: confirmed and requested, with the status so the admin can
-- tell them apart.
drop function if exists public.upcoming_bookings(integer);
create or replace function public.upcoming_bookings(p_days integer default 7)
returns table (
  session_id   uuid,
  session_date date,
  start_time   time,
  end_time     time,
  batch_id     uuid,
  batch_name   text,
  venue        text,
  coach_name   text,
  student_id   uuid,
  full_name    text,
  photo_url    text,
  source       text,
  status       text
)
language sql stable
as $$
  select
    ss.id, ss.session_date, ss.start_time, ss.end_time,
    b.id, b.name, b.venue,
    (select p.full_name from public.coaches c join public.profiles p on p.id = c.profile_id
      where c.id = coalesce(ss.coach_id, b.coach_id)),
    st.id, st.full_name, st.photo_url,
    cb.source, cb.status
  from public.schedule_sessions ss
  join public.batches b on b.id = ss.batch_id
  join public.class_bookings cb on cb.session_id = ss.id and cb.status in ('booked', 'pending')
  join public.students st on st.id = cb.student_id
  where ss.status = 'scheduled'
    and ss.session_date between current_date and current_date + p_days
  order by ss.session_date, ss.start_time, b.name, cb.status desc, st.full_name;
$$;

-- Cancelling a session releases requests too.
create or replace function public.cancel_session(
  p_session_id uuid,
  p_reason     text
)
returns void
language plpgsql
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_batch_name text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A cancellation reason is required';
  end if;

  update public.schedule_sessions
     set status = 'cancelled', cancellation_reason = btrim(p_reason)
   where id = p_session_id and status = 'scheduled'
   returning * into v_session;

  if not found then
    raise exception 'Only a scheduled session can be cancelled';
  end if;

  update public.class_bookings
     set status = 'cancelled', cancelled_at = now()
   where session_id = p_session_id and status in ('booked', 'pending');

  select name into v_batch_name from public.batches where id = v_session.batch_id;

  insert into public.notifications (academy_id, profile_id, type, title, body, link)
  select distinct
    v_session.academy_id,
    ps.parent_profile_id,
    'session_cancelled',
    'Session cancelled: ' || v_batch_name,
    to_char(v_session.session_date, 'Dy DD Mon') || ' at '
      || to_char(v_session.start_time, 'HH12:MI AM') || ' — ' || btrim(p_reason),
    '/parent'
  from public.student_batches sb
  join public.parents_students ps on ps.student_id = sb.student_id
  where sb.batch_id = v_session.batch_id
    and sb.status = 'active';
end;
$$;

-- Clawback and release rules count requests as bookings (they hold credits).
create or replace function public.clawback_preview(p_student_id uuid, p_credits_removed integer)
returns table (
  shortfall  integer,
  booking_id uuid,
  session_id uuid,
  session_date date,
  start_time time,
  batch_name text
)
language sql stable
as $$
  with bal as (
    select coalesce(public.class_credit_balance(p_student_id), 0) - coalesce(p_credits_removed, 0) as after
  ),
  need as (
    select greatest(-after, 0)::integer as shortfall from bal
  ),
  future as (
    select b.id, b.session_id, ss.session_date, ss.start_time, bt.name,
           row_number() over (order by ss.session_date desc, ss.start_time desc) as rn
    from public.class_bookings b
    join public.schedule_sessions ss on ss.id = b.session_id
    join public.batches bt on bt.id = ss.batch_id
    where b.student_id = p_student_id
      and b.status in ('booked', 'pending')
      and ss.status = 'scheduled'
      and ss.session_date >= current_date
  )
  select need.shortfall, f.id, f.session_id, f.session_date, f.start_time, f.name
  from need
  left join future f on f.rn <= need.shortfall
  order by f.session_date, f.start_time;
$$;

create or replace function public.cancel_bookings_for_shortfall(p_student_id uuid, p_reason text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_student  public.students%rowtype;
  v_short    integer;
  v_ids      uuid[];
  v_dates    text;
  v_count    integer := 0;
begin
  select * into v_student from public.students where id = p_student_id;
  v_short := greatest(-coalesce(public.class_credit_balance(p_student_id), 0), 0);
  if v_short = 0 then
    return 0;
  end if;

  with future as (
    select b.id, ss.session_date
    from public.class_bookings b
    join public.schedule_sessions ss on ss.id = b.session_id
    where b.student_id = p_student_id
      and b.status in ('booked', 'pending')
      and ss.status = 'scheduled'
      and ss.session_date >= current_date
    order by ss.session_date desc, ss.start_time desc
    limit v_short
  )
  select array_agg(id), string_agg(to_char(session_date, 'DD Mon'), ', ' order by session_date)
    into v_ids, v_dates
  from future;

  if v_ids is null then
    return 0;
  end if;

  update public.class_bookings
     set status = 'cancelled', cancelled_at = now()
   where id = any (v_ids);
  get diagnostics v_count = row_count;

  insert into public.notifications (academy_id, profile_id, type, title, body, link)
  select
    v_student.academy_id,
    x.parent_profile_id,
    'booking_cancelled',
    'Bookings cancelled — ' || v_student.full_name,
    v_count || ' upcoming class' || case when v_count = 1 then '' else 'es' end
      || ' (' || v_dates || ') ' || case when v_count = 1 then 'was' else 'were' end
      || ' cancelled: ' || p_reason || '. Book again once the classes are covered.',
    '/parent/schedule'
  from public.parents_students x
  where x.student_id = p_student_id;

  return v_count;
end;
$$;

create or replace function public.release_future_bookings(p_student_id uuid, p_batch_id uuid default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with released as (
    update public.class_bookings b
       set status = 'cancelled', cancelled_at = now()
      from public.schedule_sessions ss
     where ss.id = b.session_id
       and b.student_id = p_student_id
       and b.status in ('booked', 'pending')
       and ss.status = 'scheduled'
       and ss.session_date >= current_date
       and (p_batch_id is null or ss.batch_id = p_batch_id)
    returning 1
  )
  select count(*)::integer into v_count from released;
  return v_count;
end;
$$;


-- ## 8. Grants ------------------------------------------------------------------------------

grant execute on function public.booking_approval_required(uuid) to authenticated;
grant execute on function public.my_coach_id() to authenticated;
grant execute on function public.session_coach_id(uuid) to authenticated;
grant execute on function public.can_decide_booking(uuid) to authenticated;
grant execute on function public.approve_booking(uuid) to authenticated;
grant execute on function public.reject_booking(uuid, text) to authenticated;
grant execute on function public.approve_session_bookings(uuid) to authenticated;
grant execute on function public.booking_requests(text, integer) to authenticated;
grant execute on function public.pending_booking_count() to authenticated;
grant execute on function public.upcoming_bookings(integer) to authenticated;
