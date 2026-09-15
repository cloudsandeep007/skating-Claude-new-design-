-- =============================================================================
-- 0018_sync_open_fees_with_plan_and_schedule.sql
-- =============================================================================
-- Bug reported by the client: a per-class fee was generated at ₹8,800
-- (based on the batch's original Mon-Fri schedule), then the batch was
-- edited to Sat/Sun only — the already-generated PENDING fee kept
-- showing ₹8,800 instead of recalculating for the new (shorter) schedule.
--
-- Root cause: student_fees.amount / .credits_granted are a snapshot taken
-- at generate_upcoming_fees() time, and nothing ever touched them again —
-- by design for a PAID fee (that's real money already collected under
-- agreed terms, see 0016/DECISIONS "plan edits don't rewrite history"),
-- but wrong for a fee nobody has paid yet: a pending/overdue amount is a
-- future obligation, not history, so it should track the plan/batch's
-- current configuration until it's actually settled.
--
-- Fix: keep the snapshot rule for anything already paid or waived, but
-- make PENDING/OVERDUE student_fees rows recompute live whenever the
-- inputs that priced them change:
--   - fee_plans.amount / .per_class_rate / .pricing_mode / .batch_id
--   - batches.days_of_week (the schedule expected_classes_from_schedule counts)
--   - holidays added/removed for the academy (same function, same inputs)
--
-- A fee with a partial payment already recorded against the old amount
-- is handled too: after recomputing amount/credits, status is
-- re-derived from what's actually been paid vs the new amount (same
-- logic delete_payment() already uses), so a rate drop that now happens
-- to be fully covered flips straight to 'paid' instead of being stuck
-- pending with a negative-looking balance.
-- =============================================================================

-- ## 1. The shared recompute --------------------------------------------------

create or replace function public.recompute_open_fees_for_plan(p_fee_plan_id uuid)
returns void
language plpgsql
as $$
begin
  -- Step 1: re-price amount and credits_granted from the plan/batch as
  -- they stand right now. Paid and waived fees are never touched.
  update public.student_fees sf
  set amount = case
        when fp.pricing_mode = 'per_class'
          then fp.per_class_rate * public.expected_classes_from_schedule(fp.batch_id, sf.period_start, sf.period_end)
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
    and sf.status in ('pending', 'overdue');

  -- Step 2: re-derive status against the (possibly new) amount, in case
  -- a rate change now over- or under-covers a fee that already has
  -- payments on it. A scalar subquery (not a FROM-list join) is used
  -- here because Postgres won't let a joined FROM item reference the
  -- UPDATE target table (sf) directly.
  update public.student_fees sf
  set status = case
        when coalesce(
               (select sum(pay.amount) from public.payments pay where pay.student_fee_id = sf.id),
               0
             ) >= sf.amount then 'paid'::public.fee_status
        when sf.due_date < current_date then 'overdue'::public.fee_status
        else 'pending'::public.fee_status
      end
  from public.fee_plans fp
  where sf.fee_plan_id = fp.id
    and fp.id = p_fee_plan_id
    and sf.status in ('pending', 'overdue');
end;
$$;

-- ## 2. fee_plans changes trigger a recompute of their own open fees ---------

create or replace function public.trg_fee_plans_sync_open_fees()
returns trigger
language plpgsql
as $$
begin
  if new.amount is distinct from old.amount
     or new.per_class_rate is distinct from old.per_class_rate
     or new.pricing_mode is distinct from old.pricing_mode
     or new.batch_id is distinct from old.batch_id
  then
    perform public.recompute_open_fees_for_plan(new.id);
  end if;
  return new;
end;
$$;

create trigger fee_plans_sync_open_fees
after update on public.fee_plans
for each row execute function public.trg_fee_plans_sync_open_fees();

-- ## 3. A batch's schedule changing recomputes every plan priced off it ------

create or replace function public.trg_batches_sync_open_fees()
returns trigger
language plpgsql
as $$
declare
  r record;
begin
  if new.days_of_week is distinct from old.days_of_week then
    for r in select id from public.fee_plans where batch_id = new.id loop
      perform public.recompute_open_fees_for_plan(r.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger batches_sync_open_fees
after update on public.batches
for each row execute function public.trg_batches_sync_open_fees();

-- ## 4. An academy holiday being added/removed recomputes every batch- -------
-- scoped plan in that academy (holidays are academy-wide, not per-batch,
-- so any batch-scoped plan's expected_classes_from_schedule could change).

create or replace function public.trg_holidays_sync_open_fees()
returns trigger
language plpgsql
as $$
declare
  v_academy_id uuid := coalesce(new.academy_id, old.academy_id);
  r record;
begin
  for r in select id from public.fee_plans where academy_id = v_academy_id and batch_id is not null loop
    perform public.recompute_open_fees_for_plan(r.id);
  end loop;
  return coalesce(new, old);
end;
$$;

create trigger holidays_sync_open_fees
after insert or delete on public.holidays
for each row execute function public.trg_holidays_sync_open_fees();
