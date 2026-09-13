# Skating Academy App — Build Plan & Claude Code Prompts

**Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase + Capacitor
**Architecture:** Modular monolith, multi-tenant from day one
**Tool:** Claude Code in the desktop app

---

## How to use this document

1. Run phases in order. Don't skip Phase 0.
2. **One session per prompt.** Start a fresh Claude Code session for each numbered prompt below.
3. After each session: run the app, check it works, then commit before moving on.
4. If a session goes badly, discard and restart rather than patching on top of a mess.
5. Every prompt assumes `CLAUDE.md` exists in the repo root (created in Phase 0.2). Claude Code reads it automatically.

**Golden rule:** if Claude Code starts building something you didn't ask for, stop it and narrow the request.

---

## Paste this at the end of EVERY prompt from Phase 1 onward

Claude Code follows CLAUDE.md, but documentation is the first thing that
gets skipped when a session runs long. Repeating it in the prompt is what
actually makes it happen.

```
BEFORE FINISHING THIS SESSION
1. Update docs/ARCHITECTURE.md if structure, data flow or dependencies
   changed
2. Update docs/DATA-MODEL.md if any table, column, index or RLS policy
   changed
3. Add a docs/DECISIONS.md entry for every real choice made: date,
   decision, options considered, why, trade-offs
4. Add a dated docs/CHANGELOG.md entry in plain language
5. Create or update docs/features/<feature>.md covering purpose,
   screens, data touched, business rules, edge cases and known
   limitations
6. Update docs/RUNBOOK.md if any operational procedure changed
7. Add JSDoc comments to every exported function explaining what it
   does and why, not how
8. List at the end of your reply: what you built, what you changed,
   what I should test manually, and anything you were unsure about

Do not consider the task complete until documentation is updated.
```

---

# PHASE 0 — Foundation

_4 to 5 days. This is the most important phase in the project._

### 0.1 — Create the repo folder

Do this manually before opening Claude Code:

- Create an empty folder, e.g. `D:\skating-academy`
- Create a free Supabase project, save the project URL, anon key and service role key
- Create a free Sentry account and project, save the DSN
- Create an empty GitHub repo

---

### 0.2 — Prompt: Project scaffold and conventions

```
I'm building a skating academy management app. I'm a non-coder using AI
tools to build and maintain it, so structure and consistency matter more
than clever code.

Set up the project foundation in this folder. Do NOT build any features yet.

STACK
- React 18 + TypeScript (strict mode) + Vite
- Tailwind CSS + shadcn/ui
- TanStack Query for all server state
- Zustand for local UI state
- React Hook Form + Zod for all forms
- React Router
- Recharts for charts
- Supabase for database, auth, storage
- Vitest + Playwright for tests
- Sentry for error tracking

FOLDER STRUCTURE
src/
  features/           each feature is self-contained
    <feature>/
      api/            queries and mutations
      components/
      hooks/
      types.ts
      index.ts        the ONLY file other features may import from
  shared/
    ui/               shadcn components
    lib/              supabase client, utils, constants
    hooks/
    types/
  app/
    routes/
    layouts/
    providers/
supabase/
  migrations/
  functions/
docs/
  ARCHITECTURE.md
  DECISIONS.md
  RUNBOOK.md
tests/
  e2e/

TASKS
1. Scaffold the Vite + React + TypeScript project with strict mode on
2. Install and configure Tailwind, shadcn/ui, and all libraries above
3. Create the folder structure with placeholder index.ts files
4. Set up path aliases (@/features, @/shared, @/app)
5. Configure ESLint + Prettier, strict rules
6. Set up .env.example with all required variables, documented
7. Set up Vitest and Playwright with one trivial passing test each
8. Write CLAUDE.md at the repo root covering: the architecture, the
   folder rules, the feature-isolation rule (features may only import
   another feature's index.ts), naming conventions, how to add a new
   feature, how to add a migration, and the rule that all business
   logic lives in api/ or hooks/ and never inside components

9. CLAUDE.md must also contain a DOCUMENTATION RULES section stating
   that every session which changes the system must, before finishing:
   - update docs/ARCHITECTURE.md if structure, data flow or
     dependencies changed
   - add an entry to docs/DECISIONS.md for any real choice made,
     in the format: date, decision, options considered, why, trade-offs
   - add an entry to docs/CHANGELOG.md describing what changed, in
     plain language a non-technical person can follow
   - update docs/DATA-MODEL.md if any table, column or RLS policy
     changed
   - update docs/RUNBOOK.md if any operational procedure changed
   - create or update docs/features/<feature>.md for the feature touched
   State that a session is not complete until docs are updated.

10. Create these doc files now, with their structure and headings in
    place so later sessions have something to append to:
    docs/ARCHITECTURE.md — system overview, stack, folder structure,
      data flow, auth model, tenancy model, external services
    docs/DECISIONS.md — architecture decision log, newest first
    docs/CHANGELOG.md — dated, plain-language change log
    docs/DATA-MODEL.md — every table, its columns, relationships and
      RLS policies, with a text diagram of relationships
    docs/RUNBOOK.md — operational procedures
    docs/features/ — one file per feature: purpose, screens, data
      touched, business rules, edge cases, known limitations

11. Add a PR/commit template reminding me which docs to check

12. Write a README with setup steps

Verify the dev server starts and tests pass before finishing.
```

**After this session:** run `npm run dev`, confirm it loads. Commit.

---

### 0.3 — Prompt: Database schema and RLS

```
Set up the complete Supabase database for the skating academy app as
migration files in supabase/migrations/. Numbered SQL files only — I
will never click changes in the Supabase dashboard.

MULTI-TENANCY
This will eventually serve multiple academies. Every tenant-owned table
must have academy_id with RLS enforcing isolation. Design for this now.

ROLES
super_admin (me), academy_admin, coach, parent

TABLES

academies: id, name, slug, logo_url, address, phone, email, plan_tier,
status, settings jsonb, created_at

profiles: id (refs auth.users), academy_id, role, full_name, phone,
email, avatar_url, status, created_at

students: id, academy_id, full_name, date_of_birth, gender, photo_url,
joined_date, current_level_id, status, emergency_contact, medical_notes,
created_at

parents_students: parent_profile_id, student_id, relationship
(a student can have multiple parents, a parent multiple students)

coaches: id, academy_id, profile_id, specialization, joined_date, status

batches: id, academy_id, name, level_range, coach_id, capacity,
start_time, end_time, days_of_week (array), venue, status

student_batches: student_id, batch_id, enrolled_date, status

schedule_sessions: id, academy_id, batch_id, session_date, start_time,
end_time, coach_id, status (scheduled/completed/cancelled),
cancellation_reason

attendance: id, academy_id, session_id, student_id, status
(present/absent/late/excused), marked_by, marked_at, notes

levels: id, academy_id, name, sequence, description
skills: id, academy_id, level_id, name, sequence, description

student_skills: id, academy_id, student_id, skill_id, status
(not_started/learning/achieved), updated_by, updated_at, notes

fee_plans: id, academy_id, name, amount, billing_cycle, description
student_fees: id, academy_id, student_id, fee_plan_id, period_start,
period_end, amount, due_date, status (pending/paid/overdue/waived)
payments: id, academy_id, student_fee_id, amount, paid_date, method,
reference, recorded_by, notes

announcements: id, academy_id, title, body, audience (all/batch/parents/
coaches), batch_id, published_at, created_by, expires_at

notifications: id, academy_id, profile_id, type, title, body, read_at,
link, created_at

audit_logs: id, academy_id, actor_profile_id, action, entity_type,
entity_id, changes jsonb, ip, created_at

error_logs: id, academy_id, profile_id, level, message, stack, route,
user_agent, created_at

feature_flags: id, key, description, enabled_globally,
academy_overrides jsonb

REQUIREMENTS
1. Proper foreign keys, constraints and sensible defaults
2. Indexes on every foreign key and every column used in filters,
   especially academy_id, session_date, due_date, status
3. RLS policies on every table. Write them against indexed columns —
   badly written RLS is the biggest Supabase performance problem.
   Use a helper function for "current user's academy_id" and one for
   "current user's role", both marked STABLE
4. Policies: super_admin sees everything; academy_admin sees their
   academy; coach sees their academy's students, batches and sessions
   plus writes attendance and skills; parent sees only their own
   children's data
5. A trigger writing to audit_logs on insert/update/delete for
   students, fees, payments, attendance
6. updated_at triggers where relevant
7. Postgres VIEWS or RPC functions for dashboard metrics — attendance
   percentage per student, per batch, monthly collection totals,
   at-risk students below 60% attendance. Charts must never run raw
   table queries from the frontend
8. A seed file with one academy, 3 coaches, 6 batches, 40 students with
   parents, 3 months of attendance, levels with skills, fee records.
   Use realistic Indian names and rupee amounts
9. Generate TypeScript types from the schema into src/shared/types/
   database.ts and document the regeneration command in CLAUDE.md

Test that migrations apply cleanly on a fresh database.
```

**After this session:** run the migrations, open Supabase table editor, confirm seed data is there. Commit.

---

### 0.4 — Prompt: Auth, routing and CI

```
Build the authentication and routing foundation. No business features yet.

AUTH
1. Supabase auth client in shared/lib/supabase.ts with typed client
2. Auth provider with session handling and auto-refresh
3. Login page, forgot password, reset password
4. Role-based route protection — a wrapper that checks role and
   redirects appropriately
5. After login, route by role: super_admin to /dev, academy_admin to
   /admin, coach to /coach, parent to /parent
6. Logout, session expiry handling, "your session expired" toast

LAYOUTS
- Admin layout: sidebar nav + top bar, responsive to mobile drawer
- Coach layout: mobile-first, bottom nav
- Parent layout: mobile-first, bottom nav
- Dev layout: dark, dense, with a loud PRODUCTION/STAGING indicator
Each with placeholder pages for now.

APP SHELL
1. TanStack Query provider with sensible defaults (staleTime, retry,
   refetchOnWindowFocus off for mobile)
2. Error boundary at app and route level with a friendly fallback
3. Sentry initialised, capturing errors and the current user
4. Toast system (shadcn sonner)
5. Global loading and empty state components
6. 404 and 403 pages

CI
GitHub Actions workflow running on every push: typecheck, lint, unit
tests, build. Must fail the build on any error.

Write one Playwright e2e test: log in as each role and confirm the
correct landing page loads.
```

**After this session:** log in with each seeded role, confirm you land in the right place. Push to GitHub, confirm the Action passes. Commit.

---

# PHASE 1 — Prototype to demo

_2 weeks. This is what you show the academy._

### 1.1 — Prompt: Students and coaches

```
Build the students and coaches features for the academy admin.

Follow the design files in docs/design/ for all layout and styling.

STUDENTS FEATURE (src/features/students/)
- List page: data table with photo, name, batch, level, attendance %,
  fee status badge, last active. Server-side pagination, search by
  name, filter by batch and status, sortable columns
- Add student: form with validation (React Hook Form + Zod), photo
  upload to Supabase Storage, link to parent (create parent account if
  new, send invite)
- Edit student
- Student detail page with tabs: Overview, Attendance, Progress, Fees,
  Notes. Build Overview only for now, stub the others
- Archive student (soft delete, never hard delete)
- Loading skeletons and empty states on every list

COACHES FEATURE (src/features/coaches/)
- List, add, edit, deactivate
- Coach detail showing assigned batches and student count
- Adding a coach creates their auth account and sends an invite

RULES
- All data access through the feature's api/ folder using TanStack Query
- Optimistic updates where safe
- All forms validated with Zod schemas exported from types.ts
- No business logic inside components
```

---

### 1.2 — Prompt: Batches and timetable

```
Build the batches and scheduling features.

BATCHES (src/features/batches/)
- List with name, coach, timing, days, enrolled vs capacity, status
- Create and edit batch: name, level range, coach, capacity, start and
  end time, days of week, venue
- Enroll and remove students, with a capacity warning when full
- Batch detail showing roster and upcoming sessions

SCHEDULE (src/features/schedule/)
- Auto-generate schedule_sessions from batch recurring rules for a
  chosen date range
- Weekly calendar view for admin, colour-coded by batch
- Cancel a session with a reason, which notifies affected parents
- Add a one-off extra session
- Coach's "today" view: their sessions today with time, batch, venue
  and student count

Handle the edge cases: overlapping sessions for one coach, holidays,
and editing a batch time without breaking already-generated sessions.
```

---

### 1.3 — Prompt: Attendance

```
Build the attendance feature. This is the screen coaches use daily, so
it has to be fast and hard to get wrong.

COACH ATTENDANCE (mobile, one-handed, rink-side, sometimes in sunlight)
- Today's sessions list, tap one to open attendance
- Student list with large tap targets (minimum 44px) and photo
- Tap to cycle present / absent / late, colour coded
- "Mark all present" then adjust the exceptions — this is the fastest
  path and should be the default flow
- Running counter: "12 of 15 marked"
- Single confirm action that saves
- Editable for 24 hours after the session, locked after that
- Must work with a flaky connection: optimistic UI, retry queue,
  clear indicator if a save is pending

ADMIN ATTENDANCE
- View by date, by batch, by student
- Attendance percentage per student over a date range
- Override attendance with the change written to audit_logs
- Export to CSV

PARENT VIEW
- Their child's attendance history with a monthly summary and
  percentage

Write unit tests for the attendance percentage calculation.
```

---

### 1.4 — Prompt: Parent portal and announcements

```
Build the parent-facing app and announcements.

PARENT (mobile-first)
- Home: child selector if multiple children, next session card,
  attendance this month, fee status, latest announcement
- Child profile
- Attendance history
- Schedule: upcoming sessions for their child's batch
- Announcements feed
- Profile and settings

ANNOUNCEMENTS (src/features/announcements/)
- Admin: create with title, body, audience (all / specific batch /
  parents only / coaches only), optional expiry, publish immediately
  or schedule
- Creates notification rows for every recipient
- Parent and coach see a feed with unread indicators
- Mark as read, unread badge in the nav

NOTIFICATIONS
In-app only for now. Realtime via Supabase subscription so a new
announcement appears without a refresh.
```

**End of Phase 1: deploy to Vercel and demo it to the academy with real data.**

---

# PHASE 2 — Make it worth paying for

_1.5 weeks._

### 2.1 — Prompt: Skill progression system

```
Build the skill progression system. This is the feature that
differentiates us from generic attendance apps, so it should feel good
to use on both sides.

SETUP (admin)
- Manage levels: name, sequence, description. Reorder by drag
- Manage skills within a level: name, sequence, description
- Seed with real skating progression: Beginner 1-3, Intermediate 1-3,
  Advanced 1-3, with skills like forward skating, stopping, forward
  crossovers, backward skating, one-foot balance, backward crossovers,
  three-turns, spins, jumps

COACH
- From a session or a student, open skill assessment
- Current level's skills with status: not started / learning / achieved
- Two taps to update one skill, with an optional note
- Bulk assess: mark one skill across several students at once
- Promote a student to the next level when all skills are achieved,
  with a confirmation

PARENT
- Child's current level with a visual progression bar
- Skills in the current level with status, visually rewarding, not a
  dry checklist
- History: what was achieved and when and by which coach
- Preview of what's coming in the next level

ADMIN
- Distribution of students across levels
- Students who haven't progressed in 60+ days
```

---

### 2.2 — Prompt: Fees and payments

```
Build fee management. Manual payment recording only for now — no
payment gateway yet.

SETUP
- Fee plans: name, amount, billing cycle (monthly/quarterly/annual),
  description
- Assign a fee plan to a student on enrollment

GENERATION
- A scheduled job (Supabase Edge Function on a cron) generating
  student_fees records for the coming period
- Automatically flip pending to overdue past the due date
- Manual generation trigger for admin

ADMIN
- Fees dashboard: collected this month, pending, overdue, with counts
  and amounts
- Student fee list with filters by status, month and batch
- Record a payment: amount, date, method, reference, notes. Supports
  partial payments
- Waive a fee with a reason, written to audit_logs
- Payment history per student
- Export to CSV

PARENT
- Current dues, amount and due date, status badge
- Payment history with receipts

Write unit tests covering fee generation, partial payments, overdue
transitions and waivers. Fee maths is where quiet bugs cost real money.
```

---

# PHASE 3 — Admin dashboard

_1 week._

### 3.1 — Prompt: Dashboard and visualization

```
Build the academy admin dashboard. Follow docs/design/ exactly.

All data must come from the Postgres views and RPC functions created in
Phase 0. No raw table queries from chart components.

STAT CARDS (top row)
Active students, today's attendance %, fees collected this month,
outstanding dues. Each with a trend indicator against last month.

CHARTS (Recharts)
1. Attendance % trend, last 6 months, line, filterable by batch
2. Revenue collected vs expected, last 6 months, grouped bar
3. Students per batch vs capacity, horizontal bar
4. Skill level distribution, bar
5. Retention: active students month over month, line
6. Coach load: students and sessions per coach, bar

NEEDS ATTENTION PANEL
Students below 60% attendance in the last 30 days. Name, batch,
attendance %, parent phone, tap-to-call. This is the most valuable
element on the page — treat it as the visual anchor, not a footnote.

REQUIREMENTS
- Date range selector affecting all charts
- Responsive: charts stack on mobile
- Skeleton loaders while data fetches, never a blank screen
- Empty states when an academy has no data yet
- Export dashboard as PDF

REPORTS PAGE
Attendance report, fee collection report, student progress report,
coach activity report. Each filterable by date range and batch,
exportable to CSV and PDF.
```

---

# PHASE 4 — Android and iOS

_1 week._

### 4.1 — Prompt: Capacitor and native builds

```
Package the existing web app as native Android and iOS apps using
Capacitor. Do not rewrite anything — same codebase.

TASKS
1. Install and configure Capacitor, add Android and iOS platforms
2. App icons and splash screens from our brand assets, all densities
3. Configure app id, name, version, permissions
4. Native plugins: push notifications (Firebase Cloud Messaging),
   camera and photo library for student photos, network status,
   app state for background handling, status bar and safe area handling
5. Push notification flow: register device token against the profile,
   Supabase Edge Function to send via FCM, handle notification tap
   deep-linking into the right screen, handle foreground vs background
6. Deep links so an announcement notification opens that announcement
7. Handle the Android back button correctly
8. Keyboard behaviour and safe areas on both platforms
9. Build scripts for a signed Android .aab
10. Document the whole release process in docs/RUNBOOK.md: how to build,
    version, sign and upload, step by step, written for a non-coder

Also add PWA support so the web version is installable for anyone not
using the store apps.
```

**Manual steps after this:** Google Play Console account (one-time $25), store listing, screenshots, privacy policy, first release. The runbook should walk you through it.

---

# PHASE 5 — Developer console

_3 to 4 days._

### 5.1 — Prompt: Super admin console

```
Build my internal developer console at /dev, super_admin only. Follow
docs/design/ — it should look deliberately different from the academy
admin so I can never confuse the two.

A loud PRODUCTION / STAGING environment indicator must be visible at
all times.

OVERVIEW
Cards: total academies, active users last 7 days, database size,
storage used, errors last 24h, failed jobs. Chart of requests and
errors over time. Recent errors list.

ACADEMIES
Table: name, plan tier, students, active users, storage, status,
created. Actions: view, impersonate, suspend, manage feature flags.
Create a new academy with an initial admin account.

IMPERSONATION
Let me act as an academy admin for support. Requires a confirmation
modal, writes to audit_logs, shows a persistent banner while active,
and has a one-click exit. This is powerful, so make it obvious and
reversible.

ERROR LOG
Filterable by severity, academy, date range. Expandable rows with the
full stack trace. Mark as resolved. The frontend error boundary and
Sentry should both feed this table.

FEATURE FLAGS
Grid of flags with global toggle and per-academy overrides.

JOBS
Background job list: name, schedule, last run, status, duration, next
run. Manual trigger. Failure log.

AUDIT LOG
Searchable: who, what, when, which academy, with a before/after diff.

Dense layout, monospace for IDs, timestamps and traces.
```

---

# PHASE 6 — Revenue features

_Ongoing. Build these only once the academy is using the basics daily._

Suggested order:

1. **Razorpay payments** — online fee payment, webhook handling in an Edge Function, auto-reconciliation, receipts
2. **WhatsApp reminders** — fee due, class cancelled, attendance alerts, via a provider with templates
3. **Leave requests** — parent requests leave, coach and admin approve, affects attendance calculation
4. **Makeup classes** — credit for missed sessions, book into another batch
5. **Certificates** — auto-generate on level completion, PDF with academy branding
6. **Photo and video gallery** — per batch or event, parents view and download
7. **Trial bookings** — public page, book a trial, convert to student
8. **Competition and event management** — registration, results, records

---

## Checklist before you call it production ready

- [ ] Three Supabase environments (local, staging, production), never testing on real data
- [ ] Automated daily backups, and you have actually tested a restore once
- [ ] Sentry catching errors with user context attached
- [ ] CI passing on every push
- [ ] `docs/RUNBOOK.md` covering: restore a backup, roll back a deploy, what to do when payments fail, how to release a new app version
- [ ] RLS policies tested from each role — try to access another academy's data and confirm you can't
- [ ] All secrets in environment variables, nothing committed
- [ ] Privacy policy and terms published (required by Play Store, and you're holding children's data)
- [ ] Rate limiting on Edge Functions
- [ ] Loading and empty states on every screen
- [ ] Tested on a real low-end Android phone, not just a browser

---

## Keeping documentation alive

Docs written once and never updated are worse than none, because you'll trust them and they'll be wrong. Three things keep them honest:

**1. The closing block above, pasted into every prompt.** This does most of the work.

**2. A monthly documentation audit.** One session, once a month:

```
Audit the documentation in docs/ against the actual codebase.

For each of ARCHITECTURE.md, DATA-MODEL.md, DECISIONS.md and every
file in docs/features/:
- find anything that no longer matches the code
- find anything in the code that isn't documented
- find anything documented that no longer exists

Report the gaps first as a list, then fix them. Do not change any
application code during this session.
```

**3. A CI check.** Add this to the GitHub Actions workflow in Phase 0.4:

```
Add a CI step that fails the build if src/ changed in a commit but no
file under docs/ changed. Allow an override with [skip-docs] in the
commit message for genuine exceptions like formatting-only changes.
```

That last one is blunt but effective. It makes skipping docs an active decision rather than something that quietly happens.

---

## Habits that decide whether this survives a year

**One session, one feature.** Long sprawling sessions produce inconsistent structure.

**Commit after every working session.** With a clear message. Your ability to undo depends on it.

**Update CLAUDE.md when conventions change.** It's what keeps every future session consistent.

**Update docs/DECISIONS.md when you make a real choice.** Future you will ask why, and won't remember.

**Never click schema changes in the Supabase dashboard.** Migration files only.

**If the structure starts feeling messy, stop and fix it.** Don't build on top of it. You already know from NT Gravity what that costs.
