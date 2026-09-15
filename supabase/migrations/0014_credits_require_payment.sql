-- =============================================================================
-- 0014_credits_require_payment.sql
-- =============================================================================
-- Run once after 0013_class_credit_balance_null_for_uncredited.sql. Adds:
--   1. class_credit_balance() now only counts credits from a PAID (or
--      waived) fee — a pending/overdue period contributes zero credits
--      until it's paid, gating booking behind payment
--   2. book_class_slot() gives a clearer error when the reason is an
--      unpaid fee specifically, not just "no credits"
--   3. class_credit_summary() — a granted/booked/bonus/available
--      breakdown for the admin side (class_credit_balance stays a plain
--      integer so nothing that already calls it needs to change)
-- =============================================================================


-- ## 1. class_credit_balance: only paid/waived periods count --------------------
-- The "does this student use the booking system at all" check still looks
-- at every credits_granted row regardless of payment status, so the
-- booking UI still shows up (as "0 left") for an unpaid student instead of
-- disappearing entirely — the parent should see *why* they can't book.

create or replace function public.class_credit_balance(p_student_id uuid)
returns integer
language sql stable
as $$
  select
    case
      when not exists (
        select 1 from public.student_fees
        where student_id = p_student_id and credits_granted is not null
      ) then null
      else
        coalesce((select sum(credits_granted) from public.student_fees
                  where student_id = p_student_id
                    and status in ('paid', 'waived')), 0)
        - coalesce((select count(*) from public.class_bookings
                    where student_id = p_student_id and status = 'booked'), 0)
        + coalesce((select count(*) from public.makeup_credits
                    where student_id = p_student_id and status = 'pending'), 0)
    end;
$$;


-- ## 2. book_class_slot: distinguish "unpaid" from "exhausted" ------------------

create or replace function public.book_class_slot(p_session_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_session  public.schedule_sessions%rowtype;
  v_student_id uuid;
  v_booking  public.class_bookings%rowtype;
begin
  select * into v_session from public.schedule_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'This session is not open for booking';
  end if;
  if v_session.session_date < current_date then
    raise exception 'This session has already passed';
  end if;

  select sb.student_id into v_student_id
  from public.student_batches sb
  where sb.batch_id = v_session.batch_id
    and sb.status = 'active'
    and sb.student_id = any (public.parent_student_ids())
  limit 1;

  if v_student_id is null then
    raise exception 'No student of yours is enrolled in this batch';
  end if;

  if coalesce(public.class_credit_balance(v_student_id), 0) <= 0 then
    if exists (
      select 1 from public.student_fees
      where student_id = v_student_id
        and credits_granted is not null
        and status in ('pending', 'overdue')
    ) then
      raise exception 'Pay this period''s fee to unlock class credits';
    else
      raise exception 'No class credits remaining';
    end if;
  end if;

  insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at)
  values (v_session.academy_id, v_student_id, p_session_id, 'booked', now(), null)
  on conflict (student_id, session_id) do update
    set status = 'booked', booked_at = now(), cancelled_at = null
    where class_bookings.status = 'cancelled'
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'This class is already booked';
  end if;

  return v_booking;
end;
$$;


-- ## 3. class_credit_summary — admin-facing breakdown ----------------------------
-- SECURITY INVOKER; class_bookings/makeup_credits/student_fees RLS already
-- restricts an admin to their own academy's students. Same math as
-- class_credit_balance(), just broken into its parts for visibility.

create or replace function public.class_credit_summary(p_student_id uuid)
returns table (
  granted   integer,
  booked    integer,
  bonus     integer,
  available integer
)
language sql stable
as $$
  select
    coalesce((select sum(credits_granted) from public.student_fees
              where student_id = p_student_id and status in ('paid', 'waived')), 0),
    coalesce((select count(*) from public.class_bookings
              where student_id = p_student_id and status = 'booked'), 0),
    coalesce((select count(*) from public.makeup_credits
              where student_id = p_student_id and status = 'pending'), 0),
    public.class_credit_balance(p_student_id);
$$;
