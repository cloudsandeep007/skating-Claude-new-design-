# Parent app

## Purpose

Everything a parent checks in ten seconds on a phone: when the next
session is, how attendance is going, whether fees are due, and what the
academy has said. Composes the attendance, schedule and announcements
features rather than re-implementing them.

## Screens (`/parent/…`, mobile-first, 4-tab bottom nav + profile icon)

- **Home** — child selector (a dropdown only when there's more than one
  skater), ink card for the next session (or "nothing scheduled yet"),
  this month's attendance % with attended/counted, current fee status
  pill with amount and due date, and the latest announcement (with unread
  dot). Every card links to its full screen.
- **Child profile** (`/parent/child`, from the profile page's skater list)
  — level, age, member-since, batches with days/time/venue/coach, and the
  emergency contact / medical notes on file (read-only, with a note to
  contact the office to change them).
- **Attendance** (`/parent/attendance`) — last six months, overall and
  per-month percentages, session-by-session list. (Moved here from the
  attendance feature in this phase; the maths still lives there.)
- **Schedule** (`/parent/schedule`) — next 30 sessions across the child's
  active batches, today highlighted, cancelled ones shown with the reason.
- **News** (`/parent/announcements`) — the announcement feed; badge on the
  tab.
- **Profile** (`/parent/profile`, top-right icon) — edit own name/phone,
  list of skaters, change password, sign out.

## Data touched

All reads are scoped by the existing parent RLS policies (own children,
their batches' sessions, own notifications).

| Table / object                        | Read | Write | Notes                                         |
| ------------------------------------- | ---- | ----- | --------------------------------------------- |
| `parents_students`, `students`, `levels`, `student_batches`, `batches`, `coaches`, `profiles` | ✓ | | child profile and options |
| `schedule_sessions`                   | ✓    |       | upcoming sessions                              |
| `student_fees` + `fee_plans`          | ✓    |       | most recent fee by due date                    |
| `profiles` (own row)                  |      | ✓     | name/phone                                     |
| Supabase Auth                         |      | ✓     | change password                                |
| Browser `localStorage`                | ✓    | ✓     | `parent-selected-child` — which child is open  |
| via `@/features/attendance`           | ✓    |       | `useStudentHistory`, `computeTotals`, …        |
| via `@/features/announcements`        | ✓    | ✓     | feed, mark read, unread badge, realtime        |

## Business rules

- **Selected child** persists across screens and reloads (Zustand +
  localStorage) and self-corrects to the first child if the remembered
  one no longer belongs to this login.
- **"This month"** on Home is the calendar month to date, using the same
  percentage rule as everywhere else.
- **Fee status** is the child's most recent fee by due date (same rule as
  the admin roster).
- **Next session** is the first non-cancelled upcoming session; cancelled
  ones still appear in the Schedule list, greyed with the reason.
- Parents can change their own name and phone but nothing about the
  child — that's the academy's record.

## Edge cases

- No linked child → a clear "ask the academy" empty state on every screen.
- A child in two batches sees sessions from both, merged by date.
- Fee amounts are shown in rupees with Indian grouping (`₹2,500`).

## Known limitations

- No way to message the academy from the app; contact details are on the
  child profile only in the other direction.
- No fee payment (Phase 6) — status only.
- Attendance is fixed to six months; schedule to 30 sessions.
- No skill-progress screen yet (Phase 2 — the design's "Parent — Child
  progress" mockup).
