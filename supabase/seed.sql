-- =============================================================================
-- seed.sql — demo data for the Skating Academy app
-- =============================================================================
-- Run AFTER supabase/migrations/0001_initial_schema.sql, on a non-production
-- database only. Re-runnable: it first deletes everything it created before.
--
-- Creates: 1 academy, 1 super admin, 1 academy admin, 3 coaches, 40 students
-- with parent accounts, 9 levels × 5 skills, 6 batches, ~3 months of past
-- sessions + 2 weeks upcoming, attendance for every completed session, skill
-- progress, fee plans, 3 months of fees and payments, announcements and
-- notifications, feature flags.
--
-- Every seeded login uses the password:  Password123!
--   super admin   super@skating.test
--   academy admin admin@skating.test
--   coaches       coach1@skating.test … coach3@skating.test
--   parents       <firstname>.<surname><n>@skating.test  (see profiles table)
--
-- Dates are relative to today so the dashboard always has recent data.
-- =============================================================================

set client_min_messages = warning;

-- Remove a previous run. Users first (cascades to profiles), then the academy
-- (cascades to every tenant-owned row).
delete from auth.users where email like '%@skating.test';
delete from public.academies where slug = 'glide-skating-academy';
delete from public.feature_flags where key in ('online_payments', 'whatsapp_reminders', 'skill_progression');

-- Creates an email/password auth user the way Supabase Auth expects.
create or replace function pg_temp.seed_user(p_id uuid, p_email text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', false
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end;
$$;

do $seed$
declare
  v_academy uuid := '11111111-1111-4111-8111-111111111111';
  v_super   uuid := md5('user-super')::uuid;
  v_admin   uuid := md5('user-admin')::uuid;

  v_coach_profile uuid[] := array[md5('user-coach-1')::uuid, md5('user-coach-2')::uuid, md5('user-coach-3')::uuid];
  v_coach         uuid[] := array[md5('coach-1')::uuid, md5('coach-2')::uuid, md5('coach-3')::uuid];
  v_coach_names   text[] := array['Karthik Menon', 'Sneha Kulkarni', 'Arjun Rao'];
  v_coach_spec    text[] := array['Figure skating', 'Speed skating', 'Beginner and inline skating'];

  v_boys text[] := array['Aarav','Vihaan','Arjun','Reyansh','Ishaan','Kabir','Advik','Dhruv','Vivaan','Aditya',
                         'Ayaan','Rohan','Krishna','Shaurya','Yash','Ritvik','Aryan','Nikhil','Pranav','Siddharth'];
  v_girls text[] := array['Ananya','Diya','Saanvi','Aadhya','Myra','Kiara','Anika','Navya','Ira','Riya',
                          'Avni','Pari','Meera','Tara','Isha','Sara','Zara','Nitya','Prisha','Aarohi'];
  v_surnames text[] := array['Sharma','Verma','Iyer','Nair','Reddy','Patel','Mehta','Kulkarni','Deshpande','Menon',
                             'Bhat','Rao','Gupta','Joshi','Chauhan','Pillai','Banerjee','Sen','Malhotra','Kapoor'];
  v_fathers text[] := array['Rajesh','Suresh','Amit','Vikram','Sanjay','Manoj','Anil','Deepak','Rahul','Prakash',
                            'Ravi','Ashok','Sunil','Vinod','Ganesh','Harish','Mahesh','Naveen','Kiran','Srinivas'];
  v_mothers text[] := array['Priya','Sunita','Kavita','Anjali','Deepa','Lakshmi','Meena','Pooja','Rekha','Shalini',
                            'Neha','Swati','Asha','Geeta','Radha','Nisha','Divya','Preeti','Sangeeta','Vidya'];

  v_level_names text[] := array['Beginner 1','Beginner 2','Beginner 3',
                                'Intermediate 1','Intermediate 2','Intermediate 3',
                                'Advanced 1','Advanced 2','Advanced 3'];
  v_skill_names text[][] := array[
    ['Falling and getting up safely', 'Marching in place', 'Forward marching', 'Two-foot glide', 'Dip'],
    ['Forward swizzles', 'Backward wiggles', 'Snowplow stop', 'Rocking horse', 'Two-foot turn in place'],
    ['Forward stroking', 'Forward one-foot glide', 'Backward swizzles', 'Forward slalom', 'T-stop'],
    ['Forward crossovers', 'Backward one-foot glide', 'Backward stroking', 'Hockey stop', 'Forward outside edges'],
    ['Backward crossovers', 'Forward inside edges', 'Forward outside three-turn', 'Mohawk turn', 'Lunge'],
    ['Backward outside edges', 'Backward inside edges', 'Two-foot spin', 'Bunny hop', 'Spiral'],
    ['One-foot spin', 'Waltz jump', 'Forward power pulls', 'Backward three-turns', 'Shoot-the-duck'],
    ['Toe loop', 'Salchow', 'Sit spin', 'Backward power pulls', 'Change-of-foot spin'],
    ['Loop jump', 'Flip jump', 'Camel spin', 'Jump combination', 'Choreographed program']
  ];
  v_level uuid[] := array[]::uuid[];

  v_batch        uuid[] := array[md5('batch-1')::uuid, md5('batch-2')::uuid, md5('batch-3')::uuid,
                                 md5('batch-4')::uuid, md5('batch-5')::uuid, md5('batch-6')::uuid];
  v_batch_names  text[] := array['Beginner A — Morning', 'Beginner B — Evening', 'Intermediate A — Morning',
                                 'Intermediate B — Evening', 'Advanced — Evening', 'Weekend Juniors'];
  v_batch_levels text[] := array['Beginner 1–3', 'Beginner 1–3', 'Intermediate 1–3',
                                 'Intermediate 1–3', 'Advanced 1–3', 'Beginner 1–3'];
  v_batch_coach  int[]  := array[1, 3, 1, 2, 2, 3];
  v_batch_start  time[] := array['06:30', '17:00', '06:30', '17:00', '18:00', '08:00']::time[];
  v_batch_end    time[] := array['07:30', '18:00', '07:30', '18:00', '19:30', '09:30']::time[];
  v_batch_venue  text[] := array['Rink A', 'Rink A', 'Rink B', 'Rink B', 'Rink B', 'Rink A'];
  v_days         smallint[];

  v_plan_monthly   uuid := md5('plan-monthly')::uuid;
  v_plan_quarterly uuid := md5('plan-quarterly')::uuid;
  v_plan_annual    uuid := md5('plan-annual')::uuid;

  v_low_attenders uuid[] := array[]::uuid[];

  i int; f int; l int; k int; b int; m int;
  v_student uuid; v_father uuid; v_mother uuid;
  v_first text; v_surname text; v_father_name text; v_father_phone text;
  v_batch_no int; v_level_no int;
  v_date date;
  v_session record; v_enrol record;
  r double precision;
  v_att public.attendance_status;
  v_skill_status public.skill_status;
  v_month_start date := date_trunc('month', current_date)::date;
  v_fee uuid; v_fee_status public.fee_status; v_ps date; v_pe date; v_due date;
  v_amount numeric; v_pay numeric; v_method public.payment_method;
  v_ann uuid;
begin
  perform setseed(0.42);

  -- --------------------------------------------------------------------------
  -- Academy, super admin, academy admin
  -- --------------------------------------------------------------------------
  insert into public.academies (id, name, slug, address, phone, email, plan_tier, status, settings)
  values (v_academy, 'Glide Skating Academy', 'glide-skating-academy',
          '27th Main, HSR Layout Sector 1, Bengaluru 560102', '+91 80 4567 8900',
          'hello@glideskating.in', 'pro', 'active',
          '{"timezone": "Asia/Kolkata", "currency": "INR"}'::jsonb);

  perform pg_temp.seed_user(v_super, 'super@skating.test');
  insert into public.profiles (id, academy_id, role, full_name, phone, email)
  values (v_super, null, 'super_admin', 'Sandeep (Super Admin)', '+91 98450 00001', 'super@skating.test');

  perform pg_temp.seed_user(v_admin, 'admin@skating.test');
  insert into public.profiles (id, academy_id, role, full_name, phone, email)
  values (v_admin, v_academy, 'academy_admin', 'Meera Krishnan', '+91 98450 00002', 'admin@skating.test');

  -- --------------------------------------------------------------------------
  -- Coaches
  -- --------------------------------------------------------------------------
  for i in 1..3 loop
    perform pg_temp.seed_user(v_coach_profile[i], 'coach' || i || '@skating.test');
    insert into public.profiles (id, academy_id, role, full_name, phone, email)
    values (v_coach_profile[i], v_academy, 'coach', v_coach_names[i],
            '+91 98450 0001' || i, 'coach' || i || '@skating.test');
    insert into public.coaches (id, academy_id, profile_id, specialization, joined_date, status)
    values (v_coach[i], v_academy, v_coach_profile[i], v_coach_spec[i],
            current_date - (300 + i * 40), 'active');
  end loop;

  -- --------------------------------------------------------------------------
  -- Levels and skills
  -- --------------------------------------------------------------------------
  for l in 1..9 loop
    v_level[l] := md5('level-' || l)::uuid;
    insert into public.levels (id, academy_id, name, sequence, description)
    values (v_level[l], v_academy, v_level_names[l], l,
            'Skills a skater must show consistently before moving past ' || v_level_names[l] || '.');
    for k in 1..5 loop
      insert into public.skills (id, academy_id, level_id, name, sequence)
      values (md5('skill-' || l || '-' || k)::uuid, v_academy, v_level[l], v_skill_names[l][k], k);
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- Batches
  -- --------------------------------------------------------------------------
  for b in 1..6 loop
    v_days := (case b
      when 1 then '{1,3,5}' when 2 then '{2,4,6}' when 3 then '{2,4,6}'
      when 4 then '{1,3,5}' when 5 then '{1,3,5}' else '{0,6}'
    end)::smallint[];
    insert into public.batches (id, academy_id, name, level_range, coach_id, capacity,
                                start_time, end_time, days_of_week, venue, status)
    values (v_batch[b], v_academy, v_batch_names[b], v_batch_levels[b], v_coach[v_batch_coach[b]], 10,
            v_batch_start[b], v_batch_end[b], v_days, v_batch_venue[b], 'active');
  end loop;

  -- --------------------------------------------------------------------------
  -- Students, parents, enrollments, skill progress
  -- Students 1–8 form four sibling pairs (1&2, 3&4, 5&6, 7&8) sharing parents.
  -- Every third family also has a mother account (two parents per child).
  -- Students 9, 18, 27, 36 are deliberately poor attenders (for the at-risk view).
  -- --------------------------------------------------------------------------
  for i in 1..40 loop
    f := case when i in (2, 4, 6, 8) then i - 1 else i end;
    v_surname := v_surnames[((f - 1) % 20) + 1];
    v_first := case when i % 2 = 1
                 then v_boys[(((i - 1) / 2) % 20) + 1]
                 else v_girls[(((i / 2) - 1) % 20) + 1]
               end;
    v_student  := md5('student-' || i)::uuid;
    v_batch_no := ((i - 1) % 6) + 1;
    v_level_no := case
      when v_batch_no in (1, 2, 6) then 1 + (i % 3)
      when v_batch_no in (3, 4)    then 4 + (i % 3)
      else                              7 + (i % 2)
    end;
    v_father      := md5('parent-father-' || f)::uuid;
    v_mother      := md5('parent-mother-' || f)::uuid;
    v_father_name := v_fathers[((f - 1) % 20) + 1] || ' ' || v_surname;
    v_father_phone := '+91 98' || lpad(((10000000 + f * 7919) % 100000000)::text, 8, '0');

    insert into public.students (id, academy_id, full_name, date_of_birth, gender, joined_date,
                                 current_level_id, status, emergency_contact, medical_notes)
    values (v_student, v_academy, v_first || ' ' || v_surname,
            (current_date - make_interval(years => 6 + (i % 9), days => (i * 37) % 365))::date,
            case when i % 2 = 1 then 'male'::public.gender else 'female'::public.gender end,
            current_date - (((i * 23) % 400) + 100),
            v_level[v_level_no], 'active',
            jsonb_build_object('name', v_father_name, 'phone', v_father_phone, 'relationship', 'father'),
            case when i % 10 = 0 then 'Mild asthma — inhaler kept in skate bag' else null end);

    if i = f then
      perform pg_temp.seed_user(v_father,
        lower(v_fathers[((f - 1) % 20) + 1] || '.' || v_surname) || f || '@skating.test');
      insert into public.profiles (id, academy_id, role, full_name, phone, email)
      values (v_father, v_academy, 'parent', v_father_name, v_father_phone,
              lower(v_fathers[((f - 1) % 20) + 1] || '.' || v_surname) || f || '@skating.test');

      if f % 3 = 0 then
        perform pg_temp.seed_user(v_mother,
          lower(v_mothers[((f - 1) % 20) + 1] || '.' || v_surname) || f || '@skating.test');
        insert into public.profiles (id, academy_id, role, full_name, phone, email)
        values (v_mother, v_academy, 'parent', v_mothers[((f - 1) % 20) + 1] || ' ' || v_surname,
                '+91 97' || lpad(((20000000 + f * 6007) % 100000000)::text, 8, '0'),
                lower(v_mothers[((f - 1) % 20) + 1] || '.' || v_surname) || f || '@skating.test');
      end if;
    end if;

    insert into public.parents_students (academy_id, parent_profile_id, student_id, relationship)
    values (v_academy, v_father, v_student, 'father');
    if f % 3 = 0 then
      insert into public.parents_students (academy_id, parent_profile_id, student_id, relationship)
      values (v_academy, v_mother, v_student, 'mother');
    end if;

    insert into public.student_batches (academy_id, student_id, batch_id, enrolled_date, status)
    values (v_academy, v_student, v_batch[v_batch_no], current_date - (((i * 23) % 400) + 100), 'active');

    if i % 9 = 0 then
      v_low_attenders := v_low_attenders || v_student;
    end if;

    -- Skill progress: all earlier levels achieved; current level partly done.
    for l in 1..v_level_no loop
      for k in 1..5 loop
        v_skill_status := (case
          when l < v_level_no      then 'achieved'
          when k <= (i % 5)        then 'achieved'
          when k = (i % 5) + 1     then 'learning'
          else                          'not_started'
        end)::public.skill_status;
        insert into public.student_skills (academy_id, student_id, skill_id, status, updated_by, updated_at, notes)
        values (v_academy, v_student, md5('skill-' || l || '-' || k)::uuid, v_skill_status,
                v_coach_profile[v_batch_coach[v_batch_no]],
                now() - make_interval(days => (i * 3 + k * 11 + l * 5) % 80),
                case when v_skill_status = 'learning' and k % 2 = 0 then 'Needs more confidence on the left foot' else null end);
      end loop;
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- Sessions: 90 days back, 14 days ahead. Past = completed (4% cancelled).
  -- --------------------------------------------------------------------------
  for b in 1..6 loop
    select days_of_week into v_days from public.batches where id = v_batch[b];
    for v_date in select generate_series(current_date - 90, current_date + 14, interval '1 day')::date loop
      if extract(dow from v_date)::smallint = any (v_days) then
        if v_date < current_date then
          if random() < 0.04 then
            insert into public.schedule_sessions (academy_id, batch_id, session_date, start_time, end_time,
                                                  coach_id, status, cancellation_reason)
            values (v_academy, v_batch[b], v_date, v_batch_start[b], v_batch_end[b],
                    v_coach[v_batch_coach[b]], 'cancelled', 'Rink maintenance');
          else
            insert into public.schedule_sessions (academy_id, batch_id, session_date, start_time, end_time,
                                                  coach_id, status)
            values (v_academy, v_batch[b], v_date, v_batch_start[b], v_batch_end[b],
                    v_coach[v_batch_coach[b]], 'completed');
          end if;
        else
          insert into public.schedule_sessions (academy_id, batch_id, session_date, start_time, end_time,
                                                coach_id, status)
          values (v_academy, v_batch[b], v_date, v_batch_start[b], v_batch_end[b],
                  v_coach[v_batch_coach[b]], 'scheduled');
        end if;
      end if;
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- Attendance for every completed session. The audit trigger is paused for
  -- this bulk insert so the audit log isn't flooded with ~1,500 seed rows.
  -- --------------------------------------------------------------------------
  alter table public.attendance disable trigger audit_attendance;

  for v_session in
    select ss.id, ss.batch_id, ss.session_date, ss.end_time, c.profile_id as coach_profile_id
    from public.schedule_sessions ss
    join public.coaches c on c.id = ss.coach_id
    where ss.academy_id = v_academy and ss.status = 'completed'
  loop
    for v_enrol in
      select sb.student_id from public.student_batches sb where sb.batch_id = v_session.batch_id
    loop
      r := random();
      if v_enrol.student_id = any (v_low_attenders) then
        v_att := (case when r < 0.45 then 'present' when r < 0.90 then 'absent'
                       when r < 0.95 then 'late' else 'excused' end)::public.attendance_status;
      else
        v_att := (case when r < 0.82 then 'present' when r < 0.90 then 'absent'
                       when r < 0.96 then 'late' else 'excused' end)::public.attendance_status;
      end if;
      insert into public.attendance (academy_id, session_id, student_id, status, marked_by, marked_at, notes)
      values (v_academy, v_session.id, v_enrol.student_id, v_att, v_session.coach_profile_id,
              (v_session.session_date + v_session.end_time)::timestamptz + interval '5 minutes',
              case when v_att = 'excused' then 'Parent informed in advance' else null end);
    end loop;
  end loop;

  alter table public.attendance enable trigger audit_attendance;

  -- --------------------------------------------------------------------------
  -- Fee plans, fees for the last 3 months, payments
  -- --------------------------------------------------------------------------
  insert into public.fee_plans (id, academy_id, name, amount, billing_cycle, description) values
    (v_plan_monthly,   v_academy, 'Monthly',   2500.00, 'monthly',   'Standard monthly training fee'),
    (v_plan_quarterly, v_academy, 'Quarterly', 7000.00, 'quarterly', 'Three months paid together, ₹500 saving'),
    (v_plan_annual,    v_academy, 'Annual',    25000.00, 'annual',   'Full year, two months free');

  for i in 1..40 loop
    v_student := md5('student-' || i)::uuid;

    if i % 5 = 0 then
      -- Quarterly payers: one fee covering the last three months.
      v_ps := (v_month_start - interval '2 months')::date;
      v_pe := (v_ps + interval '3 months' - interval '1 day')::date;
      v_due := v_ps + 4;
      v_amount := 7000.00;
      v_fee := gen_random_uuid();
      v_fee_status := (case when i % 10 = 0 then 'overdue' else 'paid' end)::public.fee_status;
      insert into public.student_fees (id, academy_id, student_id, fee_plan_id, period_start, period_end, amount, due_date, status)
      values (v_fee, v_academy, v_student, v_plan_quarterly, v_ps, v_pe, v_amount, v_due, v_fee_status);
      if v_fee_status = 'paid' then
        r := random();
        v_method := (case when r < 0.5 then 'upi' when r < 0.75 then 'cash' when r < 0.9 then 'bank_transfer' else 'card' end)::public.payment_method;
        insert into public.payments (academy_id, student_fee_id, amount, paid_date, method, reference, recorded_by)
        values (v_academy, v_fee, v_amount, least(v_ps + (i % 7), current_date), v_method,
                case when v_method = 'cash' then null else upper(substr(md5(v_fee::text), 1, 10)) end, v_admin);
      end if;
    else
      -- Monthly payers: one fee per month for the last three months.
      for m in -2..0 loop
        v_ps := (v_month_start + make_interval(months => m))::date;
        v_pe := (v_ps + interval '1 month' - interval '1 day')::date;
        v_due := v_ps + 4;
        v_amount := 2500.00;
        v_fee := gen_random_uuid();
        v_pay := 0;

        if m = -2 then
          if i % 11 = 0 then
            v_fee_status := 'overdue'; v_pay := 1500.00;   -- partial payment
          else
            v_fee_status := 'paid'; v_pay := v_amount;
          end if;
        elsif m = -1 then
          if i = 13 then
            v_fee_status := 'waived';
          elsif i % 7 = 0 then
            v_fee_status := 'overdue';
          else
            v_fee_status := 'paid'; v_pay := v_amount;
          end if;
        else
          if i % 4 = 0 then
            v_fee_status := 'paid'; v_pay := v_amount;
          else
            v_fee_status := (case when v_due < current_date then 'overdue' else 'pending' end)::public.fee_status;
          end if;
        end if;

        insert into public.student_fees (id, academy_id, student_id, fee_plan_id, period_start, period_end, amount, due_date, status)
        values (v_fee, v_academy, v_student, v_plan_monthly, v_ps, v_pe, v_amount, v_due, v_fee_status);

        if v_pay > 0 then
          r := random();
          v_method := (case when r < 0.5 then 'upi' when r < 0.75 then 'cash' when r < 0.9 then 'bank_transfer' else 'card' end)::public.payment_method;
          insert into public.payments (academy_id, student_fee_id, amount, paid_date, method, reference, recorded_by, notes)
          values (v_academy, v_fee, v_pay, least(v_ps + (i % 7), current_date), v_method,
                  case when v_method = 'cash' then null else upper(substr(md5(v_fee::text), 1, 10)) end, v_admin,
                  case when v_pay < v_amount then 'Partial payment — balance promised next week' else null end);
        end if;
      end loop;
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- Announcements and notifications
  -- --------------------------------------------------------------------------
  v_ann := md5('announcement-1')::uuid;
  insert into public.announcements (id, academy_id, title, body, audience, published_at, created_by, expires_at)
  values (v_ann, v_academy, 'Rink closed this Sunday for maintenance',
          'Both rinks will be closed this Sunday for annual ice resurfacing. Weekend Juniors will have a make-up session the following Sunday.',
          'all', now() - interval '5 days', v_admin, now() + interval '10 days');
  insert into public.notifications (academy_id, profile_id, type, title, body, link, read_at)
  select v_academy, p.id, 'announcement', 'Rink closed this Sunday for maintenance',
         'Both rinks will be closed this Sunday for annual ice resurfacing.',
         '/announcements/' || v_ann,
         case when random() < 0.6 then now() - interval '4 days' else null end
  from public.profiles p where p.academy_id = v_academy;

  v_ann := md5('announcement-2')::uuid;
  insert into public.announcements (id, academy_id, title, body, audience, published_at, created_by)
  values (v_ann, v_academy, 'Fee reminder for ' || trim(to_char(current_date, 'Month')),
          'A gentle reminder that this month''s fees are due by the 5th. Pay via UPI to the academy account or at the front desk.',
          'parents', now() - interval '2 days', v_admin);
  insert into public.notifications (academy_id, profile_id, type, title, body, link, read_at)
  select v_academy, p.id, 'announcement', 'Fee reminder for ' || trim(to_char(current_date, 'Month')),
         'This month''s fees are due by the 5th.',
         '/announcements/' || v_ann,
         case when random() < 0.3 then now() - interval '1 day' else null end
  from public.profiles p where p.academy_id = v_academy and p.role = 'parent';

  v_ann := md5('announcement-3')::uuid;
  insert into public.announcements (id, academy_id, title, body, audience, batch_id, published_at, created_by)
  values (v_ann, v_academy, 'Advanced batch: timing change from next week',
          'From next Monday the Advanced batch moves to 6:15–7:45 pm to allow extra warm-up time before jumps practice.',
          'batch', v_batch[5], now() - interval '1 day', v_admin);

  -- --------------------------------------------------------------------------
  -- Feature flags
  -- --------------------------------------------------------------------------
  insert into public.feature_flags (key, description, enabled_globally, academy_overrides) values
    ('online_payments',    'Razorpay online fee payment (Phase 6)',        false, '{}'::jsonb),
    ('whatsapp_reminders', 'WhatsApp fee and cancellation reminders',      false, '{}'::jsonb),
    ('skill_progression',  'Skill progression screens for coaches/parents', true, '{}'::jsonb);
end;
$seed$;

drop function pg_temp.seed_user(uuid, text);
