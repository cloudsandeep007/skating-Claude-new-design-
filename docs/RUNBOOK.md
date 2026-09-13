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

## Environment variables

See [.env.example](../.env.example) for the full documented list.

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
`0002_add_waitlist_status.sql`), paste it into the SQL Editor and run it
the same way, then regenerate types. Never edit a migration file that has
already been applied.

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
