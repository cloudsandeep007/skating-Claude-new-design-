-- =============================================================================
-- 0025_reprice_free_paid_periods.sql
-- =============================================================================
-- Two corrections to recompute_open_fees_for_plan() (0018/0020):
--
--   1. A period that is 'paid' only because it costs ₹0 (born free, or a
--      plan edited to 0 while it was open) has no protected money behind
--      it. "Paid is frozen" exists to protect money that changed hands, so
--      such a period re-prices like an open one when the plan changes, and
--      goes back to pending/overdue if it now costs more than was paid.
--      A paid period with a real price and a live payment stays frozen.
--   2. Re-pricing now prorates a stub period (one not starting on the 1st)
--      exactly as generate_upcoming_fees() does — 0018 predates stubs and
--      would have re-priced a half-month at the full monthly amount.
-- =============================================================================

create or replace function public.recompute_open_fees_for_plan(p_fee_plan_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('app.fee_write', 'on', true);

  update public.student_fees sf
  set amount = case
        when fp.pricing_mode = 'per_class'
          then fp.per_class_rate * public.expected_classes_from_schedule(fp.batch_id, sf.period_start, sf.period_end)
        when extract(day from sf.period_start) <> 1
          then round(
                 fp.amount
                   / case fp.billing_cycle when 'monthly' then 1 when 'quarterly' then 3 else 12 end
                   * (sf.period_end - sf.period_start + 1)
                   / extract(day from (date_trunc('month', sf.period_start) + interval '1 month' - interval '1 day')),
                 2)
        else fp.amount
      end,
      credits_granted = case
        when fp.batch_id is not null
          then public.expected_classes_from_schedule(fp.batch_id, sf.period_start, sf.period_end)
        else null
      end
  from public.fee_plans fp
  where sf.fee_plan_id = fp.id
    and fp.id = p_fee_plan_id
    and sf.kind = 'period'
    and (
      sf.status in ('pending', 'overdue')
      or (sf.status = 'paid' and (sf.amount = 0 or public.fee_paid_total(sf.id) = 0))
    );

  update public.student_fees sf
  set status = case
        when public.fee_paid_total(sf.id) >= sf.amount then 'paid'::public.fee_status
        when sf.due_date < public.academy_today(sf.academy_id) then 'overdue'::public.fee_status
        else 'pending'::public.fee_status
      end
  from public.fee_plans fp
  where sf.fee_plan_id = fp.id
    and fp.id = p_fee_plan_id
    and sf.kind = 'period'
    and (
      sf.status in ('pending', 'overdue')
      or (sf.status = 'paid' and public.fee_paid_total(sf.id) < sf.amount)
    );
end;
$$;
