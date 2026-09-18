-- =============================================================================
-- 0030_generate_fees_temp_table_and_receipt_labels.sql
-- =============================================================================
-- 1. generate_upcoming_fees() (0028) cleared its temp table with a bare
--    DELETE, which the project's safe-update guard refuses ("DELETE
--    requires a WHERE clause"). Recreate the table per call instead.
-- 2. The parent receipt spelled the method "Upi" / "Bank transfer" via
--    initcap; use proper labels.
-- =============================================================================

create or replace function public.payment_method_label(p_method public.payment_method)
returns text
language sql immutable
as $$
  select case p_method
    when 'upi' then 'UPI'
    when 'bank_transfer' then 'Bank transfer'
    when 'advance' then 'Advance balance'
    else initcap(p_method::text)
  end;
$$;

create or replace function public.generate_upcoming_fees(p_academy_id uuid default null)
returns setof public.student_fees
language plpgsql
as $$
declare
  r record;
begin
  drop table if exists _new_fees;
  create temp table _new_fees (id uuid) on commit drop;

  with eligible as (
    select
      s.id                                  as student_id,
      s.academy_id                          as academy_id,
      s.fee_plan_id                         as fee_plan_id,
      fp.amount                             as amount,
      fp.billing_cycle                      as billing_cycle,
      fp.batch_id                           as batch_id,
      (
        select max(sf.period_end)
        from public.student_fees sf
        where sf.student_id = s.id and sf.kind = 'period'
      )                                      as last_period_end,
      s.joined_date                         as joined_date,
      coalesce((a.settings->>'fee_generate_lead_days')::integer, 7) as lead_days,
      coalesce((a.settings->>'fee_grace_days')::integer, 5)         as grace_days
    from public.students s
    join public.fee_plans fp on fp.id = s.fee_plan_id and fp.academy_id = s.academy_id
    join public.academies a  on a.id = s.academy_id
    where s.status = 'active'
      and s.fee_plan_id is not null
      and fp.pricing_mode = 'cycle'
      and (p_academy_id is null or s.academy_id = p_academy_id)
  ),
  due as (
    select *, coalesce(last_period_end + 1, joined_date) as period_start
    from eligible
    where last_period_end is null or last_period_end < current_date + lead_days
  ),
  next_period as (
    select
      *,
      extract(day from period_start) <> 1 as is_stub,
      case
        when extract(day from period_start) = 1 then
          (period_start
             + case billing_cycle
                 when 'monthly'   then interval '1 month'
                 when 'quarterly' then interval '3 months'
                 else                  interval '1 year'
               end
             - interval '1 day')::date
        else
          (date_trunc('month', period_start) + interval '1 month' - interval '1 day')::date
      end as period_end
    from due
  ),
  priced as (
    select
      *,
      case
        when is_stub then
          round(
            amount
              / case billing_cycle when 'monthly' then 1 when 'quarterly' then 3 else 12 end
              * (period_end - period_start + 1)
              / extract(day from (date_trunc('month', period_start) + interval '1 month' - interval '1 day')),
            2
          )
        else amount
      end as fee_amount,
      case
        when batch_id is not null
          then public.expected_classes_from_schedule(batch_id, period_start, period_end)
        else null
      end as credits
    from next_period
  ),
  inserted as (
    insert into public.student_fees
      (academy_id, student_id, fee_plan_id, kind, period_start, period_end, amount, due_date, status, credits_granted)
    select
      academy_id, student_id, fee_plan_id, 'period', period_start, period_end, fee_amount,
      greatest(period_start, current_date) + grace_days,
      case when fee_amount = 0 then 'paid'::public.fee_status else 'pending'::public.fee_status end,
      credits
    from priced np
    where not exists (
      select 1 from public.student_fees sf2
      where sf2.student_id = np.student_id and sf2.kind = 'period' and sf2.period_start = np.period_start
    )
    returning id
  )
  insert into _new_fees select id from inserted;

  for r in select id from _new_fees loop
    perform public.apply_student_advance(r.id);
  end loop;

  return query select f.* from public.student_fees f where f.id in (select id from _new_fees);
end;
$$;

-- record_payment: receipt wording uses the proper method label.
create or replace function public.record_payment(
  p_student_fee_id  uuid,
  p_amount          numeric,
  p_paid_date       date default null,
  p_method          public.payment_method default 'cash',
  p_reference       text default null,
  p_notes           text default null,
  p_idempotency_key uuid default null,
  p_accept_advance  boolean default false
)
returns public.payments
language plpgsql security definer
set search_path = public
as $$
declare
  v_fee      public.student_fees%rowtype;
  v_payment  public.payments%rowtype;
  v_today    date;
  v_date     date;
  v_balance  numeric;
  v_extra    numeric := 0;
  v_year     integer;
  v_no       integer;
  v_prefix   text;
  v_receipt  text;
  v_body     text;
begin
  select * into v_fee from public.student_fees where id = p_student_fee_id;
  if not found then
    raise exception 'Fee not found';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_academy_admin() and v_fee.academy_id = public.current_academy_id())
  ) then
    raise exception 'Only an admin of this academy can record a payment';
  end if;
  if p_method = 'advance' then
    raise exception 'An advance is applied automatically — record what the family actually paid';
  end if;

  if p_idempotency_key is not null then
    select * into v_payment from public.payments
    where academy_id = v_fee.academy_id and idempotency_key = p_idempotency_key;
    if found then
      return v_payment;
    end if;
  end if;

  v_today := public.academy_today(v_fee.academy_id);
  v_date  := coalesce(p_paid_date, v_today);

  if v_fee.status = 'waived' then
    raise exception 'This fee was waived — nothing to collect';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;
  if v_date > v_today then
    raise exception 'Payment date can''t be in the future';
  end if;

  v_balance := v_fee.amount - public.fee_paid_total(p_student_fee_id);
  if v_balance <= 0 then
    raise exception 'This fee is already fully paid';
  end if;
  if p_amount > v_balance then
    if not p_accept_advance then
      raise exception 'That''s more than the ₹% still owed on this fee — tick "keep the extra as an advance" to accept it',
        trim(to_char(v_balance, 'FM99,99,99,990.00'));
    end if;
    v_extra := p_amount - v_balance;
  end if;

  select coalesce(
           nullif(btrim(a.settings->>'receipt_prefix'), ''),
           upper(left(regexp_replace(a.name, '[^A-Za-z0-9]', '', 'g'), 4)),
           'RCPT'
         )
    into v_prefix
  from public.academies a where a.id = v_fee.academy_id;
  v_year := extract(year from v_today)::integer;

  insert into public.receipt_counters (academy_id, year, last_no)
  values (v_fee.academy_id, v_year, 1)
  on conflict (academy_id, year) do update
    set last_no = receipt_counters.last_no + 1
  returning last_no into v_no;
  v_receipt := v_prefix || '-' || v_year || '-' || lpad(v_no::text, 6, '0');

  begin
    insert into public.payments
      (academy_id, student_fee_id, amount, paid_date, method, reference, recorded_by, notes,
       idempotency_key, receipt_no)
    values
      (v_fee.academy_id, p_student_fee_id, p_amount, v_date, p_method, p_reference, auth.uid(), p_notes,
       p_idempotency_key, v_receipt)
    returning * into v_payment;
  exception when unique_violation then
    select * into v_payment from public.payments
    where academy_id = v_fee.academy_id and idempotency_key = p_idempotency_key;
    if found then
      return v_payment;
    end if;
    raise;
  end;

  if v_extra > 0 then
    insert into public.student_advances (academy_id, student_id, delta, kind, payment_id, reason, actor_id)
    values (v_fee.academy_id, v_fee.student_id, v_extra, 'deposit', v_payment.id,
            'Paid ₹' || trim(to_char(p_amount, 'FM99,99,99,990')) || ' against ₹'
              || trim(to_char(v_balance, 'FM99,99,99,990')) || ' owed',
            auth.uid());
  end if;

  perform public.rederive_fee_status(p_student_fee_id);

  -- The receipt, to the family.
  v_body := 'Receipt ' || v_receipt || ' · ' || public.payment_method_label(p_method);
  if v_fee.kind = 'topup' then
    v_body := v_body || ' · ' || coalesce(v_fee.credits_granted, 0) || ' class'
      || case when v_fee.credits_granted = 1 then '' else 'es' end
      || ' added, valid till ' || to_char(v_fee.period_end, 'DD Mon YYYY') || '.';
  else
    v_body := v_body || ' · ' || to_char(v_fee.period_start, 'DD Mon') || ' – '
      || to_char(v_fee.period_end, 'DD Mon YYYY') || ' fee'
      || case when v_balance - p_amount > 0
           then '. ₹' || trim(to_char(v_balance - p_amount, 'FM99,99,99,990')) || ' still due.'
           else '. Fully paid.' end;
  end if;
  if v_extra > 0 then
    v_body := v_body || ' ₹' || trim(to_char(v_extra, 'FM99,99,99,990'))
      || ' kept as an advance for the next fee.';
  end if;
  perform public.notify_parents_of(
    v_fee.student_id, 'payment_recorded',
    'Payment received — ₹' || trim(to_char(p_amount, 'FM99,99,99,990')),
    v_body, '/parent/fees'
  );

  -- Any other open fee this advance can already cover.
  if v_extra > 0 then
    perform public.apply_student_advances(v_fee.student_id);
  end if;

  return v_payment;
end;
$$;
