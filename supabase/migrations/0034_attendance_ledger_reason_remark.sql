-- =============================================================================
-- 0034_attendance_ledger_reason_remark.sql
-- =============================================================================
-- Follow-up to 0033 (BUG-016): a skater marked absent and then corrected to
-- present had their booking cancelled by the first mark, so the second read
-- "Attended without booking". A skater who ever booked the class (a row the
-- parent created, whatever its status now) is "Marked present"; only a
-- skater with no booking row at all is a walk-in.
-- =============================================================================

create or replace function public.attendance_credit_truth()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_had_booking boolean;
begin
  if not public.student_uses_credits(new.student_id) then
    return null;
  end if;

  select exists (
    select 1 from public.class_bookings
    where student_id = new.student_id and session_id = new.session_id
      and (status in ('booked', 'pending') or source = 'parent')
  ) into v_had_booking;

  if new.status in ('present', 'late') then
    perform set_config('app.ledger_reason',
      case when v_had_booking then 'Marked present' else 'Attended without booking' end, true);
    insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at, source)
    values (new.academy_id, new.student_id, new.session_id, 'booked', now(), null, 'attendance')
    on conflict (student_id, session_id) do update
      set status = 'booked', cancelled_at = null,
          source = case when class_bookings.source = 'parent' then 'parent' else 'attendance' end,
          decided_by = coalesce(class_bookings.decided_by, auth.uid()),
          decided_at = coalesce(class_bookings.decided_at, now())
      where class_bookings.status in ('cancelled', 'pending', 'rejected');
  else
    perform set_config('app.ledger_reason', 'Marked absent — class returned', true);
    update public.class_bookings
       set status = 'cancelled', cancelled_at = now()
     where student_id = new.student_id
       and session_id = new.session_id
       and status in ('booked', 'pending');
  end if;
  perform set_config('app.ledger_reason', '', true);
  return null;
end;
$$;
