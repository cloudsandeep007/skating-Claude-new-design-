# Architecture decision log

Newest first. One entry per real choice made — not every line of code,
but anything a future session (or future you) would otherwise have to
re-derive or might accidentally reverse.

Format:

```
## YYYY-MM-DD — <short decision title>

**Decision:** what was decided.
**Options considered:** the alternatives and why they were on the table.
**Why:** the reasoning that picked the option above.
**Trade-offs:** what this costs or risks, and when to revisit it.
```

---

## 2026-09-14 — RLS via SECURITY DEFINER helper functions, called as `(select fn())`

**Decision:** All role/tenancy checks in RLS policies go through six
`STABLE SECURITY DEFINER` helper functions (`current_user_role()`,
`current_academy_id()`, `is_super_admin()`, `is_academy_admin()`,
`is_coach()`, `is_parent()`, plus `parent_student_ids()` /
`parent_batch_ids()` for the parent role) instead of inlining a subquery
against `profiles` in every policy. Every call site wraps them as
`(select fn())` rather than calling them bare.

**Options considered:** Inlining `(select academy_id from profiles where
id = auth.uid())` directly in each policy — works, but duplicated across
~60 policies and error-prone to keep consistent. A JWT custom claim for
role/academy_id — avoids the extra table read entirely, but needs a
Postgres trigger or Edge Function to keep the claim in sync whenever a
profile's role or academy changes, which is more moving parts than this
project needs yet.

**Why:** `SECURITY DEFINER` lets the function read `profiles` without
tripping that same table's RLS (it runs as the function owner, who owns
the table and is therefore exempt from RLS on it) — this is the pattern
Supabase's own RLS performance docs recommend. Wrapping every call as
`(select fn())` turns it into an `InitPlan` that Postgres evaluates once
per statement instead of once per row; without the `select` wrapper, a
`STABLE` function can still get re-invoked per row on some query plans.

**Trade-offs:** An extra function call (cached per-statement) on every
RLS-checked query. If this ever needs to scale past caching it well,
revisit the JWT-claim approach — but don't do it preemptively.

## 2026-09-14 — Composite foreign keys `(id, academy_id)` for tenant integrity

**Decision:** Every child table's foreign key back to its parent includes
`academy_id`, e.g. `foreign key (batch_id, academy_id) references batches
(id, academy_id)`, which requires a `unique (id, academy_id)` constraint
on every parent table.

**Options considered:** A single-column FK on just the parent's `id`,
relying on RLS and application code to keep `academy_id` consistent
between a row and its parent.

**Why:** With a single-column FK, a bug in application code (or a
mistake in a future migration/seed script) could insert, say, an
`attendance` row with the wrong `academy_id` pointing at a session that
belongs to a different academy — RLS would still mostly hide the mess
from other tenants, but the data itself would be silently corrupt. The
composite FK makes that combination physically impossible to insert:
Postgres rejects it at the constraint level, before RLS is ever
evaluated. This is the standard defense-in-depth pattern for multi-tenant
Postgres schemas.

**Trade-offs:** One extra unique index per parent table, and every insert
into a child table must carry the correct `academy_id` explicitly (it
can't be inferred from the parent alone) — acceptable since the API layer
always has the current user's `academy_id` in context.

## 2026-09-14 — `ON DELETE SET NULL (column)` for single-column nulling on composite FKs

**Decision:** Where a child row should survive its optional parent being
deleted (e.g. `students.current_level_id` when a level is deleted,
`batches.coach_id` when a coach is deleted), the composite FK uses
Postgres 15's column-list form: `on delete set null (current_level_id)`
— nulling only that column, not the whole FK tuple.

**Options considered:** Plain `on delete set null` on the composite FK.

**Why:** A composite FK is `(current_level_id, academy_id)`. Plain `on
delete set null` nulls **every** column in the FK, which would try to
null `academy_id` too — but `academy_id` is `not null` on `students`, so
deleting a level would raise a constraint violation instead of quietly
detaching the student from it. The column-list form (added in Postgres
15) nulls only `current_level_id` and leaves `academy_id` untouched.

**Trade-offs:** Requires Postgres 15+ — confirmed fine, since
`supabase/config.toml` (from `supabase init`) targets major version 17
and Supabase Cloud runs 15+ on every current project.

## 2026-09-14 — `nullif()` around every attendance-percentage division

**Decision:** Every place attendance percentage is computed
(`student_attendance_summary`, `batch_attendance_summary`,
`at_risk_students`, `attendance_summary_for_range()`,
`at_risk_students_for()`) divides by `nullif(counted_sessions, 0)`, never
by the bare column — even in `at_risk_students`, where the `WHERE` clause
already has `counted_sessions >= 3` as a separate condition.

**Why:** Postgres does not guarantee that `AND` evaluates its operands
left-to-right, so `counted_sessions >= 3 AND pct < 60` does not
reliably short-circuit before the division runs — a student with 0
counted sessions in the window (all attendance rows `excused`, which
don't count either way) could hit a division-by-zero error depending on
how the planner orders the check. `nullif` removes the possibility
entirely: it returns `NULL` instead of dividing by zero, and `NULL`
compared to anything is `NULL` (not an error), which `AND` correctly
treats as excluding the row.

**Trade-offs:** None — this is strictly safer with no behavior change
for the normal case.

## 2026-09-13 — Project foundation scaffolded

**Decision:** Vite + React 18 + TypeScript (strict) + Tailwind + shadcn/ui,
with the feature-folder architecture described in CLAUDE.md, TanStack
Query for server state, Zustand for local UI state, React Hook Form +
Zod for forms, React Router for routing, Recharts for charts, Supabase
for backend, Vitest + Playwright for testing, Sentry for error tracking.

**Options considered:** Next.js was not considered — this is a
client-rendered SPA today (no SSR requirement), and Vite's dev
experience is simpler for a non-coder-led workflow. Redux/Context were
not chosen for server state — TanStack Query is a better fit since
almost all state here is Supabase data.

**Why:** Matches the stack specified for this project; each library has
one clear job so a future session (or an AI tool with no memory of past
sessions) can guess correctly which tool handles what.

**Trade-offs:** No SSR/SEO — acceptable since this is an authenticated
app, not a public marketing site. Revisit only if a public-facing
marketing/booking page (Phase 6 "Trial bookings") needs SEO.

## 2026-09-13 — React pinned to v18, not v19

**Decision:** Pin `react` and `react-dom` to `^18` even though `npm create
vite` scaffolds React 19 by default.

**Options considered:** Staying on the scaffolded React 19.

**Why:** The stack was specified as React 18; some libraries in this
ecosystem (Capacitor community plugins in particular, needed in Phase 4)
have historically lagged behind major React versions.

**Trade-offs:** Will need a deliberate upgrade decision later if a
library ends up requiring React 19.

## 2026-09-13 — jsdom pinned to v25, not the latest v26/v30

**Decision:** Use `jsdom@25` for Vitest's test environment instead of the
version npm installs by default.

**Options considered:** Latest jsdom (v30 at time of writing).

**Why:** The dev machine runs Node 20.10, and jsdom's newer versions pull
in `html-encoding-sniffer` → `@exodus/bytes`, which throws
`ERR_REQUIRE_ESM` under Node < ~20.19 due to a CJS/ESM interop bug in
that dependency chain. jsdom 25 predates that dependency and runs cleanly.

**Trade-offs:** Revisit once the dev machine's Node version is upgraded
(see the Node version note below) — newer jsdom may be preferable then.
