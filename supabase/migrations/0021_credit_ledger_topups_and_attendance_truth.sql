-- =============================================================================
-- 0021_credit_ledger_topups_and_attendance_truth.sql
-- =============================================================================
-- Phase 2 of the payments & credits audit, with the client's revised model
-- for pay-per-class (2026-09-16). Run once after 0020.
--
-- The model, in one paragraph: a skater on a credit plan holds a running
-- balance of class credits in an append-only LEDGER. Credits come from a
-- paid fee — a flat-fee PERIOD (unchanged) or, for pay-per-class, a TOP-UP
-- of N classes that the admin records when the family pays. A top-up of at
-- least the cycle minimum (8 / 24 / 96 classes for monthly / quarterly /
-- annual) starts or renews a TERM of one cycle; smaller top-ups inside an
-- active term just add classes. When a term ends without renewal, the
-- remaining balance EXPIRES. Booking spends a credit; ATTENDANCE is the
-- final word: present/late spends one (booked or not — a walk-in can go
-- negative and owes classes), absent/excused/unmarked returns it.
--
--   1. student_fees.kind ('period' | 'topup'); the no-duplicate-period
--      rule applies to periods only
--   2. class_bookings.source ('parent' | 'attendance')
--   3. credit_ledger — one row per credit movement; balance = sum(delta)
--   4. Ledger writers: fee grant/clawback (trigger on student_fees),
--      booking spend/refund (trigger on class_bookings), seeded from the
--      current state so nobody's balance changes on deploy
--   5. class_credit_balance / class_credit_summary / class_credit_balances
--      re-read from the ledger; credit_plan_status() adds the term
--   6. record_credit_topup() — the admin action; reuses record_payment()
--      for the receipt, idempotency and audit trail
--   7. Attendance is truth: trigger on attendance + resolve at completion;
--      make-up credits no longer created for credit-plan skaters
--   8. expire_lapsed_credits() — nightly, via the generate-fees function
--   9. renewals_due() + send_renewal_reminders() — the dashboard panel
--  10. upcoming_bookings() — "who's coming this week" for the admin
--  11. book_class_slot() reads the ledger; clearer reasons when refused
--  12. generate_upcoming_fees() no longer bills per-class plans by period
-- =============================================================================


-- ## 1. Fee kind ------------------------------------------------------------------

create type public.fee_kind as enum ('period', 'topup');

alter table public.student_fees
  add column kind public.fee_kind not null default 'period';

alter table public.student_fees drop constraint student_fees_no_dup_period;
create unique index student_fees_no_dup_period
  on public.student_fees (student_id, period_start)
  where kind = 'period';


-- ## 2. Booking source ------------------------------------------------------------

alter table public.class_bookings
  add column source text not null default 'parent'
  check (source in ('parent', 'attendance'));


-- ## 3. credit_ledger ---------------------------------------------------------------

create table public.credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null,
  delta      integer not null check (delta <> 0),
  kind       text not null check (kind in ('grant', 'clawback', 'spend', 'refund', 'expire', 'adjust')),
  fee_id     uuid references public.student_fees (id) on delete set null,
  booking_id uuid references public.class_bookings (id) on delete set null,
  reason     text,
  actor_id   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (student_id, academy_id) references public.students (id, academy_id) on delete cascade
);

create index credit_ledger_student_idx on public.credit_ledger (student_id, created_at desc);
create index credit_ledger_fee_idx     on public.credit_ledger (fee_id);
create index credit_ledger_booking_idx on public.credit_ledger (booking_id);

alter table public.credit_ledger enable row level security;

create policy credit_ledger_super_all on public.credit_ledger for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy credit_ledger_admin_select on public.credit_ledger for select to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy credit_ledger_parent_select on public.credit_ledger for select to authenticated
  using (student_id = any ((select public.parent_student_ids())::uuid[]));
-- No insert/update/delete policy for anyone: rows are only ever written by
-- the SECURITY DEFINER functions below, and never changed afterwards.


-- ## 4. Ledger writers --------------------------------------------------------------

-- Does this skater take part in the credit system at all? True once they
-- have a batch-scoped plan, or have ever had credits or ledger movement.
create or replace function public.student_uses_credits(p_student_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from public.students s
    join public.fee_plans fp on fp.id = s.fee_plan_id
    where s.id = p_student_id and fp.batch_id is not null
  )
  or exists (select 1 from public.credit_ledger where student_id = p_student_id)
  or exists (select 1 from public.student_fees where student_id = p_student_id and credits_granted is not null);
$$;

-- Bring the ledger in line with one fee: a paid/waived fee should have
-- granted exactly credits_granted; anything else should have granted 0.
-- Idempotent — safe to call any number of times.
create or replace function public.ledger_sync_fee(p_fee_id uuid, p_reason text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_fee    public.student_fees%rowtype;
  v_target integer;
  v_net    integer;
begin
  select * into v_fee from public.student_fees where id = p_fee_id;
  if not found then
    return;
  end if;

  v_target := case
    when v_fee.status in ('paid', 'waived') then coalesce(v_fee.credits_granted, 0)
    else 0
  end;

  select coalesce(sum(delta), 0) into v_net
  from public.credit_ledger
  where fee_id = p_fee_id and kind in ('grant', 'clawback');

  if v_target > v_net then
    insert into public.credit_ledger (academy_id, student_id, delta, kind, fee_id, reason, actor_id)
    values (v_fee.academy_id, v_fee.student_id, v_target - v_net, 'grant', p_fee_id,
            coalesce(p_reason, case when v_fee.kind = 'topup' then 'Top-up' else 'Fee period paid' end),
            auth.uid());
  elsif v_target < v_net then
    insert into public.credit_ledger (academy_id, student_id, delta, kind, fee_id, reason, actor_id)
    values (v_fee.academy_id, v_fee.student_id, v_target - v_net, 'clawback', p_fee_id,
            coalesce(p_reason, 'Fee no longer paid'), auth.uid());
  end if;
end;
$$;

create or replace function public.trg_student_fees_ledger()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    -- Grant is reversed before the row goes (fee_id is nulled by the FK).
    if old.status in ('paid', 'waived') and coalesce(old.credits_granted, 0) > 0 then
      insert into public.credit_ledger (academy_id, student_id, delta, kind, fee_id, reason, actor_id)
      select old.academy_id, old.student_id, -coalesce(sum(delta), 0), 'clawback', old.id, 'Fee period deleted', auth.uid()
      from public.credit_ledger where fee_id = old.id and kind in ('grant', 'clawback')
      having coalesce(sum(delta), 0) > 0;
    end if;
    return old;
  end if;
  perform public.ledger_sync_fee(new.id);
  return new;
end;
$$;

create trigger student_fees_ledger
  after insert or update of status, credits_granted on public.student_fees
  for each row execute function public.trg_student_fees_ledger();

create trigger student_fees_ledger_delete
  before delete on public.student_fees
  for each row execute function public.trg_student_fees_ledger();

-- A booking that is 'booked' has spent exactly one credit; a cancelled one
-- has spent none. Idempotent per booking.
create or replace function public.ledger_sync_booking(p_booking_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_b   public.class_bookings%rowtype;
  v_net integer;
begin
  select * into v_b from public.class_bookings where id = p_booking_id;
  if not found then
    return;
  end if;

  select coalesce(sum(delta), 0) into v_net
  from public.credit_ledger
  where booking_id = p_booking_id and kind in ('spend', 'refund');

  if v_b.status = 'booked' and v_net = 0 then
    insert into public.credit_ledger (academy_id, student_id, delta, kind, booking_id, reason, actor_id)
    values (v_b.academy_id, v_b.student_id, -1, 'spend', p_booking_id,
            case when v_b.source = 'attendance' then 'Attended without booking' else 'Class booked' end,
            auth.uid());
  elsif v_b.status = 'cancelled' and v_net < 0 then
    insert into public.credit_ledger (academy_id, student_id, delta, kind, booking_id, reason, actor_id)
    values (v_b.academy_id, v_b.student_id, 1, 'refund', p_booking_id, 'Booking cancelled', auth.uid());
  end if;
end;
$$;

create or replace function public.trg_class_bookings_ledger()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.credit_ledger (academy_id, student_id, delta, kind, booking_id, reason, actor_id)
    select old.academy_id, old.student_id, -coalesce(sum(delta), 0), 'refund', old.id, 'Session removed', auth.uid()
    from public.credit_ledger where booking_id = old.id and kind in ('spend', 'refund')
    having coalesce(sum(delta), 0) < 0;
    return old;
  end if;
  perform public.ledger_sync_booking(new.id);
  return new;
end;
$$;

create trigger class_bookings_ledger
  after insert or update of status on public.class_bookings
  for each row execute function public.trg_class_bookings_ledger();

create trigger class_bookings_ledger_delete
  before delete on public.class_bookings
  for each row execute function public.trg_class_bookings_ledger();

-- Seed the ledger from today's state so no balance changes on deploy:
-- grants for every paid/waived credit-bearing fee, spends for every active
-- booking, and +1 for every pending make-up credit a credit-plan skater
-- holds (those make-ups are then closed — the ledger carries them now).
insert into public.credit_ledger (academy_id, student_id, delta, kind, fee_id, reason, created_at)
select f.academy_id, f.student_id, f.credits_granted, 'grant', f.id, 'Fee period paid (ledger opening balance)', f.updated_at
from public.student_fees f
where f.status in ('paid', 'waived') and coalesce(f.credits_granted, 0) > 0;

insert into public.credit_ledger (academy_id, student_id, delta, kind, booking_id, reason, created_at)
select b.academy_id, b.student_id, -1, 'spend', b.id, 'Class booked (ledger opening balance)', b.booked_at
from public.class_bookings b
where b.status = 'booked';

insert into public.credit_ledger (academy_id, student_id, delta, kind, reason, created_at)
select m.academy_id, m.student_id, 1, 'adjust', 'Make-up credit carried into the ledger', m.granted_at
from public.makeup_credits m
where m.status = 'pending' and public.student_uses_credits(m.student_id);

update public.makeup_credits m
   set status = 'fulfilled', fulfilled_at = now(), notes = coalesce(notes || ' · ', '') || 'Converted to a class credit'
 where m.status = 'pending' and public.student_uses_credits(m.student_id);


-- ## 5. Balance, summary, plan status --------------------------------------------------

create or replace function public.class_credit_balance(p_student_id uuid)
returns integer
language sql stable
as $$
  select case
    when not public.student_uses_credits(p_student_id) then null
    else coalesce((select sum(delta)::integer from public.credit_ledger where student_id = p_student_id), 0)
  end;
$$;

-- The current term: the latest paid/waived credit-bearing fee (period or
-- top-up). Its period_end is when the plan lapses.
create or replace function public.credit_plan_status(p_student_id uuid)
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
  available     integer
)
language sql stable
as $$
  with s as (
    select st.id, st.academy_id, fp.pricing_mode, fp.billing_cycle, fp.per_class_rate, a.settings
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
    public.class_credit_balance(p_student_id)
  from s
  left join term on true;
$$;

drop function if exists public.class_credit_summary(uuid);

create function public.class_credit_summary(p_student_id uuid)
returns table (
  granted   integer,
  spent     integer,
  refunded  integer,
  expired   integer,
  adjusted  integer,
  available integer,
  term_end  date,
  term_status text
)
language sql stable
as $$
  select
    coalesce((select sum(delta) from public.credit_ledger where student_id = p_student_id and kind in ('grant', 'clawback')), 0)::integer,
    coalesce((select -sum(delta) from public.credit_ledger where student_id = p_student_id and kind = 'spend'), 0)::integer,
    coalesce((select sum(delta) from public.credit_ledger where student_id = p_student_id and kind = 'refund'), 0)::integer,
    coalesce((select -sum(delta) from public.credit_ledger where student_id = p_student_id and kind = 'expire'), 0)::integer,
    coalesce((select sum(delta) from public.credit_ledger where student_id = p_student_id and kind = 'adjust'), 0)::integer,
    public.class_credit_balance(p_student_id),
    (select ps.term_end from public.credit_plan_status(p_student_id) ps),
    (select ps.term_status from public.credit_plan_status(p_student_id) ps);
$$;


-- ## 6. record_credit_topup -------------------------------------------------------------
-- The admin records that a family paid for N classes. Creates a 'topup' fee
-- row for the right term and pays it through record_payment() — so the
-- receipt number, idempotency, void and audit behaviour are all the same
-- as any other payment, and the ledger grant follows from the status flip.

create or replace function public.record_credit_topup(
  p_student_id      uuid,
  p_classes         integer,
  p_paid_date       date default null,
  p_method          public.payment_method default 'cash',
  p_reference       text default null,
  p_notes           text default null,
  p_idempotency_key uuid default null
)
returns public.student_fees
language plpgsql security definer
set search_path = public
as $$
declare
  v_student  public.students%rowtype;
  v_plan     public.fee_plans%rowtype;
  v_status   record;
  v_today    date;
  v_date     date;
  v_start    date;
  v_end      date;
  v_fee      public.student_fees%rowtype;
  v_existing uuid;
  v_cycle    interval;
begin
  select * into v_student from public.students where id = p_student_id;
  if not found then
    raise exception 'Skater not found';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_academy_admin() and v_student.academy_id = public.current_academy_id())
  ) then
    raise exception 'Only an admin of this academy can record a top-up';
  end if;

  -- Replay of the same request → the top-up already recorded.
  if p_idempotency_key is not null then
    select student_fee_id into v_existing from public.payments
    where academy_id = v_student.academy_id and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      select * into v_fee from public.student_fees where id = v_existing;
      return v_fee;
    end if;
  end if;

  select * into v_plan from public.fee_plans where id = v_student.fee_plan_id;
  if not found or v_plan.pricing_mode <> 'per_class' or v_plan.batch_id is null then
    raise exception 'Top-ups are for skaters on a pay-per-class plan';
  end if;
  if p_classes is null or p_classes < 1 then
    raise exception 'Enter how many classes are being topped up';
  end if;

  select * into v_status from public.credit_plan_status(p_student_id);
  v_today := public.academy_today(v_student.academy_id);
  v_date  := coalesce(p_paid_date, v_today);
  if v_date > v_today then
    raise exception 'Payment date can''t be in the future';
  end if;

  v_cycle := case v_plan.billing_cycle
    when 'monthly'   then interval '1 month'
    when 'quarterly' then interval '3 months'
    else                  interval '1 year'
  end;

  if v_status.term_status in ('active', 'expiring') and p_classes < v_status.min_topup then
    -- Extra classes inside the current term: same dates, no renewal.
    v_start := v_status.term_start;
    v_end   := v_status.term_end;
  elsif v_status.term_status in ('active', 'expiring') then
    -- Renewal bought before the term ends: the next term follows on.
    v_start := v_status.term_end + 1;
    v_end   := (v_start + v_cycle - interval '1 day')::date;
  else
    -- No plan, or it lapsed: a new term starts now, and needs the minimum.
    if p_classes < v_status.min_topup then
      raise exception 'A new % plan needs at least % classes (₹%)',
        v_plan.billing_cycle, v_status.min_topup,
        trim(to_char(v_status.min_topup * v_plan.per_class_rate, 'FM99,99,99,990'));
    end if;
    v_start := v_date;
    v_end   := (v_start + v_cycle - interval '1 day')::date;
  end if;

  perform set_config('app.fee_write', 'on', true);
  insert into public.student_fees
    (academy_id, student_id, fee_plan_id, kind, period_start, period_end, amount, due_date, status, credits_granted)
  values
    (v_student.academy_id, p_student_id, v_plan.id, 'topup', v_start, v_end,
     p_classes * v_plan.per_class_rate, v_date, 'pending', p_classes)
  returning * into v_fee;

  perform public.record_payment(
    v_fee.id, p_classes * v_plan.per_class_rate, v_date, p_method, p_reference,
    coalesce(p_notes, '') || case when p_notes is null then '' else ' · ' end
      || p_classes || ' class' || case when p_classes = 1 then '' else 'es' end || ' top-up',
    p_idempotency_key
  );

  select * into v_fee from public.student_fees where id = v_fee.id;
  return v_fee;
end;
$$;


-- ## 7. Attendance is the source of truth ------------------------------------------------

-- present / late → one credit spent, whether or not a booking existed
-- (a walk-in gets a booking with source = 'attendance');
-- absent / excused → the booked credit comes back.
create or replace function public.attendance_credit_truth()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.student_uses_credits(new.student_id) then
    return null;
  end if;

  if new.status in ('present', 'late') then
    insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at, source)
    values (new.academy_id, new.student_id, new.session_id, 'booked', now(), null, 'attendance')
    on conflict (student_id, session_id) do update
      set status = 'booked', cancelled_at = null, source = 'attendance'
      where class_bookings.status = 'cancelled';
  else
    update public.class_bookings
       set status = 'cancelled', cancelled_at = now()
     where student_id = new.student_id
       and session_id = new.session_id
       and status = 'booked';
  end if;
  return null;
end;
$$;

create trigger attendance_credit_truth
  after insert or update of status on public.attendance
  for each row execute function public.attendance_credit_truth();

-- Make-up credits are now only for skaters outside the credit system; a
-- credit-plan skater's absence is handled by the refund above.
create or replace function public.grant_or_revoke_makeup_credit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if public.student_uses_credits(new.student_id) then
    return null;
  end if;
  if new.status = 'absent' then
    insert into public.makeup_credits (academy_id, student_id, reason_session_id)
    values (new.academy_id, new.student_id, new.session_id)
    on conflict (student_id, reason_session_id) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'absent' and new.status <> 'absent' then
    delete from public.makeup_credits
    where student_id = new.student_id
      and reason_session_id = new.session_id
      and status = 'pending';
  end if;
  return null;
end;
$$;

-- When a session is completed, anyone still booked but never marked wasn't
-- there: their credit comes back.
create or replace function public.resolve_session_bookings(p_session_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with released as (
    update public.class_bookings b
       set status = 'cancelled', cancelled_at = now()
     where b.session_id = p_session_id
       and b.status = 'booked'
       and not exists (
         select 1 from public.attendance a
         where a.session_id = b.session_id and a.student_id = b.student_id
       )
    returning 1
  )
  select count(*)::integer into v_count from released;
  return v_count;
end;
$$;

create or replace function public.save_attendance(
  p_session_id uuid,
  p_marks      jsonb
)
returns integer
language plpgsql
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_count   integer := 0;
  v_mark    jsonb;
begin
  select * into v_session from public.schedule_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'This session was cancelled';
  end if;

  for v_mark in select * from jsonb_array_elements(p_marks) loop
    insert into public.attendance (academy_id, session_id, student_id, status, marked_by, marked_at)
    values (
      v_session.academy_id,
      p_session_id,
      (v_mark->>'student_id')::uuid,
      (v_mark->>'status')::public.attendance_status,
      auth.uid(),
      now()
    )
    on conflict (session_id, student_id) do update
      set status    = excluded.status,
          marked_by = excluded.marked_by,
          marked_at = excluded.marked_at;
    v_count := v_count + 1;
  end loop;

  if v_session.status = 'scheduled' then
    update public.schedule_sessions set status = 'completed' where id = p_session_id;
  end if;

  perform public.resolve_session_bookings(p_session_id);

  return v_count;
end;
$$;


-- ## 8. Expiry ------------------------------------------------------------------------------
-- Nightly (from the generate-fees function). A skater whose latest term has
-- ended, with nothing newer paid, loses whatever balance is left — as a
-- visible 'expire' line, never silently.

create or replace function public.expire_lapsed_credits()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select st.id as student_id, st.academy_id, ps.term_end, ps.available
    from public.students st
    cross join lateral public.credit_plan_status(st.id) ps
    where st.status = 'active'
      and ps.uses_credits
      and ps.term_status = 'expired'
      and coalesce(ps.available, 0) > 0
  loop
    insert into public.credit_ledger (academy_id, student_id, delta, kind, reason)
    values (r.academy_id, r.student_id, -r.available, 'expire',
            'Plan ended ' || to_char(r.term_end, 'DD Mon YYYY') || ' without renewal');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


-- ## 9. Renewals due --------------------------------------------------------------------------

create or replace function public.renewals_due(p_within_days integer default 7)
returns table (
  student_id    uuid,
  full_name     text,
  photo_url     text,
  batch_names   text,
  pricing_mode  public.fee_pricing_mode,
  billing_cycle public.billing_cycle,
  term_end      date,
  days_left     integer,
  term_status   text,
  available     integer,
  min_topup     integer,
  rate          numeric,
  parent_name   text,
  parent_phone  text,
  last_reminded_at timestamptz
)
language sql stable
as $$
  select
    st.id,
    st.full_name,
    st.photo_url,
    (
      select string_agg(b.name, ', ' order by b.name)
      from public.student_batches sb
      join public.batches b on b.id = sb.batch_id
      where sb.student_id = st.id and sb.status = 'active'
    ),
    ps.pricing_mode,
    ps.billing_cycle,
    ps.term_end,
    ps.days_left,
    ps.term_status,
    ps.available,
    ps.min_topup,
    ps.rate,
    (select p.full_name from public.parents_students x join public.profiles p on p.id = x.parent_profile_id
      where x.student_id = st.id order by x.created_at limit 1),
    (select p.phone from public.parents_students x join public.profiles p on p.id = x.parent_profile_id
      where x.student_id = st.id order by x.created_at limit 1),
    (select max(n.created_at) from public.notifications n
      join public.parents_students x on x.parent_profile_id = n.profile_id
      where x.student_id = st.id and n.type = 'renewal_due')
  from public.students st
  cross join lateral public.credit_plan_status(st.id) ps
  where st.status = 'active'
    and ps.uses_credits
    and ps.billing_cycle is not null
    and (ps.term_status = 'expired' or (ps.term_end is not null and ps.days_left <= p_within_days))
  order by ps.term_end nulls first, st.full_name;
$$;

create or replace function public.send_renewal_reminders(p_student_ids uuid[])
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_academy uuid := public.current_academy_id();
  r         record;
  v_sent    integer := 0;
  v_this    integer;
begin
  if not public.is_academy_admin() or v_academy is null then
    raise exception 'Only an academy admin can send renewal reminders';
  end if;

  for r in
    select st.id, st.full_name, ps.*
    from public.students st
    cross join lateral public.credit_plan_status(st.id) ps
    where st.id = any (p_student_ids) and st.academy_id = v_academy and ps.uses_credits
  loop
    insert into public.notifications (academy_id, profile_id, type, title, body, link)
    select
      v_academy,
      x.parent_profile_id,
      'renewal_due',
      case when r.term_status = 'expired'
        then 'Plan ended — ' || r.full_name
        else 'Plan ending soon — ' || r.full_name end,
      case
        when r.term_status = 'expired' then
          r.full_name || '''s ' || r.billing_cycle || ' plan ended on ' || to_char(r.term_end, 'DD Mon') ||
          '. Top up at the academy to keep booking classes.'
        else
          r.full_name || '''s ' || r.billing_cycle || ' plan ends on ' || to_char(r.term_end, 'DD Mon') ||
          case when coalesce(r.available, 0) > 0
            then ' — top up before then to carry ' || r.available || ' unused class' ||
                 case when r.available = 1 then '' else 'es' end || ' forward.'
            else ' — top up to keep booking classes.' end
      end,
      '/parent/fees'
    from public.parents_students x
    where x.student_id = r.id;

    get diagnostics v_this = row_count;
    v_sent := v_sent + v_this;
  end loop;

  return v_sent;
end;
$$;


-- ## 10. Who's coming ----------------------------------------------------------------------------

create or replace function public.upcoming_bookings(p_days integer default 7)
returns table (
  session_id   uuid,
  session_date date,
  start_time   time,
  end_time     time,
  batch_id     uuid,
  batch_name   text,
  venue        text,
  coach_name   text,
  student_id   uuid,
  full_name    text,
  photo_url    text,
  source       text
)
language sql stable
as $$
  select
    ss.id, ss.session_date, ss.start_time, ss.end_time,
    b.id, b.name, b.venue,
    (select p.full_name from public.coaches c join public.profiles p on p.id = c.profile_id where c.id = ss.coach_id),
    st.id, st.full_name, st.photo_url,
    cb.source
  from public.schedule_sessions ss
  join public.batches b on b.id = ss.batch_id
  join public.class_bookings cb on cb.session_id = ss.id and cb.status = 'booked'
  join public.students st on st.id = cb.student_id
  where ss.status = 'scheduled'
    and ss.session_date between current_date and current_date + p_days
  order by ss.session_date, ss.start_time, b.name, st.full_name;
$$;


-- ## 11. book_class_slot reads the ledger -----------------------------------------------------------

create or replace function public.book_class_slot(p_session_id uuid, p_student_id uuid)
returns public.class_bookings
language plpgsql security definer
set search_path = public
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_booking public.class_bookings%rowtype;
  v_status  record;
begin
  if not (p_student_id = any (public.parent_student_ids())) then
    raise exception 'That skater is not linked to your account';
  end if;

  select * into v_session from public.schedule_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'This session is not open for booking';
  end if;
  if v_session.session_date < current_date then
    raise exception 'This session has already passed';
  end if;

  if not exists (
    select 1 from public.student_batches sb
    where sb.batch_id = v_session.batch_id
      and sb.student_id = p_student_id
      and sb.status = 'active'
  ) then
    raise exception 'This skater is not enrolled in this batch';
  end if;

  perform 1 from public.students where id = p_student_id for update;

  select * into v_status from public.credit_plan_status(p_student_id);

  if v_status.term_status = 'expired' then
    raise exception 'The plan ended on % — top up at the academy to renew it',
      to_char(v_status.term_end, 'DD Mon');
  end if;

  if coalesce(v_status.available, 0) <= 0 then
    if v_status.pricing_mode = 'per_class' then
      if coalesce(v_status.available, 0) < 0 then
        raise exception 'This skater owes % class% from attending without credits — top up at the academy first',
          -v_status.available, case when v_status.available = -1 then '' else 'es' end;
      end if;
      raise exception 'No classes left — top up at the academy to book';
    elsif exists (
      select 1 from public.student_fees
      where student_id = p_student_id
        and credits_granted is not null
        and status in ('pending', 'overdue')
    ) then
      raise exception 'Pay this period''s fee to unlock class credits';
    else
      raise exception 'No class credits remaining';
    end if;
  end if;

  insert into public.class_bookings (academy_id, student_id, session_id, status, booked_at, cancelled_at, source)
  values (v_session.academy_id, p_student_id, p_session_id, 'booked', now(), null, 'parent')
  on conflict (student_id, session_id) do update
    set status = 'booked', booked_at = now(), cancelled_at = null, source = 'parent'
    where class_bookings.status = 'cancelled'
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'This class is already booked';
  end if;

  return v_booking;
end;
$$;


-- ## 12. generate_upcoming_fees: per-class plans are top-up only now ---------------------------------

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
    select
      *,
      coalesce(last_period_end + 1, joined_date) as period_start
    from eligible
    where last_period_end is null
       or last_period_end < current_date + lead_days
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
  )
  insert into public.student_fees
    (academy_id, student_id, fee_plan_id, kind, period_start, period_end, amount, due_date, status, credits_granted)
  select
    academy_id, student_id, fee_plan_id, 'period', period_start, period_end, fee_amount,
    greatest(period_start, current_date) + grace_days,
    'pending',
    credits
  from priced np
  where not exists (
    select 1 from public.student_fees sf2
    where sf2.student_id = np.student_id and sf2.kind = 'period' and sf2.period_start = np.period_start
  )
  returning *;
end;
$$;
