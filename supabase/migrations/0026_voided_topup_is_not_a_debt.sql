-- =============================================================================
-- 0026_voided_topup_is_not_a_debt.sql
-- =============================================================================
-- A top-up is "the family paid for N classes". If that payment is voided,
-- the top-up didn't happen — it must not turn into a pending/overdue
-- ₹N×rate debt with Record payment / Remind buttons on it. Voiding the
-- payment on a 'topup' fee now zeroes the top-up (0 classes, ₹0): the
-- ledger trigger claws the classes back, the row reads as a voided top-up
-- with the struck-through payment under it, and no dues appear anywhere.
-- Existing voided top-ups are brought in line.
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

  if v_fee.kind = 'topup' then
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

-- Bring any already-voided top-up in line (no live payment → undone).
do $$
declare
  r record;
begin
  perform set_config('app.fee_write', 'on', true);
  for r in
    select f.id
    from public.student_fees f
    where f.kind = 'topup'
      and f.amount > 0
      and public.fee_paid_total(f.id) = 0
  loop
    update public.student_fees set amount = 0, credits_granted = 0 where id = r.id;
    perform public.rederive_fee_status(r.id);
  end loop;
end;
$$;
