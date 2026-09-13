# CLAUDE.md

Instructions for Claude Code (or any AI coding tool) working in this repo.
The person running these sessions is a non-coder — structure and
consistency matter more than clever code. When in doubt, favor the
boring, explicit, well-documented option.

## Stack

- React 18 + TypeScript (strict mode) + Vite
- Tailwind CSS + shadcn/ui
- TanStack Query — all server state
- Zustand — local UI state only (never server data)
- React Hook Form + Zod — all forms
- React Router
- Recharts — all charts
- Supabase — database, auth, storage
- Vitest (unit) + Playwright (e2e)
- Sentry — error tracking

## Folder structure

```
src/
  features/<feature>/
    api/          queries and mutations (TanStack Query)
    components/   feature-local components
    hooks/        feature-local hooks
    types.ts      types and Zod schemas for this feature
    index.ts       the ONLY file other features may import from
  shared/
    ui/           shadcn components (generated — don't hand-edit the
                   variant boilerplate, add wrapper components instead
                   if you need different behavior)
    lib/          supabase client, utils, constants
    hooks/        hooks shared by more than one feature
    types/        types shared by more than one feature (incl. the
                   generated database.ts)
  app/
    routes/       route definitions
    layouts/       per-role app shells (admin, coach, parent, dev)
    providers/     app-wide providers (query client, auth, sentry, toaster)
supabase/
  migrations/     numbered SQL migration files — the only way schema changes
  functions/      Edge Functions
docs/             see "Documentation rules" below
tests/e2e/        Playwright tests
```

## Feature isolation rule

A feature is a self-contained folder under `src/features/<name>/`. The
**only** file another feature (or `app/`) may import from is that
feature's `index.ts`. Never reach into another feature's `api/`,
`components/`, `hooks/`, or `types.ts` directly.

`index.ts` should re-export only what other features actually need —
usually a few components and maybe a hook or type. Keep it small; a
large `index.ts` is a sign the feature's public surface is too wide.

`shared/` is the exception — anything in `shared/` may be imported by
any feature or by `app/`.

## Business logic placement

All business logic lives in a feature's `api/` (data fetching/mutation
logic, TanStack Query hooks) or `hooks/` (derived state, calculations).
Components render UI and call hooks — they do not contain calculations,
validation logic, or direct Supabase calls. If you find yourself writing
an `if` that encodes a business rule inside a `.tsx` file, move it into
a hook or an `api/` function instead.

Zod schemas (validation) live in each feature's `types.ts`, exported for
reuse between the form and the API layer.

## Naming conventions

- Files: components `PascalCase.tsx`, everything else `camelCase.ts`
  (`useStudents.ts`, `types.ts`, `api/getStudents.ts`)
- Feature folder names: lowercase, plural where the feature is a
  collection of things (`students`, `batches`, `announcements`)
- React Query keys: `[featureName, ...params]`, e.g. `['students', academyId]`
- Zod schemas: `<Thing>Schema`, inferred types `<Thing>` (e.g.
  `StudentSchema` / `type Student = z.infer<typeof StudentSchema>`)
- Database tables/columns: `snake_case` (Postgres convention); map to
  `camelCase` at the API boundary if needed, don't mix conventions in
  application code

## How to add a new feature

1. Create `src/features/<name>/` with `api/`, `components/`, `hooks/`,
   `types.ts`, `index.ts`.
2. Define Zod schemas and types in `types.ts` first.
3. Write data access in `api/` using TanStack Query (`useQuery` /
   `useMutation`), reading from `@/shared/lib/supabase`.
4. Build components using `@/shared/ui` primitives; keep them presentational.
5. Export only the public surface from `index.ts`.
6. Add a route in `src/app/routes/` if the feature has its own screen.
7. Create `docs/features/<name>.md` (see Documentation rules).

## How to add a migration

1. Add a new numbered SQL file in `supabase/migrations/`, e.g.
   `0007_add_waitlist_status.sql`. Never edit an existing migration that
   has already been applied — write a new one.
2. Never make schema changes by clicking in the Supabase dashboard —
   migration files are the only source of truth for the schema.
3. Every tenant-owned table needs an `academy_id` column and an RLS
   policy enforcing isolation on it.
4. After the migration is applied, regenerate types:
   ```
   npx supabase gen types typescript --project-id <project-id> > src/shared/types/database.ts
   ```
5. Update `docs/DATA-MODEL.md` with the new/changed table.

## Documentation rules

**A session is not complete until documentation is updated.** Before
finishing any session that changes the system:

1. Update `docs/ARCHITECTURE.md` if structure, data flow, or dependencies changed.
2. Add an entry to `docs/DECISIONS.md` for any real choice made, in the
   format: date, decision, options considered, why, trade-offs.
3. Add a dated entry to `docs/CHANGELOG.md` describing what changed, in
   plain language a non-technical person can follow.
4. Update `docs/DATA-MODEL.md` if any table, column, index, or RLS
   policy changed.
5. Update `docs/RUNBOOK.md` if any operational procedure changed.
6. Create or update `docs/features/<feature>.md` for the feature touched
   — purpose, screens, data touched, business rules, edge cases, known
   limitations.

## Testing

- Unit tests (Vitest) live next to the code they test (`utils.test.ts`
  beside `utils.ts`), or in a feature's own folder for feature logic.
- E2E tests (Playwright) live in `tests/e2e/`.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and
  `npm run test:e2e` before considering a session done.
