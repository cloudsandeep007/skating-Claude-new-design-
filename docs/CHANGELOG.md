# Changelog

Dated, plain-language entries — what changed and why, written so a
non-technical person can follow it. Newest first.

---

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
