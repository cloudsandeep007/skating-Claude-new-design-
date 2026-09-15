-- =============================================================================
-- 0023_adjust_class_credits.sql
-- =============================================================================
-- The one manual lever on the credit ledger: an admin adds or removes
-- classes with a written reason (goodwill, a correction, a class taught
-- outside the schedule). Append-only like everything else in the ledger —
-- a mistake in an adjustment is fixed by another adjustment, never by
-- editing. Shows up on the skater's statement with the reason and who did it.
-- =============================================================================

create or replace function public.adjust_class_credits(
  p_student_id uuid,
  p_delta      integer,
  p_reason     text
)
returns public.credit_ledger
language plpgsql security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_row     public.credit_ledger%rowtype;
begin
  select * into v_student from public.students where id = p_student_id;
  if not found then
    raise exception 'Skater not found';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_academy_admin() and v_student.academy_id = public.current_academy_id())
  ) then
    raise exception 'Only an admin of this academy can adjust credits';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'Enter how many classes to add (positive) or remove (negative)';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to adjust credits';
  end if;

  insert into public.credit_ledger (academy_id, student_id, delta, kind, reason, actor_id)
  values (v_student.academy_id, p_student_id, p_delta, 'adjust', btrim(p_reason), auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;
