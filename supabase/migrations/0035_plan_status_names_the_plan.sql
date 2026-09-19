-- =============================================================================
-- 0035_plan_status_names_the_plan.sql
-- =============================================================================
-- credit_plan_status() now also returns the fee plan's name and the batch it
-- is scoped to, so the Top-up dialog can say "₹600 per class · Intermediate"
-- and an admin notices at once when a skater is on the wrong batch's plan.
-- (A skater enrolled in Intermediate had been put on the Beginner batch's
-- per-class plan and was quoted ₹500 a class instead of ₹600.)
-- =============================================================================

drop function if exists public.credit_plan_status(uuid);

create function public.credit_plan_status(p_student_id uuid)
returns table (
  uses_credits  boolean,
  pricing_mode  public.fee_pricing_mode,
  billing_cycle public.billing_cycle,
  rate          numeric,
  min_topup     integer,
  term_start    date,
  term_end      date,
  days_left     integer,
  term_status   text,
  available     integer,
  booking_window_days integer,
  plan_name     text,
  plan_batch_id uuid,
  plan_batch_name text
)
language sql stable
as $$
  with s as (
    select st.id, st.academy_id, fp.name as plan_name, fp.batch_id as plan_batch_id,
           fp.pricing_mode, fp.billing_cycle, fp.per_class_rate, a.settings
    from public.students st
    left join public.fee_plans fp on fp.id = st.fee_plan_id
    join public.academies a on a.id = st.academy_id
    where st.id = p_student_id
  ),
  term as (
    select f.period_start, f.period_end
    from public.student_fees f
    where f.student_id = p_student_id
      and f.status in ('paid', 'waived')
      and f.credits_granted is not null
    order by f.period_end desc
    limit 1
  )
  select
    public.student_uses_credits(p_student_id),
    s.pricing_mode,
    s.billing_cycle,
    s.per_class_rate,
    case s.billing_cycle
      when 'monthly'   then coalesce((s.settings->'topup_min_classes'->>'monthly')::integer, 8)
      when 'quarterly' then coalesce((s.settings->'topup_min_classes'->>'quarterly')::integer, 24)
      when 'annual'    then coalesce((s.settings->'topup_min_classes'->>'annual')::integer, 96)
    end,
    term.period_start,
    term.period_end,
    case when term.period_end is null then null
         else (term.period_end - public.academy_today(s.academy_id))::integer end,
    case
      when term.period_end is null then 'none'
      when term.period_end < public.academy_today(s.academy_id) then 'expired'
      when term.period_end - public.academy_today(s.academy_id) <= 7 then 'expiring'
      else 'active'
    end,
    public.class_credit_balance(p_student_id),
    coalesce((s.settings->>'booking_window_days')::integer, 7),
    s.plan_name,
    s.plan_batch_id,
    (select b.name from public.batches b where b.id = s.plan_batch_id)
  from s
  left join term on true;
$$;

grant execute on function public.credit_plan_status(uuid) to authenticated;
