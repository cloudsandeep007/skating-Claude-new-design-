-- =============================================================================
-- 0001_initial_schema.sql — Skating Academy: complete initial database
-- =============================================================================
-- Run this whole file once on a fresh Supabase project (SQL editor, or
-- `supabase db push`). It is idempotent-unsafe by design: it CREATES
-- everything and assumes nothing exists yet.
--
-- Sections (search for "-- ## " to jump between them):
--   1. Extensions and enums
--   2. Tables (in dependency order)
--   3. Indexes
--   4. Helper functions (role / academy lookups used by RLS)
--   5. Triggers (updated_at, audit log)
--   6. Row Level Security policies
--   7. Dashboard views and RPC functions
--
-- Tenancy model: every tenant-owned table carries academy_id. Child tables
-- reference their parent with a COMPOSITE foreign key (parent_id, academy_id)
-- so a row can never point at a row in a different academy — the database
-- enforces it, not application code.
-- =============================================================================


-- ## 1. Extensions and enums -------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

create type public.app_role             as enum ('super_admin', 'academy_admin', 'coach', 'parent');
create type public.academy_status       as enum ('active', 'suspended', 'archived');
create type public.plan_tier            as enum ('free', 'starter', 'pro');
create type public.profile_status       as enum ('active', 'invited', 'inactive');
create type public.gender               as enum ('male', 'female', 'other');
create type public.student_status       as enum ('active', 'inactive', 'archived');
create type public.parent_relationship  as enum ('father', 'mother', 'guardian', 'other');
create type public.coach_status         as enum ('active', 'inactive');
create type public.batch_status         as enum ('active', 'inactive', 'archived');
create type public.enrollment_status    as enum ('active', 'inactive');
create type public.session_status       as enum ('scheduled', 'completed', 'cancelled');
create type public.attendance_status    as enum ('present', 'absent', 'late', 'excused');
create type public.skill_status         as enum ('not_started', 'learning', 'achieved');
create type public.billing_cycle        as enum ('monthly', 'quarterly', 'annual');
create type public.fee_status           as enum ('pending', 'paid', 'overdue', 'waived');
create type public.payment_method       as enum ('cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other');
create type public.announcement_audience as enum ('all', 'batch', 'parents', 'coaches');
create type public.error_level          as enum ('debug', 'info', 'warning', 'error', 'fatal');


-- ## 2. Tables ----------------------------------------------------------------

-- 2.1 academies — one row per tenant.
create table public.academies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url    text,
  address     text,
  phone       text,
  email       text,
  plan_tier   public.plan_tier not null default 'free',
  status      public.academy_status not null default 'active',
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.2 profiles — one row per auth user. super_admin has no academy; every
-- other role must belong to exactly one academy.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  academy_id  uuid references public.academies (id) on delete restrict,
  role        public.app_role not null,
  full_name   text not null,
  phone       text,
  email       text,
  avatar_url  text,
  status      public.profile_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_academy_matches_role
    check ((role = 'super_admin') = (academy_id is null))
);

-- 2.3 levels and skills — the skating progression ladder, per academy.
create table public.levels (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references public.academies (id) on delete cascade,
  name        text not null,
  sequence    integer not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (academy_id, name),
  unique (id, academy_id)
);

create table public.skills (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references public.academies (id) on delete cascade,
  level_id    uuid not null,
  name        text not null,
  sequence    integer not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (level_id, academy_id) references public.levels (id, academy_id) on delete cascade,
  unique (level_id, name),
  unique (id, academy_id)
);

-- 2.4 students
create table public.students (
  id                uuid primary key default gen_random_uuid(),
  academy_id        uuid not null references public.academies (id) on delete cascade,
  full_name         text not null,
  date_of_birth     date,
  gender            public.gender,
  photo_url         text,
  joined_date       date not null default current_date,
  current_level_id  uuid,
  status            public.student_status not null default 'active',
  -- shape: {"name": "...", "phone": "...", "relationship": "..."}
  emergency_contact jsonb not null default '{}'::jsonb,
  medical_notes     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (current_level_id, academy_id) references public.levels (id, academy_id)
    on delete set null (current_level_id),
  unique (id, academy_id)
);

-- 2.5 parents_students — many-to-many between parent profiles and students.
create table public.parents_students (
  academy_id        uuid not null references public.academies (id) on delete cascade,
  parent_profile_id uuid not null references public.profiles (id) on delete cascade,
  student_id        uuid not null,
  relationship      public.parent_relationship not null default 'guardian',
  created_at        timestamptz not null default now(),
  primary key (parent_profile_id, student_id),
  foreign key (student_id, academy_id) references public.students (id, academy_id) on delete cascade
);

-- 2.6 coaches — a coach is a profile with extra coaching details.
create table public.coaches (
  id              uuid primary key default gen_random_uuid(),
  academy_id      uuid not null references public.academies (id) on delete cascade,
  profile_id      uuid not null unique references public.profiles (id) on delete cascade,
  specialization  text,
  joined_date     date not null default current_date,
  status          public.coach_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, academy_id)
);

-- 2.7 batches — a recurring class group. days_of_week uses 0 = Sunday … 6 = Saturday.
create table public.batches (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references public.academies (id) on delete cascade,
  name          text not null,
  level_range   text,
  coach_id      uuid,
  capacity      integer not null default 10 check (capacity > 0),
  start_time    time not null,
  end_time      time not null,
  days_of_week  smallint[] not null default '{}'::smallint[]
                check (days_of_week <@ '{0,1,2,3,4,5,6}'::smallint[]),
  venue         text,
  status        public.batch_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint batches_time_order check (end_time > start_time),
  foreign key (coach_id, academy_id) references public.coaches (id, academy_id)
    on delete set null (coach_id),
  unique (academy_id, name),
  unique (id, academy_id)
);

-- 2.8 student_batches — enrollment.
create table public.student_batches (
  academy_id    uuid not null references public.academies (id) on delete cascade,
  student_id    uuid not null,
  batch_id      uuid not null,
  enrolled_date date not null default current_date,
  status        public.enrollment_status not null default 'active',
  created_at    timestamptz not null default now(),
  primary key (student_id, batch_id),
  foreign key (student_id, academy_id) references public.students (id, academy_id) on delete cascade,
  foreign key (batch_id, academy_id)   references public.batches  (id, academy_id) on delete cascade
);

-- 2.9 schedule_sessions — one concrete class on one date.
create table public.schedule_sessions (
  id                  uuid primary key default gen_random_uuid(),
  academy_id          uuid not null references public.academies (id) on delete cascade,
  batch_id            uuid not null,
  session_date        date not null,
  start_time          time not null,
  end_time            time not null,
  coach_id            uuid,
  status              public.session_status not null default 'scheduled',
  cancellation_reason text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint sessions_time_order check (end_time > start_time),
  constraint sessions_cancel_needs_reason
    check (status <> 'cancelled' or cancellation_reason is not null),
  foreign key (batch_id, academy_id) references public.batches (id, academy_id) on delete cascade,
  foreign key (coach_id, academy_id) references public.coaches (id, academy_id)
    on delete set null (coach_id),
  unique (batch_id, session_date, start_time),
  unique (id, academy_id)
);

-- 2.10 attendance — one row per student per session.
create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references public.academies (id) on delete cascade,
  session_id  uuid not null,
  student_id  uuid not null,
  status      public.attendance_status not null,
  marked_by   uuid references public.profiles (id) on delete set null,
  marked_at   timestamptz not null default now(),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (session_id, academy_id) references public.schedule_sessions (id, academy_id) on delete cascade,
  foreign key (student_id, academy_id) references public.students (id, academy_id) on delete cascade,
  unique (session_id, student_id)
);

-- 2.11 student_skills — progress on each skill.
create table public.student_skills (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references public.academies (id) on delete cascade,
  student_id  uuid not null,
  skill_id    uuid not null,
  status      public.skill_status not null default 'not_started',
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  notes       text,
  created_at  timestamptz not null default now(),
  foreign key (student_id, academy_id) references public.students (id, academy_id) on delete cascade,
  foreign key (skill_id, academy_id)   references public.skills   (id, academy_id) on delete cascade,
  unique (student_id, skill_id)
);

-- 2.12 fees
create table public.fee_plans (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references public.academies (id) on delete cascade,
  name          text not null,
  amount        numeric(10, 2) not null check (amount >= 0),
  billing_cycle public.billing_cycle not null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (academy_id, name),
  unique (id, academy_id)
);

create table public.student_fees (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references public.academies (id) on delete cascade,
  student_id    uuid not null,
  fee_plan_id   uuid,
  period_start  date not null,
  period_end    date not null,
  amount        numeric(10, 2) not null check (amount >= 0),
  due_date      date not null,
  status        public.fee_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint student_fees_period_order check (period_end >= period_start),
  foreign key (student_id, academy_id)  references public.students  (id, academy_id) on delete cascade,
  foreign key (fee_plan_id, academy_id) references public.fee_plans (id, academy_id)
    on delete set null (fee_plan_id),
  unique (id, academy_id)
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  academy_id      uuid not null references public.academies (id) on delete cascade,
  student_fee_id  uuid not null,
  amount          numeric(10, 2) not null check (amount > 0),
  paid_date       date not null default current_date,
  method          public.payment_method not null default 'cash',
  reference       text,
  recorded_by     uuid references public.profiles (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (student_fee_id, academy_id) references public.student_fees (id, academy_id) on delete restrict
);

-- 2.13 announcements and notifications
create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references public.academies (id) on delete cascade,
  title         text not null,
  body          text not null,
  audience      public.announcement_audience not null default 'all',
  batch_id      uuid,
  published_at  timestamptz,           -- null = draft; future = scheduled
  created_by    uuid references public.profiles (id) on delete set null,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint announcements_batch_audience_needs_batch
    check (audience <> 'batch' or batch_id is not null),
  foreign key (batch_id, academy_id) references public.batches (id, academy_id)
    on delete set null (batch_id)
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references public.academies (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  type        text not null,           -- e.g. 'announcement', 'session_cancelled', 'fee_due'
  title       text not null,
  body        text,
  read_at     timestamptz,
  link        text,                    -- in-app route to open on tap
  created_at  timestamptz not null default now()
);

-- 2.14 platform tables
create table public.audit_logs (
  id                uuid primary key default gen_random_uuid(),
  academy_id        uuid references public.academies (id) on delete cascade,
  actor_profile_id  uuid references public.profiles (id) on delete set null,
  action            text not null,     -- 'insert' | 'update' | 'delete' | free text for app-level actions
  entity_type       text not null,     -- table name
  entity_id         uuid,
  changes           jsonb,
  ip                inet,
  created_at        timestamptz not null default now()
);

create table public.error_logs (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid references public.academies (id) on delete cascade,
  profile_id  uuid references public.profiles (id) on delete set null,
  level       public.error_level not null default 'error',
  message     text not null,
  stack       text,
  route       text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create table public.feature_flags (
  id                uuid primary key default gen_random_uuid(),
  key               text not null unique check (key ~ '^[a-z0-9_]+$'),
  description       text,
  enabled_globally  boolean not null default false,
  -- shape: {"<academy_id>": true|false}
  academy_overrides jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);


-- ## 3. Indexes ---------------------------------------------------------------
-- Every foreign key and every column RLS or list screens filter on.

create index profiles_academy_id_idx        on public.profiles (academy_id);
create index profiles_academy_role_idx      on public.profiles (academy_id, role);
create index profiles_email_idx             on public.profiles (email);

create index levels_academy_sequence_idx    on public.levels (academy_id, sequence);
create index skills_academy_id_idx          on public.skills (academy_id);
create index skills_level_sequence_idx      on public.skills (level_id, sequence);

create index students_academy_status_idx    on public.students (academy_id, status);
create index students_academy_name_idx      on public.students (academy_id, full_name);
create index students_current_level_idx     on public.students (current_level_id);

create index parents_students_student_idx   on public.parents_students (student_id);
create index parents_students_academy_idx   on public.parents_students (academy_id);

create index coaches_academy_status_idx     on public.coaches (academy_id, status);

create index batches_academy_status_idx     on public.batches (academy_id, status);
create index batches_coach_idx              on public.batches (coach_id);

create index student_batches_batch_idx      on public.student_batches (batch_id, status);
create index student_batches_academy_idx    on public.student_batches (academy_id);

create index sessions_academy_date_idx      on public.schedule_sessions (academy_id, session_date);
create index sessions_academy_status_idx    on public.schedule_sessions (academy_id, status);
create index sessions_batch_date_idx        on public.schedule_sessions (batch_id, session_date);
create index sessions_coach_date_idx        on public.schedule_sessions (coach_id, session_date);

create index attendance_academy_student_idx on public.attendance (academy_id, student_id);
create index attendance_academy_status_idx  on public.attendance (academy_id, status);
create index attendance_student_idx         on public.attendance (student_id);
create index attendance_marked_by_idx       on public.attendance (marked_by);

create index student_skills_academy_idx     on public.student_skills (academy_id);
create index student_skills_skill_idx       on public.student_skills (skill_id);
create index student_skills_updated_by_idx  on public.student_skills (updated_by);

create index fee_plans_academy_idx          on public.fee_plans (academy_id);

create index student_fees_academy_status_idx on public.student_fees (academy_id, status);
create index student_fees_academy_due_idx    on public.student_fees (academy_id, due_date);
create index student_fees_academy_period_idx on public.student_fees (academy_id, period_start);
create index student_fees_student_idx        on public.student_fees (student_id);
create index student_fees_plan_idx           on public.student_fees (fee_plan_id);

create index payments_academy_date_idx      on public.payments (academy_id, paid_date);
create index payments_fee_idx               on public.payments (student_fee_id);
create index payments_recorded_by_idx       on public.payments (recorded_by);

create index announcements_academy_pub_idx  on public.announcements (academy_id, published_at desc);
create index announcements_batch_idx        on public.announcements (batch_id);
create index announcements_created_by_idx   on public.announcements (created_by);

create index notifications_profile_read_idx on public.notifications (profile_id, read_at);
create index notifications_profile_time_idx on public.notifications (profile_id, created_at desc);
create index notifications_academy_idx      on public.notifications (academy_id);

create index audit_logs_academy_time_idx    on public.audit_logs (academy_id, created_at desc);
create index audit_logs_actor_idx           on public.audit_logs (actor_profile_id);
create index audit_logs_entity_idx          on public.audit_logs (entity_type, entity_id);

create index error_logs_academy_time_idx    on public.error_logs (academy_id, created_at desc);
create index error_logs_profile_idx         on public.error_logs (profile_id);
create index error_logs_level_idx           on public.error_logs (level);


-- ## 4. Helper functions ------------------------------------------------------
-- All STABLE so Postgres evaluates them once per statement, and SECURITY
-- DEFINER so they can read profiles/parents_students without tripping RLS.
-- RLS policies below call them as (select fn()) so the planner caches the
-- result as an InitPlan instead of re-running it per row.

create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_academy_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select academy_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'super_admin', false);
$$;

create or replace function public.is_academy_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'academy_admin', false);
$$;

create or replace function public.is_coach()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'coach', false);
$$;

create or replace function public.is_parent()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'parent', false);
$$;

-- Students the current user is a parent of. Returns '{}' for non-parents.
create or replace function public.parent_student_ids()
returns uuid[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(array_agg(student_id), '{}'::uuid[])
  from public.parents_students
  where parent_profile_id = auth.uid();
$$;

-- Batches any of the current user's children are actively enrolled in.
create or replace function public.parent_batch_ids()
returns uuid[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(array_agg(sb.batch_id), '{}'::uuid[])
  from public.student_batches sb
  where sb.status = 'active'
    and sb.student_id = any (public.parent_student_ids());
$$;

-- Client IP from the PostgREST request headers, or null outside a request.
create or replace function public.request_ip()
returns inet
language plpgsql stable
as $$
declare
  v_ip text;
begin
  v_ip := split_part(
    coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''),
    ',', 1);
  return nullif(trim(v_ip), '')::inet;
exception when others then
  return null;
end;
$$;

-- ## 5. Triggers --------------------------------------------------------------

-- 5.1 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.academies         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles          for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.levels            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.skills            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.students          for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.coaches           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.batches           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.schedule_sessions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.attendance        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.student_skills    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.fee_plans         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.student_fees      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.payments          for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.announcements     for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.feature_flags     for each row execute function public.set_updated_at();

-- 5.2 Audit log. SECURITY DEFINER so the insert into audit_logs succeeds
-- regardless of the acting user's RLS permissions on audit_logs.
-- For updates only the changed columns are stored as {"col": {"old", "new"}};
-- updated_at is ignored so a no-op update writes nothing.
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_old      jsonb;
  v_new      jsonb;
  v_changes  jsonb;
  v_academy  uuid;
  v_entity   uuid;
begin
  if tg_op = 'INSERT' then
    v_new     := to_jsonb(new);
    v_changes := jsonb_build_object('new', v_new);
    v_academy := new.academy_id;
    v_entity  := new.id;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select jsonb_object_agg(key, jsonb_build_object('old', v_old -> key, 'new', v_new -> key))
      into v_changes
    from jsonb_each(v_new)
    where key <> 'updated_at'
      and v_old -> key is distinct from v_new -> key;
    if v_changes is null then
      return null;
    end if;
    v_academy := new.academy_id;
    v_entity  := new.id;
  else
    v_old     := to_jsonb(old);
    v_changes := jsonb_build_object('old', v_old);
    v_academy := old.academy_id;
    v_entity  := old.id;
  end if;

  insert into public.audit_logs (academy_id, actor_profile_id, action, entity_type, entity_id, changes, ip)
  values (v_academy, auth.uid(), lower(tg_op), tg_table_name, v_entity, v_changes, public.request_ip());

  return null;
end;
$$;

create trigger audit_students     after insert or update or delete on public.students     for each row execute function public.audit_row_change();
create trigger audit_student_fees after insert or update or delete on public.student_fees for each row execute function public.audit_row_change();
create trigger audit_payments     after insert or update or delete on public.payments     for each row execute function public.audit_row_change();
create trigger audit_attendance   after insert or update or delete on public.attendance   for each row execute function public.audit_row_change();


-- ## 6. Row Level Security ----------------------------------------------------
-- Rules:
--   super_admin   — everything, everywhere
--   academy_admin — everything inside their own academy
--   coach         — read their academy's people/batches/sessions/progression;
--                   write attendance and student_skills
--   parent        — read only their own children's data
-- Every policy filters on an indexed column (academy_id, id, student_id, …).

alter table public.academies         enable row level security;
alter table public.profiles          enable row level security;
alter table public.levels            enable row level security;
alter table public.skills            enable row level security;
alter table public.students          enable row level security;
alter table public.parents_students  enable row level security;
alter table public.coaches           enable row level security;
alter table public.batches           enable row level security;
alter table public.student_batches   enable row level security;
alter table public.schedule_sessions enable row level security;
alter table public.attendance        enable row level security;
alter table public.student_skills    enable row level security;
alter table public.fee_plans         enable row level security;
alter table public.student_fees      enable row level security;
alter table public.payments          enable row level security;
alter table public.announcements     enable row level security;
alter table public.notifications     enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.error_logs        enable row level security;
alter table public.feature_flags     enable row level security;

-- 6.1 academies
create policy academies_super_all on public.academies for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy academies_member_select on public.academies for select to authenticated
  using (id = (select public.current_academy_id()));
create policy academies_admin_update on public.academies for update to authenticated
  using ((select public.is_academy_admin()) and id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and id = (select public.current_academy_id()));

-- 6.2 profiles
create policy profiles_super_all on public.profiles for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
-- Own row, or same academy where either the viewer or the target is staff.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (
      academy_id = (select public.current_academy_id())
      and ((select public.current_user_role()) in ('academy_admin', 'coach')
           or role in ('academy_admin', 'coach'))
    )
  );
-- Users may edit their own row but never their own role or academy.
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select public.current_user_role())
    and academy_id is not distinct from (select public.current_academy_id())
  );
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check (
    (select public.is_academy_admin())
    and academy_id = (select public.current_academy_id())
    and role <> 'super_admin'
  );
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check (
    (select public.is_academy_admin())
    and academy_id = (select public.current_academy_id())
    and role <> 'super_admin'
  );

-- 6.3 levels / skills — admin manages, everyone in the academy reads.
create policy levels_super_all on public.levels for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy levels_admin_all on public.levels for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy levels_member_select on public.levels for select to authenticated
  using (academy_id = (select public.current_academy_id()));

create policy skills_super_all on public.skills for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy skills_admin_all on public.skills for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy skills_member_select on public.skills for select to authenticated
  using (academy_id = (select public.current_academy_id()));

-- 6.4 students
create policy students_super_all on public.students for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy students_admin_all on public.students for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy students_coach_select on public.students for select to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()));
create policy students_parent_select on public.students for select to authenticated
  using (id = any ((select public.parent_student_ids())::uuid[]));

-- 6.5 parents_students
create policy parents_students_super_all on public.parents_students for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy parents_students_admin_all on public.parents_students for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy parents_students_coach_select on public.parents_students for select to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()));
create policy parents_students_parent_select on public.parents_students for select to authenticated
  using (parent_profile_id = (select auth.uid()));

-- 6.6 coaches
create policy coaches_super_all on public.coaches for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy coaches_admin_all on public.coaches for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy coaches_member_select on public.coaches for select to authenticated
  using (academy_id = (select public.current_academy_id()));

-- 6.7 batches
create policy batches_super_all on public.batches for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy batches_admin_all on public.batches for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy batches_coach_select on public.batches for select to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()));
create policy batches_parent_select on public.batches for select to authenticated
  using (id = any ((select public.parent_batch_ids())::uuid[]));

-- 6.8 student_batches
create policy student_batches_super_all on public.student_batches for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy student_batches_admin_all on public.student_batches for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy student_batches_coach_select on public.student_batches for select to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()));
create policy student_batches_parent_select on public.student_batches for select to authenticated
  using (student_id = any ((select public.parent_student_ids())::uuid[]));

-- 6.9 schedule_sessions
create policy sessions_super_all on public.schedule_sessions for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy sessions_admin_all on public.schedule_sessions for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy sessions_coach_select on public.schedule_sessions for select to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()));
create policy sessions_parent_select on public.schedule_sessions for select to authenticated
  using (batch_id = any ((select public.parent_batch_ids())::uuid[]));

-- 6.10 attendance — coaches write, parents read their children's rows.
create policy attendance_super_all on public.attendance for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy attendance_admin_all on public.attendance for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy attendance_coach_select on public.attendance for select to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()));
create policy attendance_coach_insert on public.attendance for insert to authenticated
  with check (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and marked_by = (select auth.uid())
  );
create policy attendance_coach_update on public.attendance for update to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()))
  with check (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and marked_by = (select auth.uid())
  );
create policy attendance_parent_select on public.attendance for select to authenticated
  using (student_id = any ((select public.parent_student_ids())::uuid[]));

-- 6.11 student_skills — coaches write, parents read their children's rows.
create policy student_skills_super_all on public.student_skills for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy student_skills_admin_all on public.student_skills for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy student_skills_coach_select on public.student_skills for select to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()));
create policy student_skills_coach_insert on public.student_skills for insert to authenticated
  with check (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and updated_by = (select auth.uid())
  );
create policy student_skills_coach_update on public.student_skills for update to authenticated
  using ((select public.is_coach()) and academy_id = (select public.current_academy_id()))
  with check (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and updated_by = (select auth.uid())
  );
create policy student_skills_parent_select on public.student_skills for select to authenticated
  using (student_id = any ((select public.parent_student_ids())::uuid[]));

-- 6.12 fees — admin manages; parents see their children's fees and payments.
create policy fee_plans_super_all on public.fee_plans for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy fee_plans_admin_all on public.fee_plans for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy fee_plans_member_select on public.fee_plans for select to authenticated
  using (academy_id = (select public.current_academy_id()));

create policy student_fees_super_all on public.student_fees for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy student_fees_admin_all on public.student_fees for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy student_fees_parent_select on public.student_fees for select to authenticated
  using (student_id = any ((select public.parent_student_ids())::uuid[]));

create policy payments_super_all on public.payments for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy payments_admin_all on public.payments for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy payments_parent_select on public.payments for select to authenticated
  using (
    student_fee_id in (
      select f.id from public.student_fees f
      where f.student_id = any ((select public.parent_student_ids())::uuid[])
    )
  );

-- 6.13 announcements — readers only see published, unexpired posts aimed at them.
create policy announcements_super_all on public.announcements for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy announcements_admin_all on public.announcements for all to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()))
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy announcements_coach_select on public.announcements for select to authenticated
  using (
    (select public.is_coach())
    and academy_id = (select public.current_academy_id())
    and audience in ('all', 'coaches', 'batch')
    and published_at is not null and published_at <= now()
    and (expires_at is null or expires_at > now())
  );
create policy announcements_parent_select on public.announcements for select to authenticated
  using (
    (select public.is_parent())
    and academy_id = (select public.current_academy_id())
    and (
      audience in ('all', 'parents')
      or (audience = 'batch' and batch_id = any ((select public.parent_batch_ids())::uuid[]))
    )
    and published_at is not null and published_at <= now()
    and (expires_at is null or expires_at > now())
  );

-- 6.14 notifications — each user sees and marks their own; admins create them.
create policy notifications_super_all on public.notifications for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy notifications_own_select on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy notifications_admin_insert on public.notifications for insert to authenticated
  with check ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));
create policy notifications_admin_select on public.notifications for select to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));

-- 6.15 audit_logs — written only by the trigger; admins read their academy's.
create policy audit_logs_super_all on public.audit_logs for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy audit_logs_admin_select on public.audit_logs for select to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));

-- 6.16 error_logs — anyone (even logged-out) may report; admins read their academy's.
create policy error_logs_super_all on public.error_logs for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy error_logs_insert on public.error_logs for insert to anon, authenticated
  with check (
    (profile_id is null or profile_id = (select auth.uid()))
    and (academy_id is null or academy_id = (select public.current_academy_id()))
  );
create policy error_logs_admin_select on public.error_logs for select to authenticated
  using ((select public.is_academy_admin()) and academy_id = (select public.current_academy_id()));

-- 6.17 feature_flags — global; everyone reads, only super_admin writes.
create policy feature_flags_super_all on public.feature_flags for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy feature_flags_select on public.feature_flags for select to authenticated
  using (true);


-- ## 7. Dashboard views and RPC functions -------------------------------------
-- The frontend reads these instead of aggregating raw tables. All are
-- security_invoker so RLS still applies: an academy_admin sees their academy,
-- a parent sees only their own children.
--
-- Attendance % rule: attended = present + late; counted = present + absent +
-- late. 'excused' is excluded from both, so an excused absence never lowers
-- a student's percentage.

create view public.student_attendance_summary
with (security_invoker = true) as
with counts as (
  select
    a.academy_id,
    a.student_id,
    count(*) filter (where a.status in ('present', 'absent', 'late')) as counted_sessions,
    count(*) filter (where a.status in ('present', 'late'))           as attended_sessions,
    count(*) filter (where a.status = 'absent')                        as absent_sessions,
    count(*) filter (where a.status = 'late')                          as late_sessions,
    count(*) filter (where a.status = 'excused')                       as excused_sessions
  from public.attendance a
  group by a.academy_id, a.student_id
)
select
  c.academy_id,
  c.student_id,
  s.full_name,
  s.status as student_status,
  c.counted_sessions,
  c.attended_sessions,
  c.absent_sessions,
  c.late_sessions,
  c.excused_sessions,
  round(100.0 * c.attended_sessions / nullif(c.counted_sessions, 0), 1) as attendance_pct
from counts c
join public.students s on s.id = c.student_id;

create view public.batch_attendance_summary
with (security_invoker = true) as
with counts as (
  select
    a.academy_id,
    ss.batch_id,
    count(distinct ss.id)                                              as sessions_marked,
    count(*) filter (where a.status in ('present', 'absent', 'late')) as counted_sessions,
    count(*) filter (where a.status in ('present', 'late'))           as attended_sessions
  from public.attendance a
  join public.schedule_sessions ss on ss.id = a.session_id
  group by a.academy_id, ss.batch_id
)
select
  c.academy_id,
  c.batch_id,
  b.name as batch_name,
  b.status as batch_status,
  c.sessions_marked,
  c.counted_sessions,
  c.attended_sessions,
  round(100.0 * c.attended_sessions / nullif(c.counted_sessions, 0), 1) as attendance_pct
from counts c
join public.batches b on b.id = c.batch_id;

-- One row per academy per calendar month: what was collected (by paid_date)
-- and what was expected / still outstanding (by due_date).
create view public.monthly_collection_totals
with (security_invoker = true) as
with collected as (
  select
    p.academy_id,
    date_trunc('month', p.paid_date)::date as month,
    sum(p.amount)                          as collected,
    count(*)                               as payment_count
  from public.payments p
  group by p.academy_id, date_trunc('month', p.paid_date)::date
),
fee_balance as (
  select
    f.academy_id,
    date_trunc('month', f.due_date)::date as month,
    f.amount,
    f.status,
    f.amount - coalesce((select sum(p.amount) from public.payments p where p.student_fee_id = f.id), 0) as balance
  from public.student_fees f
),
expected as (
  select
    academy_id,
    month,
    sum(amount) filter (where status <> 'waived')                            as expected,
    sum(greatest(balance, 0)) filter (where status in ('pending', 'overdue')) as outstanding,
    count(*) filter (where status = 'overdue')                               as overdue_count,
    count(*) filter (where status = 'pending')                               as pending_count,
    count(*) filter (where status = 'paid')                                  as paid_count,
    count(*) filter (where status = 'waived')                                as waived_count
  from fee_balance
  group by academy_id, month
)
select
  academy_id,
  month,
  coalesce(c.collected, 0)      as collected,
  coalesce(c.payment_count, 0)  as payment_count,
  coalesce(e.expected, 0)       as expected,
  coalesce(e.outstanding, 0)    as outstanding,
  coalesce(e.overdue_count, 0)  as overdue_count,
  coalesce(e.pending_count, 0)  as pending_count,
  coalesce(e.paid_count, 0)     as paid_count,
  coalesce(e.waived_count, 0)   as waived_count
from collected c
full join expected e using (academy_id, month);

-- Active students under 60% attendance over the last 30 days, with at least
-- 3 counted sessions so one missed class doesn't flag a brand-new student.
create view public.at_risk_students
with (security_invoker = true) as
with recent as (
  select
    a.academy_id,
    a.student_id,
    count(*) filter (where a.status in ('present', 'absent', 'late')) as counted_sessions,
    count(*) filter (where a.status in ('present', 'late'))           as attended_sessions
  from public.attendance a
  join public.schedule_sessions ss on ss.id = a.session_id
  where ss.session_date > current_date - 30
    and ss.session_date <= current_date
  group by a.academy_id, a.student_id
)
select
  r.academy_id,
  r.student_id,
  s.full_name,
  r.counted_sessions,
  r.attended_sessions,
  round(100.0 * r.attended_sessions / nullif(r.counted_sessions, 0), 1) as attendance_pct,
  (select string_agg(b.name, ', ' order by b.name)
     from public.student_batches sb
     join public.batches b on b.id = sb.batch_id
    where sb.student_id = s.id and sb.status = 'active')     as batch_names,
  (select p.full_name
     from public.parents_students ps
     join public.profiles p on p.id = ps.parent_profile_id
    where ps.student_id = s.id
    order by ps.relationship limit 1)                        as parent_name,
  (select p.phone
     from public.parents_students ps
     join public.profiles p on p.id = ps.parent_profile_id
    where ps.student_id = s.id
    order by ps.relationship limit 1)                        as parent_phone
from recent r
join public.students s on s.id = r.student_id
where s.status = 'active'
  and r.counted_sessions >= 3
  -- nullif (not a plain divide) so a 0-counted row can never raise a
  -- division-by-zero: Postgres does not guarantee AND evaluates left-to-right.
  and 100.0 * r.attended_sessions / nullif(r.counted_sessions, 0) < 60;

-- Same attendance rule as the views, but for a chosen date range and
-- optionally a single batch. Use for the admin "attendance over a range" report.
create or replace function public.attendance_summary_for_range(
  p_from     date,
  p_to       date,
  p_batch_id uuid default null
)
returns table (
  student_id        uuid,
  full_name         text,
  counted_sessions  bigint,
  attended_sessions bigint,
  absent_sessions   bigint,
  late_sessions     bigint,
  excused_sessions  bigint,
  attendance_pct    numeric
)
language sql stable
as $$
  select
    s.id,
    s.full_name,
    count(*) filter (where a.status in ('present', 'absent', 'late')),
    count(*) filter (where a.status in ('present', 'late')),
    count(*) filter (where a.status = 'absent'),
    count(*) filter (where a.status = 'late'),
    count(*) filter (where a.status = 'excused'),
    round(100.0 * count(*) filter (where a.status in ('present', 'late'))
          / nullif(count(*) filter (where a.status in ('present', 'absent', 'late')), 0), 1)
  from public.attendance a
  join public.schedule_sessions ss on ss.id = a.session_id
  join public.students s on s.id = a.student_id
  where ss.session_date between p_from and p_to
    and (p_batch_id is null or ss.batch_id = p_batch_id)
  group by s.id, s.full_name
  order by s.full_name;
$$;

-- Same as the at_risk_students view but with adjustable window / threshold.
create or replace function public.at_risk_students_for(
  p_days         integer default 30,
  p_threshold    numeric default 60,
  p_min_sessions integer default 3
)
returns table (
  student_id        uuid,
  full_name         text,
  counted_sessions  bigint,
  attended_sessions bigint,
  attendance_pct    numeric
)
language sql stable
as $$
  with recent as (
    select
      a.student_id,
      count(*) filter (where a.status in ('present', 'absent', 'late')) as counted,
      count(*) filter (where a.status in ('present', 'late'))           as attended
    from public.attendance a
    join public.schedule_sessions ss on ss.id = a.session_id
    where ss.session_date > current_date - p_days
      and ss.session_date <= current_date
    group by a.student_id
  )
  select
    s.id,
    s.full_name,
    r.counted,
    r.attended,
    round(100.0 * r.attended / nullif(r.counted, 0), 1)
  from recent r
  join public.students s on s.id = r.student_id
  where s.status = 'active'
    and r.counted >= p_min_sessions
    and 100.0 * r.attended / nullif(r.counted, 0) < p_threshold
  order by 100.0 * r.attended / nullif(r.counted, 0) asc, s.full_name;
$$;
