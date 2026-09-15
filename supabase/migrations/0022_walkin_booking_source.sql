-- =============================================================================
-- 0022_walkin_booking_source.sql
-- =============================================================================
-- A walk-in (marked present with no active booking) that re-activates an
-- old cancelled booking kept that booking's original source ('parent'), so
-- the ledger line read "Class booked" instead of "Attended without booking".
-- Re-activation now stamps source = 'attendance'. (0021 on disk carries the
-- same fix for fresh installs; this brings an already-migrated database in
-- line.)
-- =============================================================================

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
      set status = 'booked', cancelled_at = null, source = 'attendance'
      where class_bookings.status = 'cancelled';
  else
    update public.class_bookings
       set status = 'cancelled', cancelled_at = now()
     where student_id = new.student_id
       and session_id = new.session_id
       and status = 'booked';
  end if;
  return null;
end;
$$;
