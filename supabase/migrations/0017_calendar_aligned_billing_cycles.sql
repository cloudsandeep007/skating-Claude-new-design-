-- =============================================================================
-- 0017_calendar_aligned_billing_cycles.sql
-- =============================================================================
-- Run once after 0016_delete_payment_and_fee.sql. Changes:
--   generate_upcoming_fees() now anchors every period to the 1st of a
--   calendar month, instead of a rolling "anniversary" of the student's
--   join date. A student joining Sep 15 used to get "Sep 15 – Oct 14"
--   forever; they now get "Sep 1 – Sep 30", "Oct 1 – Oct 31", etc.
--
-- This only changes periods generated FROM NOW ON — same rule as every
-- other change here so far (amounts/periods already generated are a
-- locked-in historical snapshot, per record_payment()/generate_upcoming
-- _fees()'s existing design; see DATA-MODEL.md). Nothing is rewritten
-- retroactively.
-- =============================================================================

create or replace function public.generate_upcoming_fees(p_academy_id uuid default null)
returns setof public.student_fees
language plpgsql
as $$
begin
  return query
  with eligible as (
    select
      s.id                                  as student_id,
      s.academy_id                          as academy_id,
      s.fee_plan_id                         as fee_plan_id,
      fp.amount                             as amount,
      fp.billing_cycle                      as billing_cycle,
      fp.pricing_mode                       as pricing_mode,
      fp.per_class_rate                     as per_class_rate,
      fp.batch_id                           as batch_id,
      (
        select max(sf.period_end)
        from public.student_fees sf
        where sf.student_id = s.id and sf.fee_plan_id = s.fee_plan_id
      )                                      as last_period_end,
      s.joined_date                         as joined_date
    from public.students s
    join public.fee_plans fp on fp.id = s.fee_plan_id and fp.academy_id = s.academy_id
    where s.status = 'active'
      and s.fee_plan_id is not null
      and (p_academy_id is null or s.academy_id = p_academy_id)
  ),
  due as (
    select
      student_id, academy_id, fee_plan_id, amount, billing_cycle,
      pricing_mode, per_class_rate, batch_id,
      -- Calendar-aligned: the 1st of the month containing either the day
      -- after the last period ended, or (for a student's very first
      -- period) the 1st of the month they joined in. A period generated
      -- by this function always ends on the last day of a month (see
      -- next_period below), so "last_period_end + 1" is already the 1st
      -- of the following month — date_trunc here is a defensive no-op
      -- for that case, and does the real work for the first-ever period.
      date_trunc('month', coalesce(last_period_end + 1, joined_date))::date as period_start
    from eligible
    where last_period_end is null or last_period_end < current_date
  ),
  next_period as (
    select
      student_id, academy_id, fee_plan_id, amount, pricing_mode, per_class_rate, batch_id,
      period_start,
      (case billing_cycle
         when 'monthly'   then period_start + interval '1 month'
         when 'quarterly' then period_start + interval '3 months'
         when 'annual'    then period_start + interval '1 year'
       end - interval '1 day')::date          as period_end
    from due
  )
  insert into public.student_fees
    (academy_id, student_id, fee_plan_id, period_start, period_end, amount, due_date, status, credits_granted)
  select
    academy_id, student_id, fee_plan_id, period_start, period_end,
    case
      when pricing_mode = 'per_class'
        then per_class_rate * public.expected_classes_from_schedule(batch_id, period_start, period_end)
      else amount
    end,
    period_start, 'pending',
    case
      when batch_id is not null
        then public.expected_classes_from_schedule(batch_id, period_start, period_end)
      else null
    end
  from next_period np
  where not exists (
    select 1 from public.student_fees sf2
    where sf2.student_id = np.student_id and sf2.period_start = np.period_start
  )
  returning *;
end;
$$;
