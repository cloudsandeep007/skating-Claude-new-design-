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

_To be filled in once the database schema and API layer exist (Phase 0.3)._

## Auth model

_To be filled in once auth is built (Phase 0.4)._

## Tenancy model

Every tenant-owned table carries an `academy_id` column, enforced by
Postgres RLS policies scoped to the authenticated user's academy. See
[DATA-MODEL.md](./DATA-MODEL.md) for details once the schema exists.

## External services

| Service  | Purpose                          | Config                                  |
| -------- | --------------------------------- | ---------------------------------------- |
| Supabase | Database, auth, storage           | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Sentry   | Error tracking                    | `VITE_SENTRY_DSN`                        |
