# Schedule

> Restyled to the "Kinetic Obsidian" dark theme 2026-09-15 — visual only,
> nothing below changed. See docs/DECISIONS.md.
>
> Also 2026-09-15: an admin can schedule a make-up session for a class the
> academy cancelled — see "Make-up sessions" below and
> docs/features/attendance.md for the personal-absence side of the same
> feature.
>
> Also 2026-09-15: any batch-scoped fee plan now grants a running class
> -credit balance, spent by booking specific upcoming sessions a week
> ahead — see "Class bookings" below.

## Purpose

Turns batches' weekly rules into actual sessions on actual dates, shows
them on a weekly calendar, lets the admin cancel or add one-offs, and
gives each coach a rink-side view of what they're teaching today.

## Screens

- **Weekly calendar** (`/admin/schedule`, academy admin) — Mon–Sun
  columns, today highlighted, one card per session colour-coded by
  batch (time, batch, coach, student count), holiday banners, a
  "Cancel session" link on future scheduled sessions, week navigation,
  **Extra session** dialog, and a **Holidays** card to add/remove dates. A
  cancelled session with no make-up yet shows a **Schedule make-up**
  link; once one exists, the card shows "Make-up: <date>" and the new
  session's own card shows "Make-up for <date>". Every card also shows a
  **Booked: N** count when any student has booked that session.
- **Generate schedule** dialog — opened from a batch's detail page
  (batches feature imports it). Date range, defaults to the next 4 weeks.
- **Coach today** (`/coach`, coach) — the coach's sessions today as ink
  cards (time · venue caption, batch name, skater count), cancelled ones
  greyed with the reason. Empty state when nothing's on.
- **Class bookings — parent** (`/parent/schedule`, the skater's Schedule
  page) — for a skater on any batch-scoped fee plan: a credit-balance
  card ("6 of 16 classes left") and a **Book** / **Cancel** control on
  each of the next 7 days' upcoming sessions. Disabled once credits hit
  0. A skater on a legacy academy-wide plan sees the page exactly as
  before this feature — no credit card, no booking controls.

## Data touched

| Table / object                | Read | Write | Notes                                             |
| ----------------------------- | ---- | ----- | ------------------------------------------------- |
| `schedule_sessions`           | ✓    | ✓     | extra sessions inserted directly; others via RPC  |
| `holidays`                    | ✓    | ✓     | add/remove                                        |
| `batches`, `coaches`, `profiles`, `student_batches` | ✓ | | names, coach, per-batch student counts |
| RPC `generate_sessions`       |      | ✓     | expands the weekly rule; see below                |
| RPC `cancel_session`          |      | ✓     | cancel + notify parents, atomically               |
| RPC `schedule_makeup_session` |      | ✓     | links a new session to the cancelled one it replaces |
| `notifications`               |      | ✓     | written by `cancel_session` and `schedule_makeup_session` |
| `class_bookings`               | ✓    | ✓     | "Booked: N" count on each card; freed by `cancel_session()` |
| RPC `class_credit_balance` / `book_class_slot` / `cancel_class_slot` |  | ✓ | the parent-side booking flow — see "Class bookings" below |

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
- **Scheduling a make-up is a deliberate separate action, not automatic
  on cancellation** — `cancel_session()` itself is unchanged.
  `schedule_makeup_session()` only accepts a `cancelled` session with no
  make-up linked yet, reuses `generate_sessions()`'s holiday-skip and
  coach-conflict checks for the single new date (raising instead of
  silently skipping, since the admin chose this date deliberately), and
  notifies every parent in the batch the same way cancelling does. A
  cancelled session can have at most one make-up (enforced by a partial
  unique index on `makeup_for_session_id`).
- **The dialog only defaults the date (to the next day), never the
  time.** The cancelled class's own usual time slot is exactly where its
  coach is most likely already teaching something else that day (or, for
  a same-weekday-next-week default, exactly where the batch's own next
  regular class falls) — either default would routinely trip the
  coach-conflict check. Making the admin pick an actual free time avoids
  handing them a slot that looks safe but usually isn't.
- **Whole-batch vs. individual make-ups.** A session the *academy*
  cancels gets one make-up session for the whole batch here. A student's
  *personal* absence (coach marks them absent, class otherwise happens)
  instead grants that one student a make-up **credit** — see
  docs/features/attendance.md. The two mechanisms are deliberately
  separate: nobody else in the batch missed anything when only one
  student is absent.
- **Class bookings run on one running credit balance, not a per-period
  ledger.** Every time `generate_upcoming_fees()` creates a period for a
  batch-scoped plan, it sets `student_fees.credits_granted` from
  `expected_classes_from_schedule()`. `class_credit_balance()` sums that
  across every period the student has ever had, subtracts every active
  booking they've ever made, and adds back every still-pending make-up
  credit. Nothing resets at a period boundary — an unused credit from an
  old period is still spendable later, which is the entire mechanism for
  "leftover carries forward if you re-enroll," with no extra rollover
  code. See docs/DECISIONS.md for the full reasoning.
- **A credit is "spent" the moment it's booked**, not when it's marked —
  a booking's row stays `'booked'` permanently once the session has
  happened, so nothing needs to change at marking time. The only thing
  that can still move the balance after booking is the existing
  absent→make-up-credit trigger, which nets a missed booked class back
  to a wash (the booking's `-1` plus the make-up credit's `+1`) —
  functionally the credit was never lost, just moved to a different day.
  A booking can only be cancelled — freeing the credit — while its
  session is still `scheduled`; once marked, it's permanent.
- **Booking follows the roster, not the other way round.** A booking can
  only target a session in the student's own currently-enrolled batch.
  It never changes what's on the schedule (sessions are still generated
  from the batch's `days_of_week` exactly as before) — only who's
  expected shows up as "booked," which is what the coach's attendance
  screen now rosters from for a batch-scoped-plan student (see
  docs/features/attendance.md).
- **A legacy academy-wide (no-batch) plan opts a student out of
  everything above.** `expected_classes_from_schedule` needs a specific
  batch, so those plans never generate `credits_granted`, those students
  never see the booking UI (`class_credit_balance()` returns `null`, not
  `0`), and they keep showing on every session's roster exactly as
  before this feature.

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
