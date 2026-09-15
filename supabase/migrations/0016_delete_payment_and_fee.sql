-- =============================================================================
-- 0016_delete_payment_and_fee.sql
-- =============================================================================
-- Run once after 0015_class_credit_balances_bulk.sql. Adds:
--   1. delete_payment() — remove one payment, recomputing the fee's status
--      (paid → pending/overdue as appropriate) instead of leaving it
--      falsely marked paid
--   2. delete_student_fee() — roll back an entire fee period: deletes its
--      payments (payments.student_fee_id is ON DELETE RESTRICT, so this
--      has to happen explicitly, not via cascade) then the period itself
-- Both are SECURITY INVOKER — the existing payments_admin_all /
-- student_fees_admin_all RLS policies are what actually decide whether the
-- caller may. audit_payments / audit_student_fees already log every
-- delete automatically, same as every other write to these tables.
-- =============================================================================

create or replace function public.delete_payment(p_payment_id uuid)
returns void
language plpgsql
as $$
declare
  v_fee_id    uuid;
  v_fee       public.student_fees%rowtype;
  v_remaining numeric;
begin
  select student_fee_id into v_fee_id from public.payments where id = p_payment_id;
  if v_fee_id is null then
    raise exception 'Payment not found';
  end if;

  delete from public.payments where id = p_payment_id;

  select * into v_fee from public.student_fees where id = v_fee_id;
  if not found or v_fee.status = 'waived' then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_remaining
  from public.payments where student_fee_id = v_fee_id;

  update public.student_fees
     set status = case
       when v_remaining >= v_fee.amount then 'paid'
       when v_fee.due_date < current_date then 'overdue'
       else 'pending'
     end
   where id = v_fee_id;
end;
$$;

create or replace function public.delete_student_fee(p_fee_id uuid)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from public.student_fees where id = p_fee_id) then
    raise exception 'Fee not found';
  end if;

  delete from public.payments where student_fee_id = p_fee_id;
  delete from public.student_fees where id = p_fee_id;
end;
$$;
