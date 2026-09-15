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
| `fee_pricing_mode`      | cycle, per_class                                           |
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
fee_plans *---1 batches (optional — null = academy-wide)
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
| fee_plan_id       | uuid           | yes      |                   | composite FK → fee_plans; set null on plan delete; `0007_fees.sql` — which plan `generate_upcoming_fees()` bills them on, not a fee itself |
| status            | student_status | no       | 'active'          | 'archived' = soft delete; never hard-delete             |
| emergency_contact | jsonb          | no       | '{}'              | `{"name","phone","relationship"}`                       |
| medical_notes     | text           | yes      |                   |                                                         |
| created_at / updated_at | timestamptz | no    | now()             | trigger                                                 |

Indexes: `(academy_id, status)`, `(academy_id, full_name)`, `(current_level_id)`, `(fee_plan_id)`.
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
| photo_url      | text         | yes      |                   | storage path in `coach-photos`, not a URL (0009) |
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
| makeup_for_session_id | uuid         | yes      |                   | FK → schedule_sessions set null; `0011_makeup_credits_and_per_class_billing.sql` — set when this session IS the make-up for a cancelled one |
| created_at / updated_at | timestamptz | no    | now()             | trigger                                              |

Unique `(batch_id, session_date, start_time)` — a batch can't be scheduled
twice at the same moment, which also makes schedule generation re-runnable.
Partial unique index on `makeup_for_session_id` (where not null) — a
cancelled session can have at most one make-up linked to it.
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

Trigger `attendance_makeup_credit` (after insert or update of `status`,
`0011_makeup_credits_and_per_class_billing.sql`): inserts a `pending`
`makeup_credits` row when a mark becomes `absent`; deletes a still-pending
one if a mark is corrected away from `absent`. Fires from the same
insert/update `save_attendance()` already does — no changes to that
function or the coach marking UI.

### `makeup_credits` — a personally-missed class the academy still owes

| Column            | Type        | Nullable | Default           | Notes                                              |
| ----------------- | ----------- | -------- | ----------------- | --------------------------------------------------- |
| id                | uuid        | no       | gen_random_uuid() |                                                     |
| academy_id        | uuid        | no       |                   | FK → academies cascade                             |
| student_id        | uuid        | no       |                   | composite FK → students cascade                    |
| reason_session_id | uuid        | no       |                   | composite FK → schedule_sessions cascade — the session the student missed |
| status            | text        | no       | 'pending'         | check in ('pending', 'fulfilled') — not a Postgres enum |
| granted_at        | timestamptz | no       | now()             |                                                     |
| fulfilled_at      | timestamptz | yes      |                   | set by `fulfill_makeup_credit()`                    |
| fulfilled_by      | uuid        | yes      |                   | FK → profiles set null                             |
| notes             | text        | yes      |                   |                                                     |

Unique `(student_id, reason_session_id)` — one credit per student per
missed session; also the `on conflict` target the grant trigger relies on.
Index: `(student_id, status)`.
Audit: insert/update/delete → `audit_logs`.
**RLS:** super_admin all · academy_admin all in academy · parent select
own children. Written only by the `attendance_makeup_credit` trigger and
`fulfill_makeup_credit()` — never a direct insert/update from the app.

`0011_makeup_credits_and_per_class_billing.sql`:
- `schedule_makeup_session(p_original_session_id, p_date, p_start, p_end)`
  — `SECURITY INVOKER`. Validates the original session is `cancelled` and
  has no make-up linked yet; reuses `generate_sessions()`'s holiday-skip
  and coach-conflict checks for the single date (raising instead of
  skipping); inserts the new session with `makeup_for_session_id` set;
  notifies every parent in the batch (`type: 'makeup_scheduled'`).
- `fulfill_makeup_credit(p_credit_id, p_notes?)` — `SECURITY INVOKER`,
  admin-only via RLS. Sets `status = 'fulfilled'`, `fulfilled_at = now()`,
  `fulfilled_by = auth.uid()`.
- `expected_classes_from_schedule(p_batch_id, p_from, p_to)` — `stable`
  SQL, no writes. Counts days in range matching `batches.days_of_week`
  minus `holidays` — the same weekday math `generate_sessions()` uses,
  read-only. Used by `generate_upcoming_fees()` for per-class billing
  (see `fee_plans` below) and by nothing else.

### `class_bookings` — a reserved slot against a student's credit balance

| Column       | Type        | Nullable | Default           | Notes                                              |
| ------------ | ----------- | -------- | ----------------- | --------------------------------------------------- |
| id           | uuid        | no       | gen_random_uuid() |                                                     |
| academy_id   | uuid        | no       |                   | FK → academies cascade                             |
| student_id   | uuid        | no       |                   | composite FK → students cascade                    |
| session_id   | uuid        | no       |                   | composite FK → schedule_sessions cascade           |
| status       | text        | no       | 'booked'          | check in ('booked', 'cancelled') — not a Postgres enum |
| booked_at    | timestamptz | no       | now()             |                                                     |
| cancelled_at | timestamptz | yes      |                   |                                                     |

Unique `(student_id, session_id)`. Indexes: `(student_id, status)`,
`(session_id, status)`. Audit: insert/update/delete → `audit_logs`.
**RLS:** super_admin all · academy_admin all in academy · coach select in
academy · parent select own children. No parent insert/update policy —
writes only happen through `book_class_slot()` / `cancel_class_slot()`
below, which are `SECURITY DEFINER` and re-check the caller owns the
student via `parent_student_ids()` themselves.

`0012_class_bookings.sql` (balance formula updated in
`0014_credits_require_payment.sql` — see below):
- `class_credit_balance(p_student_id)` — `stable` SQL,
  `SECURITY INVOKER`. The one running, never-reset balance:
  `Σ student_fees.credits_granted (paid/waived only) − count(class_bookings
  'booked') + count(makeup_credits 'pending')`. Nothing here is
  period-scoped — unused credits from an old period are still in the sum
  the next time a new period is generated, so "leftover carries forward"
  needs no separate rollover step. Returns **null** (not 0) for a student
  who has never had a single `credits_granted` row (regardless of that
  row's payment status) — the frontend's "does this student even use the
  booking system" check; a student with an unpaid period instead sees a
  real **0**, so the UI can explain *why*.
- `book_class_slot(p_session_id)` — `SECURITY DEFINER`. Validates the
  caller's student is actively enrolled in the session's batch, the
  session is `scheduled` and today-or-future, and
  `class_credit_balance(...) > 0`; raises "Pay this period's fee to
  unlock class credits" specifically when an unpaid/overdue
  credit-bearing fee is the reason, vs. a generic "No class credits
  remaining" otherwise. Inserts (or reactivates a cancelled) the booking.
- `cancel_class_slot(p_session_id)` — `SECURITY DEFINER`. Only works
  while the session is still `scheduled` — once the academy marks
  attendance, the booking is permanent history and the credit is truly
  spent, matching "credit exhausted when the academy marks attendance."
  Sets the row to `'cancelled'`, freeing the credit.
- `class_credit_summary(p_student_id)` (`0014_credits_require_payment.sql`)
  — `stable` SQL, `SECURITY INVOKER`. Same math as
  `class_credit_balance()`, broken into `(granted, booked, bonus,
  available)` — the admin side's view, since a bare number doesn't
  explain "why is this 0" the way the parts do. Used on the student
  profile (Overview badge from `class_credit_balance()`, full breakdown
  card on the Attendance tab from this function).

`cancel_session()` (`0003_scheduling.sql`) gained one line in
`0012_class_bookings.sql`: cancelling a session also cancels every active
booking on it, so nobody's credit is held hostage by a class that never
happened — they can book the make-up session (or any other day) with the
freed credit.

`generate_upcoming_fees()` (`0007_fees.sql`) sets `credits_granted` for
every plan that has a `batch_id` (cycle or per_class alike) alongside its
existing `amount` calculation — see the `student_fees.credits_granted`
row above and `fee_plans` below. Billing math itself is unchanged.

The attendance-marking roster (`getSessionForMarking.ts`,
`0004_attendance.sql`'s domain) changed to match: a session's roster is
now actively-enrolled students whose current plan has no `batch_id`
(legacy, unaffected) **union** actively-enrolled students with an active
booking for that specific session — not simply everyone in the batch.
`save_attendance()` itself, and the RLS/lock policies around it, are
unchanged.

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
| batch_id      | uuid          | yes      |                   | composite FK → batches; set null on batch delete; `0010_fee_batch_plans_and_reminders.sql` — null = academy-wide plan, non-null = scoped to that one batch (e.g. a cheaper plan for a weekend-only batch). For a `cycle` plan this is purely a picker-filtering field; for `per_class` it's also which batch's schedule prices the plan. |
| pricing_mode  | fee_pricing_mode | no    | 'cycle'           | `0011_makeup_credits_and_per_class_billing.sql` — 'cycle' (existing flat-per-period `amount`) or 'per_class' (`per_class_rate` × classes in the period, from the batch's schedule) |
| per_class_rate | numeric(10,2) | yes      |                   | rupees per class; required (and only meaningful) when pricing_mode = 'per_class' |
| created_at / updated_at | timestamptz | no | now()       | trigger                   |

Check constraint: `pricing_mode = 'cycle' or (batch_id is not null and
per_class_rate is not null and per_class_rate >= 0)` — a per-class plan
must be batch-scoped and priced.
Indexes: `(academy_id)`, `(batch_id)`.
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
| waived_reason | text         | yes      |                   | set together with status='waived'; `0007_fees.sql` |
| last_reminded_at | timestamptz | yes     |                   | set by `send_fee_reminders()`; `0010_fee_batch_plans_and_reminders.sql` — shown in the admin fee list as "Reminded N days ago" |
| credits_granted | integer      | yes      |                   | `0012_class_bookings.sql` — how many classes this period paid for (`expected_classes_from_schedule` for the plan's batch, null for an academy-wide/no-batch plan); copied at generation time so a later plan or schedule edit never rewrites history, same rationale as `amount` |
| created_at / updated_at | timestamptz | no | now()       | trigger                                            |

Unique `(student_id, period_start)` (`0007_fees.sql`) — a student can't have two periods starting the same day.
Indexes: `(academy_id, status)`, `(academy_id, due_date)`, `(academy_id, period_start)`, `(student_id)`, `(fee_plan_id)`.
Audit: insert/update/delete → `audit_logs` — waiving (status + waived_reason in one update) is logged automatically this way.
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
| `attendance_summary_for_range(p_from, p_to, p_batch_id?)` | RPC | student in range | student_id, full_name, counted/attended/absent/late/excused_sessions, attendance_pct, expected_sessions, pending_makeup_credits |
| `at_risk_students_for(p_days=30, p_threshold=60, p_min_sessions=3)` | RPC | at-risk student with custom window | student_id, full_name, counted_sessions, attended_sessions, attendance_pct |

`expected_sessions` and `pending_makeup_credits` (`0011_makeup_credits_and_per_class_billing.sql`)
use deliberately different date semantics from the rest of the row:
`expected_sessions` counts real (non-cancelled) `schedule_sessions` for
the student's active batch(es) **within `[p_from, p_to]`**, same as the
other counts; `pending_makeup_credits` is a count of **all-time** pending
`makeup_credits`, ignoring the range — a credit doesn't belong to one
period, so it keeps showing as owed on every report until fulfilled.

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
| `schedule_makeup_session(p_original_session_id, p_date, p_start, p_end)` (`0011_makeup_credits_and_per_class_billing.sql`) | Errors unless the original session is `cancelled` with no make-up linked yet. Reuses `generate_sessions()`'s holiday and coach-conflict checks for the single date, **raising** instead of silently skipping. Inserts the new session with `makeup_for_session_id` set, then notifies every parent in the batch the same way `cancel_session()` does (`type = 'makeup_scheduled'`). | the new `schedule_sessions` row             |

## Attendance rules (`0004_attendance.sql`)

| Object                              | Does                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_is_editable(p_session_id)` | `STABLE SECURITY DEFINER`. True from the start of the session's date until 24h after its `end_time`, evaluated in the academy's timezone (`academies.settings->>'timezone'`, default UTC). |
| policies `attendance_coach_insert` / `_update` | Replaced: coaches may write attendance only while `session_is_editable()` is true and with `marked_by = auth.uid()`. Admin policies are unchanged (no lock).            |
| policy `sessions_coach_complete`    | Coaches may update their own sessions (`coach_id` matches their `coaches` row) between `scheduled` and `completed`.                                                       |
| `save_attendance(p_session_id, p_marks jsonb)` | `SECURITY INVOKER`. Upserts each `{student_id, status}` (conflict on `(session_id, student_id)`), stamps `marked_by`/`marked_at`, and sets the session `completed` if it was `scheduled`. Refuses cancelled sessions. Returns the number of marks written. |

Every write to `attendance` — coach save or admin override — is recorded
by the existing `audit_attendance` trigger with the actor, so "override
written to audit_logs" needs no extra code.

## Make-up credits (`0011_makeup_credits_and_per_class_billing.sql`)

See the `makeup_credits` table entry above for the full schema and the
grant/revoke trigger. `fulfill_makeup_credit(p_credit_id, p_notes?)` is
`SECURITY INVOKER`, admin-only via `makeup_credits_admin_all`; sets
`status = 'fulfilled', fulfilled_at = now(), fulfilled_by = auth.uid()`
on a `pending` credit (errors if it's not found or already fulfilled).

## Announcements fan-out (`0005_announcements.sql`)

| Object                                  | Does                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `announcements.notified_at timestamptz` | Null until notifications have been created; set by the RPC. Partial index on `(academy_id, published_at) where notified_at is null` finds due posts cheaply.           |
| `notifications.announcement_id uuid`    | FK → announcements (cascade). Lets a feed show read/unread per post and lets a delete clean up.                                                                        |
| `publish_due_announcements()`           | `SECURITY DEFINER`, scoped to `current_academy_id()`. For each due, un-notified announcement: inserts one notification per recipient (audience rules in the feature doc; author excluded; inactive profiles excluded; `link` per role), then stamps `notified_at`. `for update skip locked` so two callers can't double-send. Returns how many posts it sent. |
| Realtime                                | `notifications` added to the `supabase_realtime` publication. Clients subscribe with `profile_id=eq.<self>`; RLS still filters.                                        |

## Skill progression RPCs (`0006_skill_progression.sql`)

`levels`, `skills`, `students.current_level_id`, and `student_skills`
(with their RLS) already existed from `0001_initial_schema.sql` — see
those table entries above. This migration adds only what plain
RLS-guarded table writes can't express.

| Function                                | Does                                                                                                                                                                                                          | Returns                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `promote_student(p_student_id)`          | `SECURITY DEFINER` (coaches have no RLS write on `students`). Re-checks the caller is a coach or admin in the student's academy, requires every skill in the student's current level to be `achieved`, finds the level with `sequence + 1` in the same academy, updates `current_level_id`. Errors clearly if: no current level, no skills in the level, not all achieved, or already the highest level. The existing `audit_students` trigger logs the change (actor, old/new level, timestamp) automatically. | `(level_id, level_name)` of the new level    |
| `reorder_levels(p_ids)` / `reorder_skills(p_level_id, p_ids)` | `SECURITY INVOKER` — each row update is subject to the existing `levels_admin_all` / `skills_admin_all` policies, so only an admin reordering their own academy's rows does anything. Sets `sequence` to the array position (1-based) of each id in order. | void                                        |
| `level_distribution()`                   | `SECURITY INVOKER`. Active skaters per level, in ladder order.                                                                                                                                                | one row per level: `(level_id, level_name, sequence, student_count)` |
| `stale_students(p_days=60)`              | `SECURITY INVOKER`. Active skaters with no skill marked `achieved` in the last `p_days` days — "last achieved" falls back to `joined_date` if nothing's ever been achieved. `is_top_level` flags a skater with no next level, so the UI can de-emphasize rather than hide them. | one row per skater: `(student_id, full_name, level_id, level_name, last_achieved_at, days_since, is_top_level)` |

The coach/admin "assess a skill" action is a plain `student_skills`
upsert (`onConflict: student_id,skill_id`) from the client — no RPC
needed, since the existing `student_skills_coach_insert` / `_update`
policies already permit it. The same upsert call, given several
`student_id`s, is how bulk assess writes many skaters in one request.

## Fee management RPCs (`0007_fees.sql`)

`fee_plans`, `student_fees`, `payments` (and their RLS) already existed
from `0001_initial_schema.sql`. `students.fee_plan_id` and
`student_fees.waived_reason` are new columns; see the table entries above.

| Function                                | Does                                                                                                                                                                                                          | Returns                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `generate_upcoming_fees(p_academy_id?)`   | `SECURITY INVOKER`. For every active student on a fee plan whose current period has ended (or who has none yet): inserts one `student_fees` row for the next period, `status = 'pending'`, `due_date = period_start`. `billing_cycle` (unchanged) still sets the period's length; the **amount** is `fp.amount` for a `cycle` plan, or `per_class_rate * expected_classes_from_schedule(batch_id, period_start, period_end)` for a `per_class` one (`0011_makeup_credits_and_per_class_billing.sql`) — computed upfront from the schedule, not from sessions actually held. Called two ways: an admin's "Generate now" button passes their own `academy_id` — RLS then only lets rows in their academy actually insert; the scheduled Edge Function calls it with no argument using the service-role key, which bypasses RLS and covers every academy in one run. | one row per fee created                      |
| `mark_fees_overdue()`                     | `SECURITY INVOKER`. Flips every `pending` fee whose `due_date` has passed to `overdue`. Same academy-scoping story as above — an academy admin could call it for their own academy, but only the scheduled function actually does (see RUNBOOK). | count of fees flipped                        |
| `record_payment(fee, amount, date?, method?, reference?, notes?)` | `SECURITY INVOKER`. Inserts one `payments` row, then flips the fee to `paid` if the sum of its payments now covers the full amount — otherwise leaves the status exactly as it was, which is how a partial payment works without a separate status. Refuses a waived fee or a non-positive amount. | the inserted payment row                     |
| `student_fees_list(status?, month?, batch?)` | `SECURITY INVOKER`. The admin fee list: one row per fee matching the filters, with `paid`, `balance`, and `last_reminded_at` pre-computed — the admin dashboard's table and CSV export both read this directly. `month` matches by `due_date`'s calendar month; leaving it null (the "Overdue" quick filter does this) returns every matching fee regardless of month. | one row per matching fee                     |

### Fee reminders (`0010_fee_batch_plans_and_reminders.sql`)

| Function                                | Does                                                                                                                                                                                                          | Returns                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `send_fee_reminders(p_student_fee_ids uuid[])` | `SECURITY DEFINER` — inserting notifications for other users (the parents) needs to bypass their own RLS, same reasoning as `publish_due_announcements()`. Validates the caller is an `academy_admin` and every fee id belongs to the caller's academy (others are silently skipped). For each `pending`/`overdue` fee: finds every linked parent via `parents_students`, inserts one `notifications` row per parent (`type = 'fee_due'`, `link = '/parent/fees'`), then sets `student_fees.last_reminded_at = now()`. Reuses the existing notifications delivery pipeline as-is (realtime toast + unread badge) — no frontend changes needed there, the same way `session_cancelled` notifications already work. Admin-triggered only (a button click); no scheduled/automatic version exists. | count of notifications actually sent (a student with no linked parent is skipped, not an error) |

**Waiving** a fee is a plain `student_fees` update
(`status = 'waived', waived_reason = '...'`) under the existing
`student_fees_admin_all` policy — no RPC needed, and the existing
`audit_student_fees` trigger logs the status change and the reason
together automatically.

**Assessing a skill** (progression feature) and **recording a payment**
(this one) follow the same shape: a plain RLS-guarded write where
possible, an RPC only where server-side validation or a bundled
multi-step write earns its keep.

## Storage (`supabase/migrations/0002_storage.sql`, `0009_photos_and_needs_attention.sql`)

| Bucket           | Public | Object path                              | Policies                                                                                       |
| ---------------- | ------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `student-photos` | **no** | `<academy_id>/<student_id>/photo.<ext>`  | super_admin all · any academy member select within their academy folder · academy_admin insert/update/delete within their academy folder |
| `coach-photos`   | **no** | `<academy_id>/<coach_id>/photo.<ext>`    | same shape as `student-photos`: super_admin all · academy member select · academy_admin insert/update/delete within their academy folder |

Both buckets are private, so `students.photo_url` / `coaches.photo_url`
store the **storage path**, not a URL. The frontend resolves it to a
short-lived (1hr) signed URL at display time via the shared
`useSignedPhotoUrls(bucket, paths)` hook (`shared/lib/signedPhotoUrls.ts`),
rendered through the shared `PersonAvatar` component
(`shared/ui/PersonAvatar.tsx`) which falls back to initials on any miss —
no photo, still loading, or a failed fetch. Tenancy is enforced by reading
the first path segment with `storage.foldername(name)` and comparing it to
`current_academy_id()` — the same helpers as table RLS.

## Account creation (Edge Function `invite-user`)

New parent and coach accounts can't be created by the browser — the anon
key has no access to Supabase's Admin API. `supabase/functions/invite-user`
runs server-side with the service-role key and, after verifying the caller
is an `academy_admin`, either reuses an existing `profiles` row with that
email (same academy only) or calls `auth.admin.inviteUserByEmail` (which
sends the invite email), inserts the `profiles` row with `status =
'invited'`, and then inserts the `parents_students` or `coaches` row. See
[RUNBOOK.md](./RUNBOOK.md) for deploying it.

## Account removal (Edge Function `delete-user`)

The mirror image of `invite-user`: the browser's anon key can't call
`auth.admin.deleteUser`, so removing a coach's account for good (not just
deactivating) has to go through `supabase/functions/delete-user`. It runs
server-side with the service-role key and, after verifying the caller is
an `academy_admin` and the target account is a `coach` in the caller's
own academy (and isn't the caller themself), calls
`auth.admin.deleteUser(profile_id)`. Deleting the `auth.users` row
cascades to `profiles` and then `coaches` automatically (`ON DELETE
CASCADE` both steps) — this is deliberately *not* a plain
`.delete().from('coaches')`, which would leave a working login behind
with no coach record. See [RUNBOOK.md](./RUNBOOK.md) for deploying it.

## Scheduled fee generation (Edge Function `generate-fees`)

`supabase/functions/generate-fees` is the scheduled job behind fee
generation and the pending → overdue transition, across every academy in
one run. It runs server-side with the service-role key (which bypasses
RLS) and calls `generate_upcoming_fees()` with no academy filter, then
`mark_fees_overdue()`. It's meant to be invoked only by Supabase's own
Cron trigger, which authenticates with the service-role key. Default JWT
verification alone isn't enough here — it accepts the public anon key or
any logged-in user's session token just as readily — so the function
additionally checks the Authorization header is the exact service-role
key before doing anything. See
[RUNBOOK.md](./RUNBOOK.md) "Scheduled jobs" for deploying and scheduling
it, and for the admin "Generate now" button, which calls
`generate_upcoming_fees()` directly from the client instead (RLS scopes
that path to the caller's own academy, so it doesn't need this function).

## Dashboard & reports RPCs (`0008_dashboard.sql`)

Phase 0 already added the core dashboard views (`student_attendance_summary`,
`batch_attendance_summary`, `monthly_collection_totals`, `at_risk_students`);
skill progression added `level_distribution()`. This migration adds the
rest so every chart and report reads a view or RPC — never a raw table
query from a component. All are `SECURITY INVOKER` — RLS on the
underlying tables scopes every one of them to the caller's own academy.

| Function                                               | Does                                                                                                                                                    | Returns                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `dashboard_stat_cards()`                                | The 4 top stat cards in one round trip, each with a "vs last month" comparison. Where there's no historical snapshot to compare against, the comparison is the closest honest proxy — see the function's own comment for exactly what each one means. | one row                                          |
| `monthly_attendance_trend(p_months=6, p_batch_id?)`     | Attendance % per month, optionally scoped to one batch.                                                                                                 | one row per month with sessions                 |
| `batch_capacity_summary()`                              | Enrolled vs capacity per active batch.                                                                                                                  | one row per batch                                |
| `monthly_active_students(p_months=6)`                   | Distinct students with an attendance record per month — the closest available "active" proxy without a historical status snapshot.                     | one row per month with sessions                 |
| `coach_load_summary(p_days=30)`                          | Students (active enrollment across their batches) and sessions (trailing window) per coach.                                                            | one row per active coach                         |
| `needs_attention(p_days=30, p_threshold=60, p_min_sessions=3)` | Same rule as `at_risk_students`, plus current level, `photo_url` (added in 0009, see below) and an overdue-fee flag — the dashboard's "Needs attention" panel. | one row per at-risk student                      |

`needs_attention()` was redefined in `0009_photos_and_needs_attention.sql`
to add `photo_url` to its return columns — Postgres won't let
`create or replace function` change a function's return type, so that
migration `drop function`s it first, then recreates it with the same
body plus the one new column.
| `fee_collection_report(p_from, p_to, p_batch_id?)`       | Same shape as `student_fees_list()`, filtered by an explicit `due_date` range instead of one calendar month — the Reports page's date-range filter.    | one row per fee due in range                     |
| `student_progress_report(p_from, p_to, p_batch_id?)`     | Per student: current level, skills marked achieved within the range (any level, not just their current one — see the feature doc), and attendance % in the range. | one row per active student                       |
| `coach_activity_report(p_from, p_to, p_batch_id?)`       | Per coach: sessions held, distinct students seen, and attendance % for their sessions, within the range.                                               | one row per active coach                         |

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
