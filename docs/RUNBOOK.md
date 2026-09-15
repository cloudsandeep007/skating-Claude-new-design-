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
that has `supabase/seed.sql` applied. It logs in as each of the four
seeded roles and checks it lands on the right home screen
(`auth.spec.ts`), and — `payments.spec.ts` — drives the payment ledger
through the real admin UI: record a payment, read back its receipt
number, void it with a reason, and see the fee return to unpaid. That
test **writes to the project it's pointed at**: on first run it creates
a fee plan "E2E Monthly" and a skater "E2E Payments Skater" (enrolled in
the first active batch), and every run leaves that skater with one
unpaid fee plus one more voided payment in its history. Nothing else is
touched. Don't point it at a project whose data you can't afford a test
skater in. If port 5173 is already taken by something else on your
machine, run `PORT=5183 npm run test:e2e` instead (any free port works).

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
| `0005_announcements.sql`                   | `notified_at`, `notifications.announcement_id`, `publish_due_announcements()`, realtime on notifications |

Photo upload on the Add/Edit student screens will fail with a "bucket not
found" error until `0002_storage.sql` has been run. "Generate schedule",
"Cancel session" and the Holidays card need `0003_scheduling.sql`. The
coach's Confirm on the attendance screen needs `0004_attendance.sql` —
until then every save just sits in the coach's "to sync" queue with a
"function not found" message, and syncs by itself once the migration is in.
The admin Announcements page, unread badges, mark-as-read and live updates
need `0005_announcements.sql`; the parent/coach feeds show posts without it.

After running a migration that adds tables or functions, regenerate the
TypeScript types (step 4 above). `0003`, `0004` and `0005` were hand-mirrored into
`database.ts` so the app compiles before you regenerate — regenerating
produces the same thing.

## Edge Functions

Server-side code that runs inside Supabase. There are two:

- `invite-user` — creates parent and coach accounts and sends their invite
  email (the browser can't do this itself).
- `delete-user` — permanently removes a coach's account (the "Remove
  coach" button); the mirror image of `invite-user` for the same reason —
  the browser's anon key can't call the Admin API.
- `generate-fees` — the scheduled fee job: generates the coming billing
  period for every student on a fee plan, and flips overdue fees. See
  "Scheduled jobs" below for wiring up its cron trigger.

**Deploying (one-time, and again whenever a function's code changes):**

```
npx supabase login
npx supabase functions deploy invite-user --project-ref <project-id>
npx supabase functions deploy delete-user --project-ref <project-id>
npx supabase functions deploy generate-fees --project-ref <project-id>
```

`login` opens a browser window once; after that the CLI remembers you.
Nothing else to configure — each function reads `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from secrets Supabase
provides to every function automatically.

Until `invite-user` is deployed, "Add coach" and "Add student → New
parent (send invite)" will fail with a "function not found" toast.
Linking a student to an **existing** parent, and everything else on
those screens, works without it. Until `generate-fees` is deployed and
scheduled, fees simply don't generate or go overdue on their own — the
admin "Generate now" button on the Fees screen doesn't need it (it calls
the database directly) and keeps working regardless.

**Scheduled announcements** are sent out the next time anyone in the
academy opens a feed after the scheduled time — there is no clock-driven
job. If you ever need them to go at the exact minute, enable the
`pg_cron` extension (Database → Extensions) and run once in the SQL
Editor:

```
select cron.schedule('publish-announcements', '* * * * *',
  $$select public.publish_due_announcements()$$);
```

(`publish_due_announcements()` uses the caller's academy, so under cron —
no caller — it would need a small variant that loops all academies. Ask
for that when the time comes; it's a five-line change.)

**Invite emails** go out through Supabase's built-in email service, which
is fine for testing but rate-limited (a few per hour). Before real use,
set up a custom SMTP provider under Authentication → Settings → SMTP.

See [DATA-MODEL.md](./DATA-MODEL.md) for what the schema actually contains.

## Scheduled jobs

**Fee generation, overdue transitions and credit expiry** (`generate-fees`)
should run once a day. Since 2026-09-16 the same run also calls
`expire_lapsed_credits()`, which writes off the unused classes of any
skater whose plan term has ended without a renewal — so if the job isn't
scheduled, lapsed credits stay on the books until it is (they're still
unbookable, because `book_class_slot` checks the term itself). After deploying it (above), set up its schedule — either
works, no code change needed either way:

**Option A — Supabase Dashboard (no SQL):** Project → Edge Functions →
`generate-fees` → look for a "Cron" / "Triggers" tab (naming varies by
dashboard version) → add a schedule, e.g. `0 2 * * *` (2am daily, UTC).
The dashboard handles authentication for you.

**Option B — SQL, if your project doesn't have that dashboard feature
yet:** enable the `pg_cron` and `pg_net` extensions (Database →
Extensions), then in the SQL Editor — paste in your own project URL and
**your own** service-role key from Settings → API (never one supplied by
anyone else, and never commit it to a file in this repo):

```
select cron.schedule(
  'generate-fees-daily',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/generate-fees',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <your-service-role-key>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Either way, nothing breaks if this is never set up — it only means fees
have to be generated by clicking "Generate now" and overdue fees won't
flip status automatically (they'll still show as pending with a visible
balance, just not the "Overdue" badge, until the job runs).

**Tuning how far ahead fees are generated, and the grace period.** Two
per-academy settings live in `academies.settings` (JSON). Defaults apply
when a key is absent:

- `fee_generate_lead_days` (default `7`) — the coming period is created
  this many days before the current one ends.
- `fee_grace_days` (default `5`) — a fee is due this many days after its
  period starts (or after the day it was generated, if that's later).
- `topup_min_classes` (default `{"monthly": 8, "quarterly": 24, "annual": 96}`)
  — the smallest top-up that starts or renews a pay-per-class plan term.
- `receipt_prefix` (default: the first four letters/digits of the academy
  name, upper-cased — "PRSA") — the start of every receipt number,
  e.g. `PRSA-2026-000012`. Change it before the first payment of a year
  if you can; changing it later is harmless but makes that year's
  receipts look like two series.

To change them, run in the SQL Editor (merge with `||` so the timezone
and any other keys are kept — never replace the whole object):

```
update public.academies
   set settings = settings || '{"fee_generate_lead_days": 10, "fee_grace_days": 7}'::jsonb
 where slug = '<academy-slug>';
```

There's no admin UI for these yet.

## Deploying

The web app is hosted on **Vercel**, connected to the GitHub repo
(`cloudsandeep007/skating-claude`, branch `master`). Every push to
`master` triggers a production deploy; pull requests get preview URLs.

`vercel.json` in the repo root does two things: tells Vercel it's a Vite
app (`npm run build` → `dist/`), and rewrites every URL to
`index.html` so React Router can handle `/login`, `/admin/...`, the
password-reset link, and page refreshes. Without that rewrite anything
other than `/` is a 404.

### One-time setup (Vercel dashboard → Project → Settings → Environment Variables)

Add these for **Production** (and Preview if you want preview URLs to
work). Values are the same ones in your local `.env`:

| Name                     | Value                                                    |
| ------------------------ | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase → Settings → API → Project URL                  |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` key          |
| `VITE_APP_ENV`           | `production`                                             |
| `VITE_SENTRY_DSN`        | optional — leave unset until Sentry is configured        |

Env vars are baked in at build time (`VITE_` prefix), so after adding or
changing one you must **Redeploy** (Deployments → ⋯ → Redeploy). The
app throws on startup — blank white page — if the two Supabase values
are missing.

Never add the service-role key to Vercel. It belongs only in Supabase
Edge Function secrets.

### Supabase side

In Supabase → Authentication → URL Configuration:

- **Site URL**: the Vercel production URL (e.g. `https://skating-claude.vercel.app`)
- **Redirect URLs**: add `https://<your-domain>/**` and, for previews,
  `https://*-<team>.vercel.app/**`

Otherwise password-reset and invite emails link back to `localhost`.

### Symptoms → causes

| Symptom                                       | Cause                                                        |
| --------------------------------------------- | ------------------------------------------------------------ |
| Blank white page, console says "Missing Supabase environment variables" | Env vars not set, or set after the last build — redeploy |
| `/` works but `/login` or refresh gives 404   | `vercel.json` rewrite missing                                |
| Reset-password email links to localhost       | Supabase Site URL not updated                                |
| Build fails on Vercel but passes locally      | Vercel runs `tsc -b` — check the build log's first error     |

## Backups and restore

_To be filled in before going to production — see the "production
ready" checklist in the build plan._

## Releasing the mobile apps

_To be filled in during Phase 4 (Capacitor)._

## Incident response

_To be filled in as real operational needs come up. At minimum this
should eventually cover: what to do when payments fail, how to roll
back a bad deploy, how to restore from a backup._
