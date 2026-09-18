-- =============================================================================
-- 0031_void_advance_application_returns_it.sql
-- =============================================================================
-- Voiding a payment whose method is 'advance' (a fee covered from the
-- family's advance balance) puts that amount back on the advance ledger
-- instead of losing it. Everything else in void_payment() is unchanged
-- from 0026.
-- =============================================================================

create or replace function public.void_payment(
  p_payment_id      uuid,
  p_reason          text,
  p_cancel_bookings boolean default false
)
returns public.payments
language plpgsql security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_fee     public.student_fees%rowtype;
  v_before  integer;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_academy_admin() and v_payment.academy_id = public.current_academy_id())
  ) then
    raise exception 'Only an admin of this academy can void a payment';
  end if;
  if v_payment.voided_at is not null then
    raise exception 'This payment was already voided';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to void a payment';
  end if;

  select * into v_fee from public.student_fees where id = v_payment.student_fee_id;
  v_before := public.class_credit_balance(v_fee.student_id);

  update public.payments
     set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   where id = p_payment_id
   returning * into v_payment;

  if v_payment.method = 'advance' then
    -- The advance goes back to the family; the nightly sweep (or the next
    -- payment) can apply it again.
    insert into public.student_advances (academy_id, student_id, delta, kind, payment_id, fee_id, reason, actor_id)
    values (v_fee.academy_id, v_fee.student_id, v_payment.amount, 'deposit', v_payment.id, v_fee.id,
            'Returned — advance application voided (' || btrim(p_reason) || ')', auth.uid());
  elsif v_fee.kind = 'topup' then
    -- The top-up is undone, not owed.
    perform set_config('app.fee_write', 'on', true);
    update public.student_fees
       set amount = 0, credits_granted = 0
     where id = v_fee.id;
  end if;

  perform public.rederive_fee_status(v_fee.id);
  perform public.settle_credit_shortfall(
    v_fee.student_id, 'Voiding this payment', v_before, p_cancel_bookings,
    'payment voided (' || btrim(p_reason) || ')'
  );

  return v_payment;
end;
$$;
