# Attendance

> Restyled to the "Kinetic Obsidian" dark theme 2026-09-15 — visual only,
> nothing below changed except one bug fix: the coach's "Confirm
> attendance" button no longer renders red when everyone is marked. See
> docs/DECISIONS.md.
>
> Also 2026-09-15: a personal absence now automatically grants the
> student a make-up credit — see "Make-up credits" below and
> docs/features/schedule.md for the whole-batch (academy-cancelled) side
> of the same feature, and docs/features/fees.md for per-class billing.
>
> Also 2026-09-15: a session's attendance roster now follows the week's
> class bookings for a skater on a batch-scoped plan, instead of simply
> everyone enrolled in the batch — see "Booking-driven roster" below and
> docs/features/schedule.md for the booking system itself.

## Purpose

The screen coaches use every day, rink-side, one-handed, often in glare
and with patchy wifi — so it's built to be fast and hard to get wrong.
Plus the admin's view/override/export tools and the parent's history.

## Screens

**Coach** (`/coach`, `/coach/attendance/:sessionId`)
- **Today** — today's sessions as ink cards (time · venue, batch, skater
  count, "Marked" / "3/7 marked" badge), then yesterday's sessions under
  "still open for changes". Tap a card to mark.
- **Mark attendance** — follows the design mockup: ink header with date ·
  time · venue, batch name, a running **"12 of 15 marked"** counter with
  present/absent/late counts and a progress bar; **Mark all present**
  (the default fast path); one 72px row per skater with photo/initials
  and two 56px ✓ / ✗ targets; tapping the row cycles present → absent →
  late. A full-width **Confirm** at the bottom stays ink until everyone is
  marked, then goes brand red ("Confirm attendance" vs "Confirm anyway").
  Locked sessions show a banner and disabled controls.

**Admin** (`/admin/attendance`)
- **By date** — pick a day, expand any session to see every skater's mark
  and override it with a dropdown.
- **By batch** — batch (or all) + date range → per-student sessions,
  present/absent/late/excused counts and %, with **Export CSV**.
- **By student** — student + range → overall % and a session-by-session
  list with an override dropdown per row, **Export CSV**.

**Admin — skater profile** (`/admin/students/:id`, "Attendance" tab)
- **Make-up credits** card — the student's pending make-up credits (batch
  and the date they missed) with a **Mark fulfilled** button per credit.
  Empty state when nothing's owed.

**Parent** (`/parent`)
- One child (a dropdown if they have several): overall % for the last six
  months in an ink card, then a card per month with its %, counts and the
  session list. When a make-up credit is pending, the summary card also
  shows an **Expected N · Attended M · K make-up class(es) owed** line
  and a highlighted banner.

## Data touched

| Table / object                   | Read | Write | Notes                                                    |
| -------------------------------- | ---- | ----- | -------------------------------------------------------- |
| `attendance`                     | ✓    | ✓     | coach via RPC (time-locked); admin upsert (audited)      |
| `schedule_sessions`              | ✓    | ✓     | RPC sets `completed` on first save                       |
| `student_batches`, `students`, `levels` | ✓ |     | roster; photo path → signed URL (`student-photos`)       |
| `parents_students`               | ✓    |       | parent's children                                        |
| RPC `session_is_editable`        | ✓    |       | the lock rule (falls back to "today or yesterday" if the RPC isn't deployed yet) |
| RPC `save_attendance`            |      | ✓     | all marks + completion, one transaction                  |
| RPC `attendance_summary_for_range` | ✓  |       | admin "by batch" percentages, plus `expected_sessions`/`pending_makeup_credits` for the report |
| `makeup_credits`                 | ✓    | (auto)| granted/revoked by the `attendance_makeup_credit` trigger, not written directly by the app |
| `class_bookings`                 | ✓    |       | who's booked a session — the roster source for a batch-scoped-plan student |
| RPC `fulfill_makeup_credit`      |      | ✓     | admin "Mark fulfilled" button                            |
| `audit_logs`                     |      | ✓     | by the existing `audit_attendance` (and new `audit_makeup_credits`) triggers, automatically |
| Browser `localStorage`           | ✓    | ✓     | `attendance-pending-saves` — the retry queue             |

## Business rules

- **Percentage** (`hooks/attendancePct.ts`, unit-tested):
  `attended = present + late`, `counted = present + absent + late`,
  `pct = attended / counted` to one decimal; excused counts for nothing;
  no counted sessions → `null` (shown as "—"), never 0%. Identical to the
  SQL views, so the roster, dashboard, admin and parent numbers agree.
- **24-hour lock.** A coach can mark from the start of the session's day
  until 24 hours after it ends — in the **academy's timezone**
  (`academies.settings.timezone`), not the server's. Enforced by RLS on
  `attendance` via `session_is_editable()`; the UI only mirrors it.
  Admins are exempt (their override policy has no time check).
- **Cycle order** on the row: unmarked → present → absent → late →
  present. The ✓/✗ buttons set present/absent directly. **Excused** is
  admin-only (set via override), because it changes the percentage math.
- **"Confirm anyway"** with unmarked skaters saves only the marked ones;
  the rest stay blank for a later pass (the session still becomes
  `completed`).
- **Optimistic + queued.** Confirm writes the marks to localStorage first,
  then tries the server. If that fails for any reason the marks stay
  queued; the coach sees "Saved on this device — waiting to sync", the
  header shows "N to sync", and the app retries on reconnect and every
  20 seconds. Reopening the session shows the queued marks, not the
  server's older ones. A queued save is removed only after the server
  confirms.
- **Admin override** is a plain upsert with `notes = 'Set by admin'`; the
  audit trigger records the admin as actor with old and new values. No
  extra "reason" step — speed over ceremony; the audit log is the trail.
- Saving marks a `scheduled` session `completed`; cancelled sessions
  can't be marked.
- **A personal absence grants a make-up credit automatically.** The
  `attendance_makeup_credit` trigger fires on every insert/update of
  `attendance.status`: marking a student `absent` inserts a `pending`
  `makeup_credits` row (`on conflict do nothing`, so re-marking absent
  twice is harmless); correcting a mistaken absent mark back to
  present/late/excused deletes the credit if it's still pending. This is
  the entire mechanism — `save_attendance()` and the coach marking UI
  (including the offline-queue flow) needed **zero changes**, since the
  trigger fires from the row write they already do.
- **Credits don't expire or auto-fulfil.** A pending credit stays pending
  — and keeps showing as owed everywhere — until an admin clicks **Mark
  fulfilled** on the student's profile (`fulfill_makeup_credit()`). There
  is no attempt to detect "this attendance mark redeems that credit";
  fulfilling is always a manual admin action.
- **This only covers a personal absence.** If the *academy* cancels the
  whole class, no credit is granted here at all — instead the admin
  schedules one make-up session for the whole batch from the Schedule
  screen (see docs/features/schedule.md). The two paths don't overlap:
  a cancelled session never gets attendance rows, so this trigger simply
  never fires for it.
- **Booking-driven roster.** A session's roster (who a coach sees and can
  mark) is now: actively-enrolled students whose current fee plan has no
  batch (legacy/academy-wide plans, unaffected) **union** actively
  -enrolled students who booked *this specific session* (see
  docs/features/schedule.md for the booking system). A batch-scoped-plan
  student who never booked simply doesn't appear that day — this is
  intentional, not a bug: booking is what says "I'm coming." Nothing
  about `save_attendance()`, the offline-queue retry flow, or the rest
  of `MarkAttendancePage` changed — only where the roster query pulls
  its student list from.

## Edge cases

- **Two coaches mark the same session** — last write wins per student
  (upsert). Both saves succeed; the roster shows the latest.
- **A save is rejected by the lock** (e.g. queued offline, synced two
  days later) — it stays in the queue showing the RLS error. There's no
  "discard" button yet; clearing site data removes it. See limitations.
- **A student enrolled after the session** appears on the roster (it's
  the batch's current roster), unmarked — harmless; it never counts.
- **Roster photo can't be signed** (bucket not created, no photo) —
  initials, silently.
- **Timezone** — dates are local `YYYY-MM-DD` throughout; the lock is
  computed in the DB in the academy's zone.

## Known limitations

- No "discard queued save" control; a permanently-rejected save sits in
  the queue with its error until site data is cleared.
- "Undo" after confirm (from the mockup toast) isn't built; re-open the
  session within 24h and change marks instead.
- Admin override has no free-text reason field — only the audit trail.
- CSV export is what's on screen (current range/batch), not all history.
- Parent view is fixed to the last six months.
- No push/email to parents about attendance; only the in-app history.
