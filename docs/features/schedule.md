# Schedule

## Purpose

Turns batches' weekly rules into actual sessions on actual dates, shows
them on a weekly calendar, lets the admin cancel or add one-offs, and
gives each coach a rink-side view of what they're teaching today.

## Screens

- **Weekly calendar** (`/admin/schedule`, academy admin) — Mon–Sun
  columns, today highlighted, one card per session colour-coded by
  batch (time, batch, coach, student count), holiday banners, a
  "Cancel session" link on future scheduled sessions, week navigation,
  **Extra session** dialog, and a **Holidays** card to add/remove dates.
- **Generate schedule** dialog — opened from a batch's detail page
  (batches feature imports it). Date range, defaults to the next 4 weeks.
- **Coach today** (`/coach`, coach) — the coach's sessions today as ink
  cards (time · venue caption, batch name, skater count), cancelled ones
  greyed with the reason. Empty state when nothing's on.

## Data touched

| Table / object                | Read | Write | Notes                                             |
| ----------------------------- | ---- | ----- | ------------------------------------------------- |
| `schedule_sessions`           | ✓    | ✓     | extra sessions inserted directly; others via RPC  |
| `holidays`                    | ✓    | ✓     | add/remove                                        |
| `batches`, `coaches`, `profiles`, `student_batches` | ✓ | | names, coach, per-batch student counts |
| RPC `generate_sessions`       |      | ✓     | expands the weekly rule; see below                |
| RPC `cancel_session`          |      | ✓     | cancel + notify parents, atomically               |
| `notifications`               |      | ✓     | written by `cancel_session`                       |

## Business rules

- **Generation is idempotent.** For every date in the range that matches
  the batch's days, the RPC does one of: `created`, `holiday` (skipped),
  `exists` (that batch already has a session at that time — left alone),
  `coach_conflict` (the batch's coach already has a non-cancelled session
  overlapping that time slot — skipped). The toast reports all four
  counts, so re-running over an already-generated range is safe.
- **Coach overlap** is "start < other.end AND end > other.start" on the
  same date, ignoring cancelled sessions. The same check runs client-side
  for an extra session and refuses with the clashing batch's name.
- **Holidays only affect generation.** Adding a holiday doesn't cancel
  sessions already on that date — cancel them, with a reason, so parents
  are told. Extra sessions *can* be placed on holidays deliberately.
- **Cancelling** requires a reason (≥3 chars), only works on `scheduled`
  sessions, and writes one `session_cancelled` notification per parent
  linked to any active student in the batch — a parent with two children
  in the batch gets one notification, not two. It can't be undone.
- Only future scheduled sessions show a cancel action on the calendar.
- Generation is capped at one year per run.

## Edge cases

- **Editing a batch's time** after generating: see the batches doc —
  existing sessions keep their time unless the admin opts in.
- A coach with no `coaches` row (e.g. a login not yet linked) sees an
  explanatory empty state instead of a spinner.
- Sessions of a batch whose coach is later unassigned keep their
  `coach_id` (it's copied at generation time) unless the admin uses the
  edit opt-in.
- Dates are handled as `YYYY-MM-DD` strings in the browser's local
  timezone (`shared/lib/format.ts`), never `toISOString()`, so late-evening
  use in IST doesn't roll over to the wrong day.

## Known limitations

- Calendar is week-only; no month or day view.
- No drag-to-reschedule; change a session by cancelling and adding an
  extra one.
- Marking a session `completed` isn't here — it comes with attendance
  (Phase 1.3).
- Parents don't yet see notifications in-app (the rows exist; the parent
  UI is a later phase).
- No bulk "regenerate the whole academy" — generate per batch.
