# Changelog

Dated, plain-language entries — what changed and why, written so a
non-technical person can follow it. Newest first.

---

## 2026-09-14 — Students and coaches screens for the academy admin

The first real day-to-day screens. Under **Skaters**, the admin now sees
the full roster as a table — each skater's photo initials, parent, batch,
level, attendance percentage (colour-coded, with a bar), fee status, and
when they were last at the rink — ten at a time with Prev/Next, a search
box, and batch/status filters. Clicking a skater opens their profile:
contact details, emergency contact, medical notes, their coach and
parent's phone/email, with tabs for Attendance, Progress, Fees and Notes
that are placeholders until those features are built. From there the
admin can edit the skater or **archive** them (which hides them from the
active list but keeps everything on file — nothing is ever deleted, and
they can be restored with one click).

Adding a skater is a single form: their details, an optional photo, an
emergency contact, and their parent — either picked from parents already
in the system or a brand-new one, in which case the app creates the
parent's login and emails them an invite to set a password.

Under **Coaches**, the admin sees each coach with how many batches and
skaters they cover, can invite a new coach (same invite-email flow), edit
their details, and deactivate/reactivate them.

The whole admin area now follows the design handoff in `docs/design/`:
the dark left sidebar with a white highlight on the current section,
the Archivo typeface, the red-accent focus rings and status pill colours,
and the rounded card style. Coach screens had no mockup, so they copy the
student screens' look.

**Two things need doing on the Supabase side before every part of this
works** — both are in RUNBOOK.md: run the new `0002_storage.sql`
migration (for photo uploads) and deploy the `invite-user` function (for
sending invites). Everything else — browsing, searching, editing,
archiving, linking an existing parent — works right now against the
seeded data and was checked in a browser.

## 2026-09-14 — Login, roles, and the app's overall shell

Built the part of the app everyone touches before anything else: signing
in. There's now a login page, "forgot password" and "set a new password"
pages, and the app remembers who's signed in and automatically renews
that sign-in in the background so people aren't logged out mid-session
for no reason. If a sign-in genuinely does expire, they see a clear
"please log in again" message instead of just being bounced with no
explanation.

Each of the four roles — super admin, academy admin, coach, parent — now
lands on its own home screen after login (still empty/placeholder
screens, the real dashboards come in later phases) and can't wander into
another role's screens. The admin screen has a sidebar that collapses
into a slide-out menu on phones; the coach and parent screens are
mobile-first with a bottom tab bar; the super-admin console is
deliberately dark and shows a loud banner naming which environment
(development/staging/production) it's talking to, so it's never
mistaken for the regular admin view.

Also wired up: toast notifications, a friendly "something went wrong"
screen instead of a blank crash, Sentry error tracking, and a GitHub
Actions check that runs on every push and fails the build if the code
doesn't type-check, isn't linted, breaks a test, or fails to build. Wrote
one automated browser test that logs in as each of the four roles and
confirms each lands in the right place — this passed against the real
seeded Supabase project before this session ended.

No real business screens yet (student lists, attendance, fees, etc.) —
this is the login/navigation skeleton those get built inside, starting
Phase 1.

## 2026-09-14 — Complete database schema and demo data

Built the entire database for the app as a single migration file
(`supabase/migrations/0001_initial_schema.sql`) — every table (academies,
people, students, batches, schedule, attendance, skill progression, fees,
payments, announcements, notifications, and the platform's own audit/error
logs and feature flags), all the security rules that keep one academy's
data invisible to another, and the calculations the dashboard will read
from later (attendance percentages, monthly fee collection, "students who
need attention").

Also wrote `supabase/seed.sql` — realistic demo data for one academy
("Glide Skating Academy" in Bengaluru): 3 coaches, 40 students with
parent logins, 9 skating levels with 5 skills each, 6 class batches, about
three months of attendance history, and three months of fees and
payments including a few overdue and partially-paid examples. Every demo
login uses the password `Password123!`.

Nothing in the app reads this data yet — that starts in Phase 1. This
session only builds the ground the features stand on. See
[DATA-MODEL.md](./DATA-MODEL.md) for the full table-by-table reference and
[RUNBOOK.md](./RUNBOOK.md) for how to apply it to a Supabase project.

## 2026-09-13 — Project foundation

Set up the empty project: the tools it's built with (React, Tailwind,
Supabase, etc.), the folder structure every feature will follow, code
style checks, and a starter test for both the fast (unit) and slow
(full app in a browser) kinds of tests. No actual app features yet —
this is the empty scaffolding everything else gets built on top of.

Also wrote the ground rules in `CLAUDE.md` so every future session
follows the same structure, and set up the documentation files
(this one included) that every session is expected to keep up to date.
