-- =============================================================================
-- 0015_class_credit_balances_bulk.sql
-- =============================================================================
-- Run once after 0014_credits_require_payment.sql. Adds:
--   1. class_credit_balances(p_student_ids[]) — the same balance as
--      class_credit_balance(), for a whole page of students in one round
--      trip instead of one RPC call per row (the admin students list)
-- =============================================================================

create or replace function public.class_credit_balances(p_student_ids uuid[])
returns table (student_id uuid, available integer)
language sql stable
as $$
  select s.id, public.class_credit_balance(s.id)
  from public.students s
  where s.id = any (p_student_ids);
$$;
