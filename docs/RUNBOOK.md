# Runbook

Operational procedures — step by step, written for a non-coder. Update
this whenever a procedure changes.

## Local development

```
npm install
cp .env.example .env   # then fill in the values, see .env.example for where to find them
npm run dev
```

## Running checks before committing

```
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

`npm run test:e2e` needs `.env` filled in with a real Supabase project
that has `supabase/seed.sql` applied — it logs in as each of the four
seeded roles and checks it lands on the right home screen. If port 5173
is already taken by something else on your machine, run
`PORT=5183 npm run test:e2e` instead (any free port works).

## Continuous integration

Every push and pull request runs `.github/workflows/ci.yml`: install,
typecheck, lint, unit tests, build. It fails the check on any error. It
does **not** run the Playwright e2e tests — those need a real Supabase
project with seed data, which isn't something CI should depend on yet.
Run `npm run test:e2e` locally before trusting a change that touches
login or routing.

## Environment variables

See [.env.example](../.env.example) for the full documented list.

**Windows PowerShell note:** redirecting command output with `>` (e.g.
`command > file.ts`) writes UTF-16 by default, which breaks TypeScript
and other tools expecting UTF-8. This bit the `supabase gen types`
command in this project. If a generated file looks empty or garbled,
check its encoding (`file path/to/file`) before assuming the command
failed — converting it back to UTF-8 is usually the actual fix.

## Database migrations

Migration files are the **only** source of truth for the schema — never
click a schema change into existence in the Supabase dashboard.

**Applying the schema to a fresh Supabase project (one-time, or after a
new numbered migration is added):**

1. Open the Supabase dashboard → your project → SQL Editor.
2. Open `supabase/migrations/0001_initial_schema.sql` in this repo, copy
   the whole file, paste it into a new SQL Editor query, and run it. It
   creates every table, enum, index, RLS policy, trigger and dashboard
   view in one shot.
3. (Optional, non-production only) Do the same with `supabase/seed.sql`
   to load demo data — one academy, 3 coaches, 40 students with parents,
   3 months of attendance and fees. Every seeded login uses the password
   `Password123!` (see the comment at the top of the file for the exact
   emails). It's safe to re-run: it deletes its own previous data first.
   If the `auth.users`/`auth.identities` insert section errors — Supabase
   occasionally changes those internal columns between versions — skip
   that file and create demo logins from the dashboard's Authentication
   tab instead; the rest of the seed data doesn't depend on it.
4. Regenerate the TypeScript types (needs the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and `supabase login` run once):
   ```
   npx supabase gen types typescript --project-id <project-id> > src/shared/types/database.ts
   ```
   Find `<project-id>` in the dashboard under Settings → General → Reference ID.

**Adding a later migration:** create a new numbered file (e.g.
`0003_add_waitlist_status.sql`), paste it into the SQL Editor and run it
the same way, then regenerate types. Never edit a migration file that has
already been applied.

**Migrations applied so far — run each once, in order:**

| File                                       | What it does                                           |
| ------------------------------------------ | ------------------------------------------------------ |
| `0001_initial_schema.sql`                  | Every table, enum, index, RLS policy, trigger, view    |
| `0002_storage.sql`                         | The private `student-photos` bucket and its policies   |
| `0003_scheduling.sql`                      | `holidays` table, `generate_sessions()`, `cancel_session()` |
| `0004_attendance.sql`                      | 24-hour marking lock, coach session-complete policy, `save_attendance()` |

Photo upload on the Add/Edit student screens will fail with a "bucket not
found" error until `0002_storage.sql` has been run. "Generate schedule",
"Cancel session" and the Holidays card need `0003_scheduling.sql`. The
coach's Confirm on the attendance screen needs `0004_attendance.sql` —
until then every save just sits in the coach's "to sync" queue with a
"function not found" message, and syncs by itself once the migration is in.

After running a migration that adds tables or functions, regenerate the
TypeScript types (step 4 above). `0003` and `0004` were hand-mirrored into
`database.ts` so the app compiles before you regenerate — regenerating
produces the same thing.

## Edge Functions

Server-side code that runs inside Supabase. Right now there's one:
`invite-user`, which creates parent and coach accounts and sends their
invite email (the browser can't do this itself — see
[DATA-MODEL.md](./DATA-MODEL.md)).

**Deploying (one-time, and again whenever the function's code changes):**

```
npx supabase login
npx supabase functions deploy invite-user --project-ref <project-id>
```

`login` opens a browser window once; after that the CLI remembers you.
Nothing else to configure — the function reads `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from secrets Supabase
provides to every function automatically.

Until it's deployed, "Add coach" and "Add student → New parent (send
invite)" will fail with a "function not found" toast. Linking a student to
an **existing** parent, and everything else on those screens, works
without it.

**Invite emails** go out through Supabase's built-in email service, which
is fine for testing but rate-limited (a few per hour). Before real use,
set up a custom SMTP provider under Authentication → Settings → SMTP.

See [DATA-MODEL.md](./DATA-MODEL.md) for what the schema actually contains.

## Deploying

_To be filled in once a hosting target is chosen._

## Backups and restore

_To be filled in before going to production — see the "production
ready" checklist in the build plan._

## Releasing the mobile apps

_To be filled in during Phase 4 (Capacitor)._

## Incident response

_To be filled in as real operational needs come up. At minimum this
should eventually cover: what to do when payments fail, how to roll
back a bad deploy, how to restore from a backup._
