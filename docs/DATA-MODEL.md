# Data model

Every table in the Supabase database, its columns, relationships, and
row-level security (RLS) policies. Update this file in the same session
as any migration that changes the schema.

Source of truth: `supabase/migrations/0001_initial_schema.sql`. Demo data:
`supabase/seed.sql`.

## Conventions that apply everywhere

- Primary keys are `uuid` with `default gen_random_uuid()`.
- Every tenant-owned table has `academy_id` (not null, FK to `academies`,
  `on delete cascade`) and an index that starts with `academy_id`.
- **Composite foreign keys for tenant integrity.** Child tables reference
  their parent as `(parent_id, academy_id) → parent(id, academy_id)`. This
  makes it impossible for, say, an attendance row in academy A to point at
  a session in academy B — Postgres rejects it, no app code needed. Every
  parent table therefore has a `unique (id, academy_id)` constraint.
- `created_at` / `updated_at` are `timestamptz`; `updated_at` is kept
  current by a `set_updated_at` trigger on every table that has it.
- Statuses and other fixed choices are Postgres **enums** (listed below),
  so the generated TypeScript types are string unions.
- Dates that are "just a day" (birthdays, session dates, due dates) are
  `date`; clock times are `time`; moments are `timestamptz`.

## Enums

| Enum                    | Values                                                    |
| ----------------------- | --------------------------------------------------------- |
| `app_role`              | super_admin, academy_admin, coach, parent                 |
| `academy_status`        | active, suspended, archived                               |
| `plan_tier`             | free, starter, pro                                        |
| `profile_status`        | active, invited, inactive                                 |
| `gender`                | male, female, other                                       |
| `student_status`        | active, inactive, archived                                |
| `parent_relationship`   | father, mother, guardian, other                           |
| `coach_status`          | active, inactive                                          |
| `batch_status`          | active, inactive, archived                                |
| `enrollment_status`     | active, inactive                                          |
| `session_status`        | scheduled, completed, cancelled                           |
| `attendance_status`     | present, absent, late, excused                            |
| `skill_status`          | not_started, learning, achieved                           |
| `billing_cycle`         | monthly, quarterly, annual                                |
| `fee_status`            | pending, paid, overdue, waived                            |
| `payment_method`        | cash, upi, card, bank_transfer, cheque, other             |
| `announcement_audience` | all, batch, parents, coaches                              |
| `error_level`           | debug, info, warning, error, fatal                        |

## Relationship diagram

```
auth.users 1---1 profiles *---1 academies
                                   |
academies 1---* levels 1---* skills
academies 1---* students *---1 levels (current_level_id)
students  *---* profiles(parents)      via parents_students
academies 1---* coaches 1---1 profiles
academies 1---* batches *---1 coaches
students  *---* batches                via student_batches
batches   1---* schedule_sessions *---1 coaches
schedule_sessions 1---* attendance *---1 students
students  1---* student_skills *---1 skills
academies 1---* fee_plans 1---* student_fees *---1 students
student_fees 1---* payments
academies 1---* announcements *---1 batches (optional)
academies 1---* notifications *---1 profiles
academies 1---* audit_logs, error_logs
feature_flags (global, no academy_id)
```

## Tables

### `academies` — one row per tenant

| Column     | Type             | Nullable | Default            | Notes                                  |
| ---------- | ---------------- | -------- | ------------------ | -------------------------------------- |
| id         | uuid             | no       | gen_random_uuid()  |                                        |
| name       | text             | no       |                    |                                        |
| slug       | text             | no       |                    | unique, lowercase-kebab-case           |
| logo_url   | text             | yes      |                    |                                        |
| address    | text             | yes      |                    |                                        |
| phone      | text             | yes      |                    |                                        |
| email      | text             | yes      |                    |                                        |
| plan_tier  | plan_tier        | no       | 'free'             |                                        |
| status     | academy_status   | no       | 'active'           |                                        |
| settings   | jsonb            | no       | '{}'               | free-form per-academy settings         |
| created_at | timestamptz      | no       | now()              |                                        |
| updated_at | timestamptz      | no       | now()              | trigger                                |

**RLS:** super_admin all · members select own academy · academy_admin update own academy.

### `profiles` — one row per auth user

| Column     | Type           | Nullable | Default | Notes                                              |
| ---------- | -------------- | -------- | ------- | -------------------------------------------------- |
| id         | uuid           | no       |         | PK, FK → auth.users(id) cascade                    |
| academy_id | uuid           | yes      |         | FK → academies (restrict); **null iff super_admin** |
| role       | app_role       | no       |         |                                                    |
| full_name  | text           | no       |         |                                                    |
| phone      | text           | yes      |         |                                                    |
| email      | text           | yes      |         |                                                    |
| avatar_url | text           | yes      |         |                                                    |
| status     | profile_status | no       | 'active'|                                                    |
| created_at | timestamptz    | no       | now()   |                                                    |
| updated_at | timestamptz    | no       | now()   | trigger                                            |

Indexes: `(academy_id)`, `(academy_id, role)`, `(email)`.

**RLS:** super_admin all · select own row, or same academy when viewer *or*
target is staff (admin/coach) — so parents can see coaches but not other
parents · update own row but **not** own `role`/`academy_id` · academy_admin
insert/update non-super-admin profiles in own academy. (Creating the
`auth.users` row itself happens through the Supabase admin API with the
service role, which bypasses RLS.)

### `levels` — progression ladder, per academy

| Column      | Type        | Nullable | Default           | Notes                       |
| ----------- | ----------- | -------- | ----------------- | --------------------------- |
| id          | uuid        | no       | gen_random_uuid() | unique (id, academy_id)     |
| academy_id  | uuid        | no       |                   | FK → academies cascade      |
| name        | text        | no       |                   | unique per academy          |
| sequence    | integer     | no       |                   | display order               |
| description | text        | yes      |                   |                             |
| created_at / updated_at | timestamptz | no | now()      | trigger                     |

Indexes: `(academy_id, sequence)`.
**RLS:** super_admin all · academy_admin all in academy · members select.

### `skills` — skills inside a level

| Column      | Type        | Nullable | Default           | Notes                                        |
| ----------- | ----------- | -------- | ----------------- | -------------------------------------------- |
| id          | uuid        | no       | gen_random_uuid() | unique (id, academy_id)                      |
| academy_id  | uuid        | no       |                   | FK → academies cascade                       |
| level_id    | uuid        | no       |                   | composite FK → levels(id, academy_id) cascade|
| name        | text        | no       |                   | unique per level                             |
| sequence    | integer     | no       |                   |                                              |
| description | text        | yes      |                   |                                              |
| created_at / updated_at | timestamptz | no | now()      | trigger                                      |

Indexes: `(academy_id)`, `(level_id, sequence)`.
**RLS:** same as `levels`.

### `students`

| Column            | Type           | Nullable | Default           | Notes                                                   |
| ----------------- | -------------- | -------- | ----------------- | ------------------------------------------------------- |
| id                | uuid           | no       | gen_random_uuid() | unique (id, academy_id)                                 |
| academy_id        | uuid           | no       |                   | FK → academies cascade                                  |
| full_name         | text           | no       |                   |                                                         |
| date_of_birth     | date           | yes      |                   |                                                         |
| gender            | gender         | yes      |                   |                                                         |
| photo_url         | text           | yes      |                   | Supabase Storage URL                                    |
| joined_date       | date           | no       | current_date      |                                                         |
| current_level_id  | uuid           | yes      |                   | composite FK → levels; set null on level delete         |
| status            | student_status | no       | 'active'          | 'archived' = soft delete; never hard-delete             |
| emergency_contact | jsonb          | no       | '{}'              | `{"name","phone","relationship"}`                       |
| medical_notes     | text           | yes      |                   |                                                         |
| created_at / updated_at | timestamptz | no    | now()             | trigger                                                 |

Indexes: `(academy_id, status)`, `(academy_id, full_name)`, `(current_level_id)`.
Audit: insert/update/delete → `audit_logs`.
**RLS:** super_admin all · academy_admin all in academy · coach select in
academy · parent select own children.

### `parents_students` — parent ↔ student link

| Column            | Type                | Nullable | Default    | Notes                                     |
| ----------------- | ------------------- | -------- | ---------- | ----------------------------------------- |
| academy_id        | uuid                | no       |            | FK → academies cascade                    |
| parent_profile_id | uuid                | no       |            | FK → profiles cascade; PK part            |
| student_id        | uuid                | no       |            | composite FK → students cascade; PK part  |
| relationship      | parent_relationship | no       | 'guardian' |                                           |
| created_at        | timestamptz         | no       | now()      |                                           |

Indexes: `(student_id)`, `(academy_id)`.
**RLS:** super_admin all · academy_admin all in academy · coach select in
academy · parent select own links.

### `coaches`

| Column         | Type         | Nullable | Default           | Notes                                |
| -------------- | ------------ | -------- | ----------------- | ------------------------------------ |
| id             | uuid         | no       | gen_random_uuid() | unique (id, academy_id)              |
| academy_id     | uuid         | no       |                   | FK → academies cascade               |
| profile_id     | uuid         | no       |                   | FK → profiles cascade; **unique**    |
| specialization | text         | yes      |                   |                                      |
| joined_date    | date         | no       | current_date      |                                      |
| status         | coach_status | no       | 'active'          |                                      |
| created_at / updated_at | timestamptz | no | now()       | trigger                              |

Indexes: `(academy_id, status)`.
**RLS:** super_admin all · academy_admin all in academy · members select.

### `batches` — recurring class groups

| Column       | Type         | Nullable | Default           | Notes                                               |
| ------------ | ------------ | -------- | ----------------- | --------------------------------------------------- |
| id           | uuid         | no       | gen_random_uuid() | unique (id, academy_id)                             |
| academy_id   | uuid         | no       |                   | FK → academies cascade                              |
| name         | text         | no       |                   | unique per academy                                  |
| level_range  | text         | yes      |                   | free text, e.g. "Beginner 1–3"                      |
| coach_id     | uuid         | yes      |                   | composite FK → coaches; set null on coach delete    |
| capacity     | integer      | no       | 10                | > 0                                                 |
| start_time   | time         | no       |                   |                                                     |
| end_time     | time         | no       |                   | must be after start_time                            |
| days_of_week | smallint[]   | no       | '{}'              | 0 = Sunday … 6 = Saturday                           |
| venue        | text         | yes      |                   |                                                     |
| status       | batch_status | no       | 'active'          |                                                     |
| created_at / updated_at | timestamptz | no | now()       | trigger                                             |

Indexes: `(academy_id, status)`, `(coach_id)`.
**RLS:** super_admin all · academy_admin all in academy · coach select in
academy · parent select batches their children are enrolled in.

### `student_batches` — enrollment

| Column        | Type              | Nullable | Default      | Notes                                  |
| ------------- | ----------------- | -------- | ------------ | -------------------------------------- |
| academy_id    | uuid              | no       |              | FK → academies cascade                 |
| student_id    | uuid              | no       |              | composite FK → students cascade; PK    |
| batch_id      | uuid              | no       |              | composite FK → batches cascade; PK     |
| enrolled_date | date              | no       | current_date |                                        |
| status        | enrollment_status | no       | 'active'     |                                        |
| created_at    | timestamptz       | no       | now()        |                                        |

Indexes: `(batch_id, status)`, `(academy_id)`.
**RLS:** super_admin all · academy_admin all in academy · coach select in
academy · parent select own children's rows.

### `schedule_sessions` — one class on one date

| Column              | Type           | Nullable | Default           | Notes                                                |
| ------------------- | -------------- | -------- | ----------------- | ---------------------------------------------------- |
| id                  | uuid           | no       | gen_random_uuid() | unique (id, academy_id)                              |
| academy_id          | uuid           | no       |                   | FK → academies cascade                               |
| batch_id            | uuid           | no       |                   | composite FK → batches cascade                       |
| session_date        | date           | no       |                   |                                                      |
| start_time          | time           | no       |                   |                                                      |
| end_time            | time           | no       |                   | must be after start_time                             |
| coach_id            | uuid           | yes      |                   | composite FK → coaches; set null on coach delete     |
| status              | session_status | no       | 'scheduled'       |                                                      |
| cancellation_reason | text           | yes      |                   | **required when status = 'cancelled'** (check)       |
| created_at / updated_at | timestamptz | no    | now()             | trigger                                              |

Unique `(batch_id, session_date, start_time)` — a batch can't be scheduled
twice at the same moment, which also makes schedule generation re-runnable.
Indexes: `(academy_id, session_date)`, `(academy_id, status)`,
`(batch_id, session_date)`, `(coach_id, session_date)`.
**RLS:** super_admin all · academy_admin all in academy · coach select in
academy · parent select sessions of their children's batches.

### `attendance`

| Column     | Type              | Nullable | Default           | Notes                                    |
| ---------- | ----------------- | -------- | ----------------- | ---------------------------------------- |
| id         | uuid              | no       | gen_random_uuid() |                                          |
| academy_id | uuid              | no       |                   | FK → academies cascade                   |
| session_id | uuid              | no       |                   | composite FK → schedule_sessions cascade |
| student_id | uuid              | no       |                   | composite FK → students cascade          |
| status     | attendance_status | no       |                   |                                          |
| marked_by  | uuid              | yes      |                   | FK → profiles set null                   |
| marked_at  | timestamptz       | no       | now()             |                                          |
| notes      | text              | yes      |                   |                                          |
| created_at / updated_at | timestamptz | no | now()        | trigger                                  |

Unique `(session_id, student_id)`.
Indexes: `(academy_id, student_id)`, `(academy_id, status)`, `(student_id)`, `(marked_by)`.
Audit: insert/update/delete → `audit_logs`.
**RLS:** super_admin all · academy_admin all in academy · coach select /
insert / update in academy, and writes must set `marked_by` to themselves ·
parent select own children.

### `student_skills` — progress per skill

| Column     | Type         | Nullable | Default           | Notes                              |
| ---------- | ------------ | -------- | ----------------- | ---------------------------------- |
| id         | uuid         | no       | gen_random_uuid() |                                    |
| academy_id | uuid         | no       |                   | FK → academies cascade             |
| student_id | uuid         | no       |                   | composite FK → students cascade    |
| skill_id   | uuid         | no       |                   | composite FK → skills cascade      |
| status     | skill_status | no       | 'not_started'     |                                    |
| updated_by | uuid         | yes      |                   | FK → profiles set null             |
| updated_at | timestamptz  | no       | now()             | trigger                            |
| notes      | text         | yes      |                   |                                    |
| created_at | timestamptz  | no       | now()             |                                    |

Unique `(student_id, skill_id)`. Indexes: `(academy_id)`, `(skill_id)`, `(updated_by)`.
**RLS:** super_admin all · academy_admin all in academy · coach select /
insert / update in academy with `updated_by` = themselves · parent select
own children.

### `fee_plans`

| Column        | Type          | Nullable | Default           | Notes                     |
| ------------- | ------------- | -------- | ----------------- | ------------------------- |
| id            | uuid          | no       | gen_random_uuid() | unique (id, academy_id)   |
| academy_id    | uuid          | no       |                   | FK → academies cascade    |
| name          | text          | no       |                   | unique per academy        |
| amount        | numeric(10,2) | no       |                   | ≥ 0, rupees               |
| billing_cycle | billing_cycle | no       |                   |                           |
| description   | text          | yes      |                   |                           |
| created_at / updated_at | timestamptz | no | now()       | trigger                   |

Indexes: `(academy_id)`.
**RLS:** super_admin all · academy_admin all in academy · members select.

### `student_fees` — one billable period for one student

| Column       | Type          | Nullable | Default           | Notes                                              |
| ------------ | ------------- | -------- | ----------------- | -------------------------------------------------- |
| id           | uuid          | no       | gen_random_uuid() | unique (id, academy_id)                            |
| academy_id   | uuid          | no       |                   | FK → academies cascade                             |
| student_id   | uuid          | no       |                   | composite FK → students cascade                    |
| fee_plan_id  | uuid          | yes      |                   | composite FK → fee_plans; set null on plan delete  |
| period_start | date          | no       |                   |                                                    |
| period_end   | date          | no       |                   | ≥ period_start                                     |
| amount       | numeric(10,2) | no       |                   | ≥ 0; copied from the plan so plan edits don't rewrite history |
| due_date     | date          | no       |                   |                                                    |
| status       | fee_status    | no       | 'pending'         |                                                    |
| created_at / updated_at | timestamptz | no | now()       | trigger                                            |

Indexes: `(academy_id, status)`, `(academy_id, due_date)`, `(academy_id, period_start)`, `(student_id)`, `(fee_plan_id)`.
Audit: insert/update/delete → `audit_logs`.
**RLS:** super_admin all · academy_admin all in academy · parent select own children. Coaches: none.

### `payments`

| Column         | Type           | Nullable | Default           | Notes                                       |
| -------------- | -------------- | -------- | ----------------- | ------------------------------------------- |
| id             | uuid           | no       | gen_random_uuid() |                                             |
| academy_id     | uuid           | no       |                   | FK → academies cascade                      |
| student_fee_id | uuid           | no       |                   | composite FK → student_fees **restrict**    |
| amount         | numeric(10,2)  | no       |                   | > 0; may be less than the fee (partial)     |
| paid_date      | date           | no       | current_date      |                                             |
| method         | payment_method | no       | 'cash'            |                                             |
| reference      | text           | yes      |                   | UPI ref, cheque no., etc.                   |
| recorded_by    | uuid           | yes      |                   | FK → profiles set null                      |
| notes          | text           | yes      |                   |                                             |
| created_at / updated_at | timestamptz | no  | now()             | trigger                                     |

Indexes: `(academy_id, paid_date)`, `(student_fee_id)`, `(recorded_by)`.
Audit: insert/update/delete → `audit_logs`.
**RLS:** super_admin all · academy_admin all in academy · parent select payments on own children's fees.

### `announcements`

| Column       | Type                  | Nullable | Default           | Notes                                              |
| ------------ | --------------------- | -------- | ----------------- | -------------------------------------------------- |
| id           | uuid                  | no       | gen_random_uuid() |                                                    |
| academy_id   | uuid                  | no       |                   | FK → academies cascade                             |
| title        | text                  | no       |                   |                                                    |
| body         | text                  | no       |                   |                                                    |
| audience     | announcement_audience | no       | 'all'             |                                                    |
| batch_id     | uuid                  | yes      |                   | composite FK → batches; **required when audience = 'batch'** |
| published_at | timestamptz           | yes      |                   | null = draft; future = scheduled                   |
| created_by   | uuid                  | yes      |                   | FK → profiles set null                             |
| expires_at   | timestamptz           | yes      |                   |                                                    |
| created_at / updated_at | timestamptz | no      | now()             | trigger                                            |

Indexes: `(academy_id, published_at desc)`, `(batch_id)`, `(created_by)`.
**RLS:** super_admin all · academy_admin all in academy · coach select
published, unexpired posts with audience all/coaches/batch · parent select
published, unexpired posts with audience all/parents, or batch posts for
their children's batches.

### `notifications` — in-app inbox

| Column     | Type        | Nullable | Default           | Notes                                           |
| ---------- | ----------- | -------- | ----------------- | ----------------------------------------------- |
| id         | uuid        | no       | gen_random_uuid() |                                                 |
| academy_id | uuid        | no       |                   | FK → academies cascade                          |
| profile_id | uuid        | no       |                   | FK → profiles cascade — the recipient           |
| type       | text        | no       |                   | e.g. 'announcement', 'session_cancelled', 'fee_due' |
| title      | text        | no       |                   |                                                 |
| body       | text        | yes      |                   |                                                 |
| read_at    | timestamptz | yes      |                   | null = unread                                   |
| link       | text        | yes      |                   | in-app route to open                            |
| created_at | timestamptz | no       | now()             |                                                 |

Indexes: `(profile_id, read_at)`, `(profile_id, created_at desc)`, `(academy_id)`.
**RLS:** super_admin all · recipient select/update own · academy_admin insert and select in academy.

### `audit_logs` — who changed what

| Column           | Type        | Nullable | Default           | Notes                                                    |
| ---------------- | ----------- | -------- | ----------------- | -------------------------------------------------------- |
| id               | uuid        | no       | gen_random_uuid() |                                                          |
| academy_id       | uuid        | yes      |                   | FK → academies cascade; null for global actions          |
| actor_profile_id | uuid        | yes      |                   | FK → profiles set null; null when done by service role   |
| action           | text        | no       |                   | 'insert' / 'update' / 'delete' from triggers             |
| entity_type      | text        | no       |                   | table name                                               |
| entity_id        | uuid        | yes      |                   |                                                          |
| changes          | jsonb       | yes      |                   | insert: `{"new":{…}}`; delete: `{"old":{…}}`; update: `{"col":{"old","new"}}` per changed column |
| ip               | inet        | yes      |                   | from `x-forwarded-for` when called via the API           |
| created_at       | timestamptz | no       | now()             |                                                          |

Indexes: `(academy_id, created_at desc)`, `(actor_profile_id)`, `(entity_type, entity_id)`.
Written by the `audit_row_change` trigger on `students`, `student_fees`,
`payments`, `attendance` (SECURITY DEFINER, so it succeeds regardless of the
acting user's RLS). An update that changes nothing but `updated_at` writes no row.
**RLS:** super_admin all · academy_admin select in academy. No direct inserts.

### `error_logs` — frontend/Sentry error mirror

| Column     | Type        | Nullable | Default           | Notes                    |
| ---------- | ----------- | -------- | ----------------- | ------------------------ |
| id         | uuid        | no       | gen_random_uuid() |                          |
| academy_id | uuid        | yes      |                   | FK → academies cascade   |
| profile_id | uuid        | yes      |                   | FK → profiles set null   |
| level      | error_level | no       | 'error'           |                          |
| message    | text        | no       |                   |                          |
| stack      | text        | yes      |                   |                          |
| route      | text        | yes      |                   |                          |
| user_agent | text        | yes      |                   |                          |
| created_at | timestamptz | no       | now()             |                          |

Indexes: `(academy_id, created_at desc)`, `(profile_id)`, `(level)`.
**RLS:** super_admin all · anyone (even logged out) may insert a row about
themselves · academy_admin select in academy.

### `feature_flags` — global, no academy_id

| Column            | Type        | Nullable | Default           | Notes                                    |
| ----------------- | ----------- | -------- | ----------------- | ---------------------------------------- |
| id                | uuid        | no       | gen_random_uuid() |                                          |
| key               | text        | no       |                   | unique, `snake_case`                     |
| description       | text        | yes      |                   |                                          |
| enabled_globally  | boolean     | no       | false             |                                          |
| academy_overrides | jsonb       | no       | '{}'              | `{"<academy_id>": true|false}`           |
| created_at / updated_at | timestamptz | no | now()       | trigger                                  |

**RLS:** super_admin all · every logged-in user may select.

## Helper functions (used by RLS)

All are `STABLE SECURITY DEFINER` so they can read `profiles` without RLS
recursion. Policies call them as `(select fn())` so Postgres evaluates them
once per query rather than once per row.

| Function               | Returns   | Meaning                                                  |
| ---------------------- | --------- | -------------------------------------------------------- |
| `current_user_role()`  | app_role  | role of the logged-in user (null if no profile)          |
| `current_academy_id()` | uuid      | academy of the logged-in user (null for super_admin)     |
| `is_super_admin()` / `is_academy_admin()` / `is_coach()` / `is_parent()` | boolean | role checks |
| `parent_student_ids()` | uuid[]    | students the logged-in parent is linked to               |
| `parent_batch_ids()`   | uuid[]    | batches those students are actively enrolled in          |
| `request_ip()`         | inet      | client IP from the API request headers, else null        |

## Dashboard views and RPC functions

All views are `security_invoker`, so RLS still applies — an admin sees their
academy, a parent sees only their own children. **Chart components must read
these, never aggregate raw tables.**

**Attendance percentage rule (used everywhere):**
`attended = present + late`, `counted = present + absent + late`,
`pct = attended / counted`. Excused absences count for nothing either way.

| Object                                | Kind     | One row per                      | Columns                                                                                 |
| ------------------------------------- | -------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| `student_attendance_summary`          | view     | student (all time)               | academy_id, student_id, full_name, student_status, counted/attended/absent/late/excused_sessions, attendance_pct |
| `batch_attendance_summary`            | view     | batch (all time)                 | academy_id, batch_id, batch_name, batch_status, sessions_marked, counted_sessions, attended_sessions, attendance_pct |
| `monthly_collection_totals`           | view     | academy × calendar month         | collected, payment_count (by paid_date); expected, outstanding, overdue/pending/paid/waived_count (by due_date) |
| `at_risk_students`                    | view     | active student < 60% in last 30 days, ≥ 3 counted sessions | academy_id, student_id, full_name, counted/attended_sessions, attendance_pct, batch_names, parent_name, parent_phone |
| `attendance_summary_for_range(p_from, p_to, p_batch_id?)` | RPC | student in range | student_id, full_name, counted/attended/absent/late/excused_sessions, attendance_pct |
| `at_risk_students_for(p_days=30, p_threshold=60, p_min_sessions=3)` | RPC | at-risk student with custom window | student_id, full_name, counted_sessions, attended_sessions, attendance_pct |

### `holidays` — dates the academy is closed (`0003_scheduling.sql`)

| Column       | Type        | Nullable | Default           | Notes                                   |
| ------------ | ----------- | -------- | ----------------- | --------------------------------------- |
| id           | uuid        | no       | gen_random_uuid() |                                         |
| academy_id   | uuid        | no       |                   | FK → academies cascade                  |
| holiday_date | date        | no       |                   | unique per academy                      |
| name         | text        | no       |                   | e.g. "Diwali"                           |
| created_at   | timestamptz | no       | now()             |                                         |

Indexes: `(academy_id, holiday_date)`.
**RLS:** super_admin all · academy_admin all in academy · members select.
Only consulted by `generate_sessions()`; existing sessions on a holiday
are unaffected.

## Scheduling RPCs (`0003_scheduling.sql`)

Both are `SECURITY INVOKER` — they run as the caller, so the table RLS
above decides who can use them (an academy_admin can; a parent's call
would fail on the first write).

| Function                                        | Does                                                                                                                                                                       | Returns                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `generate_sessions(p_batch_id, p_from, p_to)`   | For each date in range matching the batch's `days_of_week`: skip if a holiday, skip if the batch already has a session at that time, skip if the batch's coach has an overlapping non-cancelled session, else insert a `scheduled` session copying the batch's time and coach. Max 366 days. | one row per candidate day: `(day, outcome)` where outcome ∈ created / holiday / exists / coach_conflict |
| `cancel_session(p_session_id, p_reason)`        | Sets status `cancelled` + reason on a `scheduled` session (errors otherwise), then inserts one `notifications` row (`type = 'session_cancelled'`, link `/parent`) per distinct parent of any active student in the batch. | void                                        |

## Storage (`supabase/migrations/0002_storage.sql`)

| Bucket           | Public | Object path                              | Policies                                                                                       |
| ---------------- | ------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `student-photos` | **no** | `<academy_id>/<student_id>/photo.<ext>`  | super_admin all · any academy member select within their academy folder · academy_admin insert/update/delete within their academy folder |

The bucket is private (photos of minors), so `students.photo_url` stores
the **storage path**, not a URL. The frontend resolves it to a short-lived
signed URL at display time (`getStudentPhotoUrl` in
`features/students/api/uploadStudentPhoto.ts`). Tenancy is enforced by
reading the first path segment with `storage.foldername(name)` and
comparing it to `current_academy_id()` — the same helpers as table RLS.

## Account creation (Edge Function `invite-user`)

New parent and coach accounts can't be created by the browser — the anon
key has no access to Supabase's Admin API. `supabase/functions/invite-user`
runs server-side with the service-role key and, after verifying the caller
is an `academy_admin`, either reuses an existing `profiles` row with that
email (same academy only) or calls `auth.admin.inviteUserByEmail` (which
sends the invite email), inserts the `profiles` row with `status =
'invited'`, and then inserts the `parents_students` or `coaches` row. See
[RUNBOOK.md](./RUNBOOK.md) for deploying it.

## Seed data (`supabase/seed.sql`)

One academy ("Glide Skating Academy", Bengaluru), one super admin, one
academy admin, 3 coaches, 40 students in 6 batches with parent accounts
(four sibling pairs share parents; every third family has two parents),
9 levels × 5 skills with per-student progress, sessions from 90 days ago
to 14 days ahead, attendance for every completed session (students 9, 18,
27, 36 are deliberately poor attenders), 3 fee plans, three months of fees
with paid / partial / overdue / waived examples, 3 announcements with
notifications, and 3 feature flags. Every login's password is
`Password123!`. Re-running the seed wipes and recreates all of it.
