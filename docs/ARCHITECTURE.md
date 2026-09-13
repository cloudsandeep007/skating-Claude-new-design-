# Architecture

## System overview

Skating Academy is a web app (packaged for mobile later) that helps a
skating academy manage students, coaches, batches, attendance, skill
progression, fees, and parent communication. It is multi-tenant from
day one: the same deployment will eventually serve multiple academies,
each fully isolated from the others' data.

## Stack

- React 18 + TypeScript (strict mode) + Vite
- Tailwind CSS + shadcn/ui
- TanStack Query — server state
- Zustand — local UI state
- React Hook Form + Zod — forms and validation
- React Router — routing
- Recharts — charts
- Supabase — Postgres database, auth, storage
- Vitest + Playwright — testing
- Sentry — error tracking

See [CLAUDE.md](../CLAUDE.md) for folder structure and conventions.

## Folder structure

See the "Folder structure" section in [CLAUDE.md](../CLAUDE.md) — this
file should stay in sync with it.

## Data flow

The database schema now exists (`supabase/migrations/0001_initial_schema.sql`,
documented table-by-table in [DATA-MODEL.md](./DATA-MODEL.md)); the
frontend API layer that reads it is built feature-by-feature starting
Phase 1. Two rules that apply from day one:

- Charts and dashboard numbers read the Postgres **views and RPC
  functions** built alongside the schema (`student_attendance_summary`,
  `batch_attendance_summary`, `monthly_collection_totals`,
  `at_risk_students`, and the parameterised
  `attendance_summary_for_range()` / `at_risk_students_for()`) — never
  raw table queries aggregated in the frontend.
- All of it goes through TanStack Query hooks in each feature's `api/`
  folder, reading from the typed Supabase client in
  `src/shared/lib/supabase.ts` (added in Phase 0.4) against the generated
  types in `src/shared/types/database.ts`.

## Auth model

_To be filled in once auth is built (Phase 0.4)._ The roles the schema
already supports are `super_admin`, `academy_admin`, `coach`, and
`parent` (see `profiles.role` in [DATA-MODEL.md](./DATA-MODEL.md)).

## Tenancy model

Every tenant-owned table carries a `not null academy_id` column. Two
layers enforce isolation, both described in full in
[DATA-MODEL.md](./DATA-MODEL.md):

1. **Composite foreign keys.** A child table's FK back to its parent
   includes `academy_id` on both sides (e.g.
   `(batch_id, academy_id) references batches (id, academy_id)`), so a
   row can never reference a parent row in a different academy — this is
   enforced by Postgres itself, before RLS even runs.
2. **Row Level Security.** Every table has RLS enabled, with policies
   built on six `STABLE SECURITY DEFINER` helper functions
   (`current_academy_id()`, `current_user_role()`, `is_super_admin()`,
   etc.) so `super_admin` sees everything, `academy_admin` sees their
   academy, `coach` reads their academy and writes attendance/skills, and
   `parent` sees only their own children's data.

## External services

| Service  | Purpose                          | Config                                  |
| -------- | --------------------------------- | ---------------------------------------- |
| Supabase | Database, auth, storage           | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Sentry   | Error tracking                    | `VITE_SENTRY_DSN`                        |
