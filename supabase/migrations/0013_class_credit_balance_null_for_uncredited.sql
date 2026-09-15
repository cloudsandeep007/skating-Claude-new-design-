-- =============================================================================
-- 0013_class_credit_balance_null_for_uncredited.sql
-- =============================================================================
-- Fixes class_credit_balance() (0012) to return null for a student who has
-- never had a batch-scoped plan generate credits, instead of 0 — 0 and
-- "not applicable" were indistinguishable before this, which broke the
-- frontend's "does this student even use the booking system" check.
-- =============================================================================

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
        coalesce((select sum(credits_granted) from public.student_fees where student_id = p_student_id), 0)
        - coalesce((select count(*) from public.class_bookings
                    where student_id = p_student_id and status = 'booked'), 0)
        + coalesce((select count(*) from public.makeup_credits
                    where student_id = p_student_id and status = 'pending'), 0)
    end;
$$;
