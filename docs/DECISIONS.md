# Architecture decision log

Newest first. One entry per real choice made — not every line of code,
but anything a future session (or future you) would otherwise have to
re-derive or might accidentally reverse.

Format:

```
## YYYY-MM-DD — <short decision title>

**Decision:** what was decided.
**Options considered:** the alternatives and why they were on the table.
**Why:** the reasoning that picked the option above.
**Trade-offs:** what this costs or risks, and when to revisit it.
```

---

## 2026-09-15 — Billing periods: continue from the last period on any plan; stub-then-align; generate ahead with grace

**Decision:** Three linked rules in `generate_upcoming_fees()` (migration
0019, Phase 0 of the payments audit), replacing the calendar-alignment
rule from earlier today:
1. The next period is anchored on the student's latest `period_end`
   across **all** their fees (any plan, or a deleted plan's null
   `fee_plan_id`), and starts the day after it — never earlier.
2. A period whose start isn't the 1st is a **stub** to the end of that
   month; cycle plans are priced pro-rata (`amount / months_in_cycle ×
   days_covered / days_in_month`), per-class plans are pro-rata by
   construction. Every subsequent period starts on the 1st and runs a
   full cycle.
3. The coming period is generated `fee_generate_lead_days` (default 7)
   before the current one ends, and `due_date = greatest(period_start,
   today) + fee_grace_days` (default 5). Both are read from
   `academies.settings`.

**Options considered:**
- *Keep the per-plan anchor* — rejected: it's the direct cause of billing
  silently stopping after a plan switch (audit F-01), because the fallback
  to the join month always collides with an existing period.
- *Snap back to the 1st of the month* (this afternoon's 0017) — rejected:
  double-bills the days between an old anniversary-style period's end
  and the 1st (F-04). Snapping forward with a stub is the standard
  "align on next renewal" pattern and never re-bills a day.
- *Bill the first period from the 1st of the join month at full price*
  (0017's accepted trade-off) — replaced by the stub: a student joining
  on the 15th now pays for the 15th–30th only, which is both fairer and
  what the per-class plan was already doing.
- *Generate after the period ends, due on period start* (all prior
  versions) — rejected: with 1st-of-month starts, that makes every fee
  overdue on creation (F-03, seen live). Generating ahead is also what
  lets a family see a bill before it's due.
- *Hard-coded 7/5 days vs. settings* — settings chosen so a second
  academy on the platform can differ without a deploy; defaults apply
  when the key is absent.

**Why:** Each rule closes a reproducible money bug from the audit, and
together they make the period sequence for any student a clean chain
with no gaps, no overlaps, and no fee that's overdue on the day it
appears — invariants I-5 and I-6 in the audit report.

**Trade-offs:** The first invoice for a mid-month join is now smaller
than the plan amount, which an admin might not expect if they're used
to "first month is full price" — the period dates on the fee make it
obvious. A quarterly/annual plan joined mid-month gets a one-month stub
before its first full cycle. `feeMath.ts` mirrors all three rules under
unit tests (it had silently drifted from the database after 0017; that's
fixed and the tests now assert the current rules).

## 2026-09-15 — Credit balances can't be pushed negative by a delete; periods with payments can't be deleted

**Decision:** `delete_payment()` and `delete_student_fee()` now (a)
refuse when the student's credit balance would end up below zero *and*
lower than before the action, naming the number of upcoming bookings to
cancel; and (b) `delete_student_fee()` refuses outright when any payment
exists on the period. `book_class_slot()` takes the student explicitly
and locks the student row (`select … for update`) for the duration of
the check-and-insert.

**Options considered:**
- *Absolute "balance ≥ 0" guard* — rejected for now: skaters who already
  had a negative balance from before the guard (S1 had −6 today) would
  be un-cleanable; the "no worse than before" form lets unrelated
  periods be deleted while still blocking any action that takes credits
  away from spent bookings. The absolute invariant arrives with the
  credit ledger in Phase 2, after existing negatives are resolved.
- *Auto-cancel bookings on delete* (the eventual Phase 2 clawback
  policy) — deferred: it needs a notification to the parent and a
  preview in the admin's confirm dialog to be safe; refusing with a
  clear count is the honest interim.
- *Cascade-delete payments with the period* (0016's behaviour) — rejected
  (audit F-07): a payment is a record of money received and must never
  disappear as a side effect of something else. Phase 1 replaces
  payment deletion with voiding altogether.
- *Advisory lock vs. row lock for booking* — row lock on `students`
  chosen: simplest, scoped exactly to one skater, released at commit.
- *Keep `limit 1` child selection* — rejected (F-05): a parent with two
  children in one batch was booking for an arbitrary one.

**Why:** These are the audit's I-1 (never negative) and I-3 (payments are
never destroyed) invariants, in their smallest safe form.

**Trade-offs:** An admin who genuinely needs to reverse a payment for a
skater with bookings has to cancel those bookings first (from the
parent's side today — there's no admin cancel-booking UI yet; Phase 2).
The lock serialises bookings per skater, which is imperceptible at this
scale. Changing `book_class_slot`/`cancel_class_slot`'s signature means
any client on the old one-argument form breaks — only
`ChildSchedulePage` called it, and it's updated.

## 2026-09-15 — Unpaid fees stay live-synced to plan/batch/holiday changes

**Decision:** Refined the "amounts are a locked-in historical snapshot"
rule (see the per-class-billing and credits-require-payment entries
below) to apply only *after* a fee is settled. Added
`recompute_open_fees_for_plan(p_fee_plan_id)` plus three triggers —
`AFTER UPDATE` on `fee_plans` (amount/per_class_rate/pricing_mode/
batch_id), `AFTER UPDATE` on `batches` (days_of_week), `AFTER INSERT OR
DELETE` on `holidays` — that recompute `amount` and `credits_granted`
for every `student_fees` row still in `pending`/`overdue`, then
re-derive `status` against the recomputed amount and whatever's already
been paid.

**Options considered:**
1. *Leave the snapshot rule absolute, as before* (previous behavior) —
   rejected per client report: a fee generated off a 5-day batch kept
   billing ₹8,800 after the batch was edited to weekends-only, with no
   automatic path back to a correct number — the admin's only recourse
   was `delete_student_fee()` + "Generate now" (0016), which is fine as
   a manual escape hatch but shouldn't be required for something the
   system caused.
2. *Recompute on read* (compute the "current" amount live in
   `student_fees_list`/the student profile query, instead of writing it
   back) — rejected: `amount` is used directly by `record_payment()`
   and the credits math (`class_credit_balance`, `class_credit_summary`)
   elsewhere, so a read-time-only number would disagree with what those
   RPCs see; keeping one source of truth in the row itself avoids a
   second parallel calculation to keep in sync.
3. *Trigger-based recompute, scoped to unpaid fees only* (chosen) —
   keeps the existing "paid/waived is permanent history" guarantee
   completely intact (nothing about `record_payment()`, `delete_payment()`,
   or the credits-require-payment gate changes), while making the
   *unpaid* number track reality automatically, which is what an admin
   actually expects for money not yet collected.

**Why:** A pending or overdue fee is a quoted future obligation, not a
receipt — there's no reason it should freeze at a value that was only
ever an artifact of *when* the admin happened to click "Generate now"
relative to *when* they finished configuring the plan or batch. Once
money changes hands, freezing is exactly the right behavior (that's
still true and unchanged) — the fix narrows scope to where the original
rule didn't actually apply.

**Trade-offs:** Editing a batch used by several fee plans, or an academy
holiday used by several batch-scoped plans, now fires a recompute loop
over every affected plan's open fees on every such edit — fine at this
app's scale (an academy has a handful of batches/plans, each with a
handful of open fees), but a very large academy doing frequent batch
edits could feel this as extra write latency; revisit if that ever
becomes noticeable. A partial payment recorded against the old amount
can now cause a fee to jump straight to `paid` status on an unrelated
rate change (e.g. a rate cut that happens to be fully covered already)
without an explicit "record payment" action — this is intentional (the
money genuinely does cover it now) but worth remembering if it looks
surprising in the payment history.

## 2026-09-15 — Billing periods align to the calendar month, not join date

**Decision:** `generate_upcoming_fees()` now anchors every new period's
`period_start` to the 1st of a calendar month
(`date_trunc('month', coalesce(last_period_end + 1, joined_date))`),
instead of chaining directly off `last_period_end + 1` /
`joined_date` as-is. Since `period_end` was already derived by adding a
full `billing_cycle` interval and subtracting one day, starting from the
1st automatically makes every period end on a month boundary too
(Sep 1 – Sep 30, Oct 1 – Oct 31, ...) — no other change to the function
was needed.

**Options considered:**
1. *Leave it anniversary-based* (previous behavior) — rejected: the
   client expected calendar-month billing ("it should start from 1st of
   each month right?"), and an anniversary date is harder to reconcile
   against bank statements or month-by-month reports.
2. *`date_trunc` on `period_start` only* (chosen) — smallest possible
   change; `period_end` falls out correctly for free because of how it's
   already computed, so no separate rounding logic was needed for it.
3. *Prorate the first (partial) period* — e.g. a student joining Sep 15
   pays a half-price Sep 15–30 fee, then full months after — rejected as
   out of scope: it needs a proration formula and changes the amount
   calculation, not just the dates; the client's request was specifically
   about the date alignment, not billing amount. Can be added later as
   its own change if wanted.

**Why:** Matches the client's explicit expectation, and is the more
common convention for a monthly-billed service — easier for parents and
admins to reason about ("this month's fee") than a rolling window tied to
an arbitrary join date.

**Trade-offs:** A student's first period after this change can be
shorter than a full month (e.g. joining Sep 20 gets a Sep 1–30 period
that's really only ~10 days of enrollment, billed at the full monthly
amount) — no proration was requested or built, so the first period after
joining mid-month is full price for a partial month, same as it would
have been under the old scheme's first period too (that one was also
never prorated — it just happened to run a full cycle length starting
from the join date instead of from the 1st). Only periods generated from
now on are affected; nothing already in `student_fees` is rewritten
(same historical-snapshot rule as `amount`/`credits_granted` — see the
"per-class billing" and "credits require payment" entries below).

## 2026-09-15 — Admins can delete a payment or roll back a fee period

**Decision:** Added `delete_payment()` and `delete_student_fee()` RPCs and
matching UI (a trash icon per payment, a "Delete period" button per fee
card on the admin skater profile). Both were already permitted at the RLS
layer — `payments_admin_all` / `student_fees_admin_all` are `for all`
policies, so an admin could already delete either table's rows directly —
the gap was purely that no UI action existed, and a raw client-side
`.delete()` on a payment would leave the fee's `status` stuck on `paid`
with nothing paid, and a raw delete of a fee with payments on it would
just fail outright (`payments.student_fee_id` is `on delete restrict`,
not cascade).

**Options considered:**
1. *Client-side delete + manual status fix* — two separate calls from the
   browser (delete the payment, then update the fee status) — rejected:
   two round trips risk a half-done state if the second fails, and the
   status-recompute logic (paid if still covered, else overdue/pending by
   due date) belongs next to `record_payment()`'s own logic, not
   duplicated in the frontend.
2. *One RPC per action* (chosen) — `delete_payment()` bundles the delete
   and the status recompute; `delete_student_fee()` bundles deleting a
   period's payments (working around the restrict FK) and the period
   itself — both atomic, both following the exact bundling pattern
   `record_payment()` and `save_attendance()` already use elsewhere in
   this codebase.

**Why:** This was requested directly after a real mistake surfaced in
testing — a per-class plan's fee got generated before the plan's pricing
was finished being set up, freezing a wrong amount onto that period
forever (by design — fee amounts don't follow later plan edits). There
was no way to correct it except editing the database directly.

**Trade-offs:** Both actions are genuinely destructive (payment history,
specifically) and admin-only, confirmed via an `AlertDialog` naming
exactly what will be removed before it happens. `audit_payments` /
`audit_student_fees` already log every delete automatically with the
actor and the old values, so the record of *that it happened* survives
even though the row itself doesn't.

---

## 2026-09-15 — Credits gated behind payment, and surfaced to admins

**Decision:** `class_credit_balance()` now sums `credits_granted` only
from `student_fees` rows with `status in ('paid', 'waived')` — a
pending/overdue period contributes zero credits until it's settled. This
was a one-line change to an existing `sum(...)` filter, not a new
mechanism, because the balance was already a live query over
`student_fees` rather than a value frozen at generation time. Added
`class_credit_summary()` — the same formula split into
`(granted, booked, bonus, available)` — so the admin side isn't limited
to a single opaque number; it's shown on the student profile (a badge
next to attendance %, and a full breakdown card on the Attendance tab,
right where `MakeupCreditsCard` already lives).

**Options considered:**
1. *Where to gate* — (a) filter the existing balance query by fee status
   (chosen); (b) a separate "credits released" flag flipped by
   `record_payment()`. (a) needed no new column or trigger — payment
   status already lives on `student_fees.status`, and the balance was
   never stored, only computed, so there was nothing to keep in sync.
2. *What the parent sees at 0* — distinguishing "unpaid" from "genuinely
   out of credits" was worth the extra `exists(...)` check in
   `book_class_slot()` and a parallel client-side check (via the
   student's existing `student_fees` query) — a flat "No credits left"
   would have looked identical to a real problem needing academy
   attention, and confusing which one it is defeats the point of gating
   on payment in the first place.

**Why:** The client's model is: you pay, you get classes. Letting
booking work before payment quietly broke that — an unpaid family could
already be filling their week's slots.

**Trade-offs:** none of substance — this only tightens an existing check
by adding a `WHERE` clause; no schema change, no migration of existing
data needed (a period generated before this shipped simply starts
counting the moment it's marked paid, same as it always could be).

---

## 2026-09-15 — Universal class-credit + weekly booking system

**Decision:** Extended the same-day make-up-credits work into a system
where *every* batch-scoped fee plan (not just per-class ones) grants the
student a running credit balance, spent by booking specific upcoming
sessions a week at a time. Concretely:
- `student_fees.credits_granted` — set at generation time for any plan
  with a `batch_id`, using the same `expected_classes_from_schedule()`
  already built for per-class billing. Copied onto the row (immutable
  history), never recomputed.
- `class_bookings` — one row per (student, session) they've reserved.
- `class_credit_balance(student)` = `Σ credits_granted − active bookings
  + pending make-up credits`. No ledger table, no period-scoped resets —
  a single running sum that never resets, so unused credits automatically
  "carry forward" to the next period/enrollment with no extra code.
- The attendance-marking roster changed from "everyone actively enrolled
  in the batch" to "everyone actively enrolled **and** either on a
  legacy no-batch plan, or actively booked for this specific session."

**Options considered:**
1. *Where credit consumption "happens"* — (a) decrement a counter when a
   booking is made, re-increment on cancel, separately again on mark
   (chosen implicitly by *not* doing this — see below); (b) never
   literally decrement anything — a booking, once made, simply counts
   permanently against the running balance (`available_credits` already
   subtracts every `'booked'` row, whether the session has happened yet
   or not), and only the already-built absent→make-up-credit trigger
   ever adds back to the balance. (b) was chosen: it means "spent at
   booking, refunded automatically on a missed booked class" and "spent
   only once truly attended" produce the *identical number* for
   `available_credits` — present/late/excused leave the booking's `-1`
   standing permanently, absent leaves the same `-1` but adds a `+1`
   bonus, netting to a wash. No separate "consume on mark" step was ever
   needed once this was traced through.
2. *Per-period ledger vs. one running balance* — (a) reset/recompute
   credits each billing period, with an explicit "roll leftover into the
   next period" step at renewal (rejected — a real ledger table with
   period boundaries, more moving parts, more ways to get the rollover
   math wrong); (b) one lifetime running sum per student (chosen) —
   "carry forward if you re-enroll" is just what a running sum already
   does; there is nothing to roll over because nothing was ever
   period-scoped to begin with.
3. *Should legacy academy-wide (no-batch) plans be forced into the
   booking system* — rejected. A plan with `batch_id = null` can't
   compute `expected_classes_from_schedule` (no batch to count from), so
   those students simply keep today's behavior (auto-rostered, no
   booking, no credits) rather than breaking or requiring an immediate
   data migration of every existing fee plan.

**Why:** The client wants one consistent mental model across pay-per
-class, weekend, and weekday/monthly enrollments: you're granted a
number of classes, you book which specific days you're using them on a
week at a time, and a class you booked but missed isn't lost. Tracing
that requirement against what "carry forward" already meant today (a
pending, never-expiring `makeup_credits` row) showed the whole system
could be expressed as one formula with no new bookkeeping primitive,
which is both less code and less that can drift out of sync.

**Trade-offs:** The attendance roster is no longer "everyone in the
batch," which is a real behavior change for any coach used to seeing the
full class list — mitigated by leaving every legacy (no-batch-plan)
student on the old behavior, so only batch-scoped-plan students are
affected, and by keeping `save_attendance()`, the offline-queue retry
flow, and the rest of the marking screen completely untouched (only the
roster *query* changed). A student on no fee plan at all, or on a plan
that never had a batch, gets `class_credit_balance() = null` and simply
never sees any booking UI — an academy must keep every actively-taught
student on a batch-scoped plan for the booking system to apply to them,
which is a data-hygiene expectation this migration doesn't enforce.

---

## 2026-09-15 — Make-up credits (attendance) + make-up sessions (schedule) + per-class billing

**Decision:** A missed class now "carries forward" via two deliberately
separate mechanisms depending on *why* it was missed, plus a new per-class
pricing mode so a plan can bill by the class instead of a flat cycle
amount:
1. **Personal absence** — an `attendance_makeup_credit` trigger fires on
   every insert/update of `attendance.status` and grants the student a
   `pending` row in a new `makeup_credits` table the moment they're marked
   `absent` (removing it if the mark is corrected away from absent). This
   needed **zero changes** to `save_attendance()` or the coach marking UI
   — including the offline-queue retry flow — because it hooks the same
   row write that flow already does.
2. **Academy cancels the whole class** — a new
   `schedule_makeup_session(original_session_id, date, start, end)` RPC
   lets an admin add one new session for the whole batch, linked back to
   the cancelled one via `schedule_sessions.makeup_for_session_id`. This
   is a deliberate, separate admin action — `cancel_session()` itself is
   unchanged, and cancelling never grants a personal credit (no attendance
   rows are ever written for a cancelled session, so the trigger above
   never fires for it either).
3. **Per-class billing** — `fee_plans.pricing_mode` ('cycle' | 'per_class')
   and `.per_class_rate`. A per-class plan's amount is computed **upfront**
   at generation time as `rate × expected_classes_from_schedule(batch_id,
   period_start, period_end)` — a new read-only function that counts the
   batch's `days_of_week` minus `holidays` over the period, mirroring
   `generate_sessions()`'s own day-loop. `billing_cycle` (monthly/
   quarterly/annual) is completely unchanged; per-class only changes the
   amount formula, not how long a period is.

Credits never expire and are only ever cleared by an admin clicking "Mark
fulfilled" (`fulfill_makeup_credit()`) — no attempt to auto-detect "this
attendance mark redeems that credit."

**Options considered:**
1. *Personal-absence mechanism* — (a) a trigger on `attendance` (chosen);
   (b) a check inside `save_attendance()` itself. (a) won because it
   keeps the delicate offline-tolerant coach flow completely untouched —
   any future write path to `attendance` (admin override included) gets
   the same behavior for free, instead of needing to remember to call a
   "grant credit" step.
2. *Who gets the make-up* — the user was explicit: academy-cancelled →
   whole batch gets one added session; personal absence → only that
   student gets a credit, since nobody else in the batch missed anything.
   Implementing these as one unified "credit" concept for both cases was
   considered and rejected — a whole-batch credit-per-student would be N
   credit rows to track and fulfil individually for something that's
   really one make-up class, versus one new session everyone can attend.
3. *Per-class pricing timing* — (a) computed upfront from the schedule at
   generation time (chosen, per explicit user answer); (b) computed after
   the fact from sessions actually held that period. (a) matches how
   billing already works (a fee is generated once, before the period
   necessarily has all its sessions), avoids a fee amount that silently
   changes if a session gets added/cancelled after generation, and reuses
   the exact weekday-counting approach `generate_sessions()` already has.
4. *Reporting "expected" vs. billing "expected"* — deliberately two
   different calculations rather than one shared function: billing needs
   the count **before** sessions necessarily exist (schedule-based,
   `expected_classes_from_schedule`), while the attendance report and
   parent dashboard show a period that's mostly already happened, so they
   count real `schedule_sessions` rows instead (simpler, and automatically
   reflects ad-hoc/make-up sessions without extra logic).

**Why:** The user's own client bills per class and needs missed/cancelled
classes to visibly carry forward for both the parent and the admin,
without inventing new fee-credit bookkeeping (a credit here means "you get
an extra class," never "we'll adjust next month's invoice").

**Trade-offs:** Two separate mechanisms (credits vs. batch make-up
sessions) is more surface area than one unified concept, but matches the
real-world difference the user described and keeps each one simple. A
credit with no expiry can accumulate indefinitely if an admin never
fulfils it — acceptable for now since fulfilling is a fast one-click
action and the alternative (auto-expiry) has no policy anyone asked for.
Switching a student's fee plan mid-period (existing limitation, unrelated
to this change) still only affects the *next* generated period, so a
per-class plan assigned to a long-enrolled student may generate nothing
until their next period boundary — same behavior a cycle-amount plan
change already has.

---

## 2026-09-15 — Batch-scoped fee plans + admin-triggered fee reminders

**Decision:** Added an optional `fee_plans.batch_id` (null = academy-wide,
today's only behavior; non-null = scoped to one batch) so a batch that
meets less often can be priced differently, without touching how billing
is actually computed — `generate_upcoming_fees()` still bills off the
explicit `students.fee_plan_id` assignment, `batch_id` only filters the
plan picker. Added `send_fee_reminders(fee_ids[])`, an admin-triggered
button (per-row and bulk) that inserts one `notifications` row per linked
parent for each selected unpaid fee, reusing the existing notifications
pipeline exactly the way `session_cancelled` already does — no new
delivery mechanism. Also added an "Overdue" quick filter on the admin
Fees screen that clears the month filter (the `student_fees_list()` RPC
already supported an unfiltered month; the gap was the UI never exposed
"show me everything overdue, not just this month" as one click).

**Options considered:**
1. *Fee-plan scoping* — (a) `fee_plans.batch_id`, optional, additive
   (chosen); (b) derive a student's fee automatically from their batch,
   removing the explicit per-student plan assignment.
2. *Reminders* — (a) admin clicks a button, in-app notification only
   (chosen); (b) a scheduled daily job, like the existing `generate-fees`
   Edge Function; (c) both; (d) also send SMS/WhatsApp/email.

**Why:** 1a keeps billing unambiguous for a student enrolled in more than
one batch (the plan assignment stays an explicit admin choice, just
guided by batch) and is a strictly additive schema change — every
existing plan and every existing student's billing is untouched. 1b was
rejected because it would have made "which plan bills this student"
implicit and required new conflict-resolution logic for multi-batch
students, for a use case (per-batch *pricing*, not per-batch *auto-
assignment*) the admin didn't ask for. 2a was the user's explicit choice
over a chat conversation — full control over timing, no risk of feeling
naggy, and no new scheduled infrastructure to build/maintain. 2d was
explicitly declined — the app has no SMS/WhatsApp/email integration
today, and adding one is a separate, materially larger project.

**Trade-offs:**
- No automatic reminders. If the admin forgets to click Remind, nothing
  is sent — the `last_reminded_at` timestamp shown per row is the only
  safeguard against re-reminding blindly. A scheduled version (mirroring
  `generate-fees`'s Edge Function + cron pattern, see RUNBOOK) is a
  natural follow-up if the admin wants it later.
- In-app only. A parent who doesn't have the app open won't see a
  reminder until they next open it — there's no push notification,
  SMS, or email fallback today.
- A batch can have any number of scoped fee plans (no uniqueness
  constraint beyond the existing `unique(academy_id, name)`) — same
  "no default plan" shape academy-wide plans already have. If the admin
  wants exactly-one-plan-per-batch enforced later, that's a new
  constraint to add, not something this change assumes.

## 2026-09-15 — Full UI redesign to "Kinetic Obsidian", dark-only, restyle-only scope

**Decision:** Reskinned the entire app to match a new dark design system
("Kinetic Obsidian", Stitch mockups at `docs/design/latest stitch/`),
executed as a token-level and class-level restyle across every screen —
no changes to `api/`, `hooks/`, Zod schemas, or mutation logic anywhere.
Delivered in 15 reviewable stages (design foundation → shared UI →
layouts → one feature at a time → parent screens → final QA), each
verified live against real seeded Supabase data before moving on.

**Options considered:**
(a) Dark-only, replacing the light theme's CSS variables directly — no
`.dark` block, no toggle.
(b) Keep the existing light theme as default and add dark as an
optional `next-themes` toggle.
(c) Restyle only real, working screens vs. also building the new
functionality some mockups implied (UPI QR payments, autopay, coach
voice-note debriefs, in-app late/leave request flow).

**Why:** (a) — dark-only was chosen by the user; it's also simpler to
build and verify since there's exactly one palette to get right, and
`next-themes` was already an unused dependency doing nothing (confirmed
during research: no `ThemeProvider` was ever mounted). (c) — restyle
only was chosen by the user; those mockup elements have no backend
today and building them would have turned a UI project into a mixed
UI+feature project with materially larger scope (new tables, new RPCs,
new business rules).

**Trade-offs:**
- No light mode exists any more. If a future request wants one, it's a
  second `--variable` set plus a toggle from scratch, not a flip of a
  flag — `next-themes` would need real wiring at that point.
- **Mockup ideas intentionally not implemented** (kept here as a
  reference so they aren't rediscovered from scratch, not as a
  commitment to build them): UPI QR code fee payment + "compare fee
  tiers" self-service switching (`prsa_fees_payments`), autopay toggle,
  coach voice-note debrief player (`prsa_skill_mastery_progress`),
  in-app "I'll be late" / "Request leave" parent flow with toast
  confirmation (`prsa_schedule_attendance`), and a vertical
  certification-timeline component for achievement history (visual
  polish only, no functional gap).
- `DevLayout` (`/dev/*`, `super_admin`-only) was left untouched — it's
  already dark, already visually distinct by design (see the Dev
  Console reference in the removed ARCHITECTURE.md section this entry
  supersedes), and every screen behind it is a `PlaceholderPage`, so
  there was nothing real to verify a restyle against.
- A real bug was caught and fixed as a side effect, not a new decision:
  `MarkAttendancePage`'s "Confirm attendance" button and
  `SkillAssessmentPanel`'s "Promote" button both keyed off the
  Tailwind `brand` color ramp for their positive/success styling. That
  ramp's *hue* changed from orange to coral as part of this redesign
  (its semantic role — error/destructive — did not), which would have
  made both buttons render alarmingly red on a successful, complete
  action. Fixed by pointing them at `primary`/the `brand` *button
  variant* (which itself was remapped to `success`) instead of the raw
  `brand-*` classes.

## 2026-09-15 — Coach account removal goes through an Edge Function, not a table delete

**Decision:** "Remove coach" calls a new `delete-user` Edge Function
(service-role only) that runs `auth.admin.deleteUser(profile_id)`,
instead of `useDeleteCoach` doing a plain `supabase.from('coaches').delete()`.

**Options considered:** (a) delete only the `coaches` row directly from
the client — simple, no new server code; (b) delete the underlying
`auth.users` account via the Admin API, mirroring how `invite-user`
already creates accounts.

**Why:** `coaches.profile_id references profiles(id) on delete cascade`,
and `profiles.id references auth.users(id) on delete cascade` — but only
in that direction. Deleting just the `coaches` row leaves `profiles` and
the `auth.users` login completely intact: the account could still sign
in, just land on a broken, coach-less experience. The point of "Remove
coach" is to fully undo a mistake, including revoking the login, so it
has to delete the account itself; that cascades back down through
`profiles` to `coaches` automatically. This also matches the existing
`invite-user` pattern (service-role Edge Function, caller verified as an
`academy_admin` acting only within their own academy) rather than
inventing a second way to do privileged account operations.

**Trade-offs:** One more Edge Function to deploy and keep in sync
(RUNBOOK.md lists it alongside `invite-user`). If a "remove" capability
is ever needed for parents or other roles, this function's role check
(`targetProfile.role !== 'coach'`) needs generalizing rather than copying.

---

## 2026-09-15 — Coach photos reuse the exact student-photos pattern; a shared hook/component replace the per-feature copies

**Decision:** `coaches.photo_url` + a private `coach-photos` bucket with
the same RLS shape as `student-photos` (0002_storage.sql), uploaded the
same way (`uploadCoachPhoto`, mirroring `uploadStudentPhoto`). The
signed-URL resolving hook that used to live in the attendance feature
(`attendance/api/studentPhotos.ts`, used only by `MarkAttendancePage`)
moved to `shared/lib/signedPhotoUrls.ts` as a bucket-agnostic
`useSignedPhotoUrls(bucket, paths)`, and every avatar-with-initials
render site was switched to a new shared `shared/ui/PersonAvatar.tsx`.

**Options considered:** (a) copy-paste a coach-specific version of the
existing student photo/avatar code; (b) extract the already-working
pattern into `shared/` once a second feature needed the identical thing.

**Why:** The photo-resolving hook was already generic in everything but
its bucket name and its home (it lived under `attendance/`, which per
the feature-isolation rule in CLAUDE.md means no other feature — not
even `students`, the feature that actually owns photos — could import
it). Needing the same capability for coaches, and wanting students'
*own* list/detail pages and the dashboard's Needs Attention panel to
finally show real photos too (they had the data — `photoUrl` — but every
render site still called a local `initials()` function and ignored it),
made six near-identical copies of the same 15 lines the wrong call.
Extracting once, now that a second real caller exists, keeps every
avatar's fallback behavior (no photo / still loading / failed fetch →
initials) identical everywhere by construction.

**Trade-offs:** `shared/ui/PersonAvatar` takes `className`/
`fallbackClassName` instead of being pre-styled, so each call site still
repeats its own sizing/color classes — deliberately, since the size and
color scheme differ enough per screen (dashboard's dark panel vs. a
table row vs. a 64px detail-page header) that baking one style in would
just move the duplication into prop overrides instead of removing it.

---

## 2026-09-15 — Batches get a real status toggle and a real delete; students still don't

**Decision:** Batches gained Deactivate/Reactivate (`batches.status`,
same binary pattern as coaches) and a hard "Remove batch" behind a
confirmation dialog that names what's destroyed. Students were
deliberately left untouched — still Archive-only, no hard delete.

**Options considered:** (a) give every entity (students, coaches,
batches) the same delete capability for consistency; (b) scope hard
delete to what's actually safe, and match each entity's existing
precedent otherwise.

**Why:** `batches.status` already existed in the schema with three
values (active/inactive/archived) but nothing in the UI ever set it —
a real gap, independent of the delete question. For delete: a batch's
`schedule_sessions` (and the `attendance` against them) and
`student_batches` enrollments are all `ON DELETE CASCADE` from
`batches`, so removing a batch **does** destroy real history — the
confirmation dialog says so explicitly, same honesty the existing Level
delete dialog already uses for cascading away student progress. A
student's cascade is far larger (attendance, fees, payments, skills,
parent links) and further from "a batch created by mistake" — archiving
was already the deliberate, safer design for students, and nothing in
this round's ask (an admin unable to delete *a coach*) argued for
revisiting that.

**Trade-offs:** An admin who deletes a batch with real session history
loses it permanently, same risk profile the app already accepted for
levels. If that turns out to be too easy to do by accident, the next
step would be disabling (not just warning on) delete once a batch has
any completed sessions — not attempted here since it wasn't asked for.

---

## 2026-09-15 — Scroll-shadow affordance for overflowing tables, instead of restructuring every table for mobile

**Decision:** Every horizontally-scrollable table/grid in the app (the
shared `Table` component, the schedule week grid, the reports table
wrapper, and the shared tabs list) gets a `.scroll-shadow-x` utility
class (defined once in `index.css`) — a CSS-only edge shadow that
shows while there's more content to scroll to, using the classic
`background-attachment: local, scroll` trick, no JavaScript.

**Options considered:** (a) leave tables as plain `overflow-x-auto`
with no visual hint that they scroll; (b) restructure every table into
a stacked card layout below a breakpoint, the way the parent app's
Attendance history already does; (c) a CSS-only scroll-shadow on the
existing table markup.

**Why:** A table that's wider than the screen but gives no visual hint
that it scrolls looks broken, not scrollable — this is what was behind
several "the table just doesn't fit" reports. Restructuring every
admin list/report table into cards (option b) would have been the more
thorough mobile treatment, but it's a much larger change across many
features for a phase whose scope was auditing and fixing, not
redesigning; the parent app's own history views already use that card
pattern where a table would have been genuinely unusable (see the
per-skater attendance-marking fix below). The scroll-shadow is a
one-file, zero-JS fix that makes every existing table's real
scrollability visible without changing any table's markup or data.

**Trade-offs:** Wide tables (Fees, Reports, weekly Schedule) still
require horizontal scrolling on a phone — the shadow makes that
discoverable, it doesn't remove the scrolling itself. If a specific
table's mobile experience still feels cramped, restructuring that one
table into a card list (as was done for the Attendance per-skater
marking rows, which needed direct interaction and couldn't rely on
just scrolling) is the next step, not a blanket rule.

---

## 2026-09-15 — Attendance marking rows rebuilt as flex layouts instead of a table, on mobile

**Decision:** The per-session row on the admin Attendance "By date" tab,
and the per-skater roster row inside it (name, status badge, override
dropdown), were rebuilt from a fixed-height single-line layout (and a
3-column `Table`, for the roster) into flex layouts that wrap onto
their own lines.

**Options considered:** (a) leave the fixed-height/fixed-width layout
and rely on the new scroll-shadow for discoverability; (b) rebuild as
a layout that never needs horizontal scrolling.

**Why:** Unlike a read-only report table, marking attendance is a
direct per-row action (tap a status). Losing sight of *whose* row
you're editing while scrolling sideways to reach the dropdown is a
real usability problem, not just a discoverability one — this was the
cause of the batch name visually overlapping the time and the "marked"
count on a phone. Scrolling is the right trade-off for a report you
mostly read; it's the wrong one for a control you're actively using.

**Trade-offs:** None significant — the change is purely layout
(flex-wrap instead of a table/fixed-width row); no data, props, or
interaction logic changed.

---

## 2026-09-15 — PDF export libraries are dynamically imported, never at module scope

**Decision:** `shared/lib/pdf.ts`'s two exported functions each
`import('jspdf')` / `import('jspdf-autotable')` / `import('html2canvas')`
inside the function body, not as top-of-file imports.

**Options considered:** (a) normal static imports, simplest code; (b)
dynamic `import()` inside each export function.

**Why:** jsPDF + html2canvas + jspdf-autotable together are roughly
600KB minified. A static import pulls them into whatever chunk
references `pdf.ts`, which — since the Dashboard and Reports pages both
import it directly — means every visitor downloads the whole PDF
toolchain on page load whether or not they ever click an export button.
Confirmed by measurement: the main bundle dropped from 2.23MB to 1.60MB
(gzip 650KB → 461KB) switching to dynamic imports, with zero change to
when or how export actually runs (Vite/Rollup code-splits the dynamic
import into its own chunk automatically, fetched on first click).

**Trade-offs:** The first export click on a fresh page load has a brief
extra network fetch before the PDF starts generating (both export
buttons already show a pending/"Exporting…" state, so this reads as
normal loading, not a stall). Every other feature keeps the "boring"
static-import default — this exception applies specifically because the
library weight is large and the usage is optional/occasional, not
because dynamic imports are the new default policy.

---

## 2026-09-14 — Partial payments use balance math, not a fifth fee status

**Decision:** `student_fees.status` stays the original four values
(pending/paid/overdue/waived). A partial payment is fully recorded in
`payments` and reflected in the computed balance everywhere it's shown;
status only flips to `paid` once payments sum to the full amount.

**Options considered:** (a) add a `partial` status, flipped on the first
payment; (b) leave status alone and derive "how much is left" from
`payments` at read time.

**Why:** A `partial` status doesn't actually carry more information than
`amount - sum(payments)` already does, and it opens a bug class: does a
second partial payment reaching 100% need explicit code to flip
`partial → paid`, and does an admin correcting an over-recorded payment
need code to flip back? (b) has one rule ("paid once fully covered") that
both the generation RPC and the UI apply identically, instead of a status
machine with more states than the business actually needed.

**Trade-offs:** Every screen showing a fee's status must also fetch/sum
its payments to show the balance correctly (`student_fees_list()` and
`useStudentFees()` both pre-compute this so no screen does it by hand).
A quick "show me all partially-paid fees" filter isn't a single `WHERE
status = 'partial'` — it's `WHERE status IN ('pending','overdue') AND
paid > 0`, which the admin fee list doesn't currently expose as a filter
(revisit if it's asked for).

---

## 2026-09-14 — One fee RPC serves both the admin's manual trigger and the scheduled job

**Decision:** `generate_upcoming_fees(p_academy_id default null)` and
`mark_fees_overdue()` are both `SECURITY INVOKER` with no internal
academy check. The admin's "Generate now" button calls the first with
their own `academy_id`; the scheduled Edge Function calls both with the
service-role key and no academy filter.

**Options considered:** (a) two separate functions — one `SECURITY
DEFINER` for the cron path with its own academy-loop, one plain one for
the admin button; (b) one function, relying on RLS to scope the admin
path and the service-role key's RLS bypass to cover every academy for
the cron path.

**Why:** (b) means the generation *logic* — which students are eligible,
what period comes next — exists in exactly one place, so a future rule
change can't accidentally diverge between "admin clicks a button" and
"the nightly job runs". The two callers differ only in *auth context*,
which RLS already exists to handle; writing a second function to
re-implement that would just be duplicating what Postgres does for free.

**Trade-offs:** Anyone reading `generate_upcoming_fees()` in isolation
might assume it's always academy-scoped, since there's no visible check
— the DATA-MODEL.md entry and the function's own comment exist
specifically to make the dual-purpose design discoverable. The
scheduling step itself (wiring an actual cron trigger to the Edge
Function) is a one-time manual step in the Supabase Dashboard or a SQL
snippet the user fills in with their own key — see RUNBOOK.md — rather
than something this migration can set up unattended, since that would
require embedding a service-role key in a committed file.

---

## 2026-09-14 — Skill promotion is a SECURITY DEFINER RPC, not a wider RLS policy

**Decision:** `promote_student()` runs as SECURITY DEFINER and re-checks
the caller's role and academy internally, rather than adding a coach
UPDATE policy on `students`. Reordering (`reorder_levels`/`reorder_skills`)
and the two admin reports stay SECURITY INVOKER, relying entirely on the
existing `levels`/`skills` RLS.

**Options considered:** (a) add a narrow coach UPDATE policy on `students`
restricted to `current_level_id`; (b) a SECURITY DEFINER function that
re-validates permission and the "all skills achieved" business rule
before writing.

**Why:** Postgres RLS can't restrict an UPDATE to one column — a coach
policy on `students` would, in practice, let a coach's client update any
column on any student row in their academy (student status, medical
notes, emergency contact) as long as the request also touched
`current_level_id`, unless every other column were pinned to its old
value in the policy's WITH CHECK, which is fragile and easy to break in
a later migration. A SECURITY DEFINER function with an explicit
permission check and an explicit single UPDATE statement has no such
surface — it can only ever do the one thing it's written to do.

**Trade-offs:** Business logic (the promotion gate) now lives in SQL
instead of RLS+app code, which is less visible than a policy — the
DATA-MODEL.md entry exists specifically to make it discoverable. The
existing `audit_students` trigger still fires (it's a normal UPDATE
inside the function), so promotions are still in the audit trail with no
extra code.

---

## 2026-09-14 — Design system is applied by retuning shadcn class strings, not by wrapping every primitive

**Decision:** The class strings inside `src/shared/ui/*` (button, input,
textarea, select, table, tabs, card, dialog, alert-dialog, skeleton,
sonner) are edited to match the handoff in `docs/design/handoff/…` —
48px inputs with 1.5px neutral borders, ink primary buttons, red-outline
destructive, underline tabs, bottom-sheet dialogs under `sm`, shimmer
skeletons, ink-filled toasts. Component structure, props, and behaviour
stay exactly as generated by shadcn.

**Options considered:** (a) leave shadcn defaults and override with
`className` at every call site; (b) wrap every primitive in a
`shared/ui/Skating*` component; (c) edit the class strings in place.

**Why:** (a) scatters the design across hundreds of call sites and drifts
immediately; (b) doubles the component surface for no behavioural gain;
(c) keeps one source of truth per primitive and every feature gets the
look for free. The CLAUDE.md "don't hand-edit" rule was about variant
*logic* and props — it now says so explicitly.

**Trade-offs:** Re-running `npx shadcn add <component>` would overwrite
the tuning — re-apply from git history if that ever happens. Layouts
that need more than a primitive (the admin sidebar, dev console rail,
EmptyState, StatusBadge) are still separate components.

---

## 2026-09-14 — Announcement fan-out is lazy (on feed load), not a cron job

**Decision:** `publish_due_announcements()` creates notification rows for
every due, un-notified announcement in the caller's academy. The app calls
it right after an admin publishes and at the top of every feed/admin-list
load. `notified_at` makes it exactly-once.

**Options considered:** (a) Fan out in the client at creation time — but
then a *scheduled* post would have to be fanned out by whoever's browser
happens to be open at the right moment, or not at all; (b) `pg_cron`
every minute.

**Why:** (b) needs the extension enabled per project and a variant of the
function that loops academies; it's documented in RUNBOOK.md as the
upgrade path. The lazy call costs one cheap indexed query per feed load
and needs no infrastructure. For an academy whose parents open the app
daily, "goes out when someone next opens the app" is indistinguishable
from a cron for a message scheduled for the morning.

**Trade-offs:** A scheduled post could be late by however long nobody
opens the app. The function is `SECURITY DEFINER` (it writes rows for
other users) but scoped to the caller's academy and to posts an admin
already published — it can't be used to send anything new.

## 2026-09-14 — TanStack Query runs in `networkMode: 'always'`

**Decision:** Queries and mutations don't pause when the browser reports
offline; they attempt the request and fail normally.

**Why:** The default mode leaves a query at `status: 'pending'` with
`fetchStatus: 'paused'` — no error, no data — which every list screen
renders as "nothing here yet". That's actively misleading on rink wifi,
where a parent would rather see "couldn't load, try again". The one write
that must survive offline (attendance) has its own persisted queue.

**Trade-offs:** Requests made while genuinely offline fail immediately
instead of waiting for reconnect; TanStack's `retry: 1` softens that.

## 2026-09-14 — Read state comes from the reader's own notification row

**Decision:** "Unread" for an announcement means "this user has a
`notifications` row for it with `read_at is null`". The feed joins the
two; marking read updates that row. There is no separate
`announcement_reads` table.

**Why:** The notification row already exists per recipient and the
unread nav badge already counts `read_at is null` across all types, so
one mechanism serves cancelled-session notices and announcements alike.
A post someone can *see* but wasn't *notified* about (published before
they joined) simply has no dot — correct, and free.

## 2026-09-14 — Attendance saves are queued locally first, then synced

**Decision:** Confirm on the coach's attendance screen writes the marks to
a persisted Zustand store (`localStorage`) and returns immediately; a
background loop pushes each queued session to the `save_attendance` RPC
and retries on reconnect and every 20 s until the server confirms.

**Options considered:** (a) A normal mutation with TanStack Query's
`retry` — retries a few times, then the marks are gone if the tab closes;
(b) full offline-first with a service worker and IndexedDB.

**Why:** The brief is a rink with flaky wifi. (a) loses data exactly when
it matters. (b) is the right long-term shape for Phase 4 (native shells)
but is a lot of machinery for one screen today. A tiny persisted queue
gets the important property — *a confirmed save is never lost* — with
~60 lines, and the UI can honestly say "saved on this device".

**Trade-offs:** Zustand now holds something more than trivial UI state
(still client-only, not a server cache — the rule in CLAUDE.md holds). A
permanently rejected save (e.g. synced after the 24 h lock) sits in the
queue with its error; a discard control is a known gap.

## 2026-09-14 — The 24-hour lock lives in RLS, in the academy's timezone

**Decision:** `session_is_editable()` is the single source of truth,
called from the coach `attendance` policies; the UI only mirrors it. It
converts the session's date/time using `academies.settings->>'timezone'`.

**Options considered:** Checking the window in the app only; comparing
against `now()` in server time.

**Why:** A client-only check is trivially bypassed and drifts. Server
time is UTC — for a Kolkata evening session that silently adds 5½ hours
to the window. Reading the academy's own timezone setting makes the rule
mean what the admin thinks it means, per academy.

**Trade-offs:** The function is `SECURITY DEFINER` so it can read
`academies.settings` for the session's academy regardless of the caller;
it only returns a boolean, so nothing leaks.

## 2026-09-14 — One attendance rule, implemented twice, tested once

**Decision:** `features/attendance/hooks/attendancePct.ts` re-implements
the SQL views' percentage rule in TypeScript (for the parent's monthly
summary and the "by student" admin view, where per-month grouping is
easier client-side), with unit tests that pin the exact numbers.

**Why:** The parent must see the same number the admin's roster shows.
The tests encode the view definition (`(present+late)/(present+absent+late)`,
excused excluded, one decimal, null when nothing counts) so a future
change to either side is caught.

**Trade-offs:** Two implementations to keep in step. If a third consumer
appears, promote the per-month grouping to a view and delete the TS copy.

## 2026-09-14 — Schedule generation and cancellation are Postgres functions, not client loops

**Decision:** `generate_sessions()` and `cancel_session()` live in
`0003_scheduling.sql` and the app calls them via `supabase.rpc()`.

**Options considered:** Computing the dates in the browser and bulk
inserting; cancelling with an `update` then a separate `insert` into
notifications from the client.

**Why:** Generation needs three checks per day (holiday, already exists,
coach overlap) against *current* data — done client-side that's several
round trips per batch and a race if two admins generate at once. In one
function it's a single transaction. Cancel-and-notify must be atomic: a
cancelled session with no notifications, or notifications for a session
that failed to cancel, are both worse than either failing outright. Both
functions are `SECURITY INVOKER`, so they add no new privilege — RLS on
the underlying tables still decides.

**Trade-offs:** Business logic in SQL is less visible to a JS-only
reader; both functions are short and documented in DATA-MODEL.md. The
return shape of `generate_sessions` (one row per day with an outcome)
exists precisely so the UI can explain what it skipped and why.

## 2026-09-14 — Sessions own their time; editing a batch is opt-in for future sessions

**Decision:** `schedule_sessions` stores `start_time`, `end_time` and
`coach_id` per row (copied from the batch at generation). Editing a
batch changes the rule only; a checkbox on the edit form optionally moves
future *scheduled* sessions to match. Completed/cancelled sessions are
never touched.

**Options considered:** (a) Sessions reference the batch's time at read
time (no per-session copy); (b) always rewrite future sessions on edit.

**Why:** (a) rewrites history — a session that happened at 5 PM would
retroactively display as 6 PM after a batch change, and attendance
records would look wrong. (b) surprises admins who changed a batch for
next term but had already told parents this week's times. Explicit
opt-in with a clear label is the boring, safe option.

**Trade-offs:** Removing a day from `days_of_week` leaves sessions on
that day in place; the admin cancels them. Documented in the feature doc.

## 2026-09-14 — Holidays affect generation only, never existing sessions

**Decision:** Adding a holiday doesn't cancel sessions already on that
date; extra (one-off) sessions may be placed on a holiday.

**Why:** Cancelling notifies parents with a reason — that should be a
deliberate act per session, not a side effect of a calendar entry. And
a holiday is exactly when an academy might run a special extra session.

## 2026-09-14 — Dates are local `YYYY-MM-DD` strings, never `toISOString()`

**Decision:** `shared/lib/format.ts` (`todayIso`, `addDays`, `toIsoDate`)
builds dates from local `getFullYear/getMonth/getDate`; the first pass at
this feature used `new Date().toISOString().slice(0, 10)` and was fixed.

**Why:** `toISOString()` is UTC. In IST (UTC+5:30), from 18:30 local
onward it returns *tomorrow's* date — "today's sessions" would be wrong
every evening, exactly when evening batches run.

## 2026-09-14 — Batch colour on the calendar is hashed from the batch id

**Decision:** `schedule/hooks/batchColor.ts` picks one of six design-
system ramps by hashing the batch id, rather than storing a colour column.

**Why:** No schema change, stable across reloads and weeks, no UI to
manage. Six batches → six colours; a seventh wraps. Acceptable until an
academy has enough batches that collisions bother someone — then add a
`color` column and keep this as the fallback.

## 2026-09-14 — Account creation goes through an Edge Function, never the browser

**Decision:** New parent and coach accounts are created by
`supabase/functions/invite-user`, which runs with the service-role key
server-side. The frontend only ever calls it via
`supabase.functions.invoke` (wrapped in `shared/lib/invokeFunction`).

**Options considered:** (a) Ship the service-role key to the browser and
call `auth.admin.inviteUserByEmail` from the app; (b) Have the admin
create the login manually in the Supabase dashboard and only link it in
the app; (c) An Edge Function.

**Why:** (a) is a hard no — the service-role key bypasses every RLS policy
in the database; anyone who opens DevTools would own every academy's
data. (b) doesn't meet the "creates their account and sends an invite"
requirement and is a bad admin experience. (c) is the only option that is
both secure and one-click: the function verifies the *caller's* JWT is an
`academy_admin` before doing anything privileged, so the endpoint can't be
abused even though it's publicly reachable.

**Trade-offs:** One more thing to deploy (`supabase functions deploy`),
documented in RUNBOOK.md. It runs on Deno, so it lives outside the app's
tsconfig/ESLint (excluded in `eslint.config.js`). One function handles
both roles rather than two near-identical ones — simpler to deploy and
reason about.

## 2026-09-14 — Student photos in a private bucket, path stored, signed URL at display time

**Decision:** `student-photos` is a private Storage bucket;
`students.photo_url` holds the object path (`<academy>/<student>/photo.ext`),
and the app resolves it to a 1-hour signed URL when rendering.

**Options considered:** A public bucket storing the permanent public URL
(simpler — one field, no signing step).

**Why:** These are photos of children. A public bucket means anyone with
the URL can view them forever, and URLs leak (screenshots, shared links,
browser history). A private bucket with folder-per-academy RLS means the
same tenancy rules as the tables apply to photos.

**Trade-offs:** One extra call per displayed photo (cheap, cacheable). The
avatar currently shows initials and the signed-URL resolver isn't wired
in yet — noted in the students feature doc.

## 2026-09-14 — Flat parent-link schema instead of a Zod discriminated union

**Decision:** `ParentLinkSchema` in `features/students/types.ts` is one
flat object with a `mode` field and all other fields optional; which ones
are required per mode is enforced in `.superRefine`, not the type system.

**Options considered:** `z.discriminatedUnion('mode', [Existing, New])` —
the "correct" modelling, and what I wrote first.

**Why:** react-hook-form's `Path<T>` type helper is recursive, and a
discriminated union nested inside a larger form type made TypeScript's
memory use explode during `tsc` (a known RHF + Zod interaction). The flat
shape type-checks in a fraction of the time and the runtime validation is
identical for the user.

**Trade-offs:** The API layer (`linkParent`) has to re-check the fields
it needs rather than getting narrowing for free — two explicit `if
(!x) throw` guards. Worth it for a build that finishes.

## 2026-09-14 — Students list merges four lookups client-side rather than a bespoke view

**Decision:** `api/listStudents.ts` runs one paginated query for the
student rows (with batch and level embedded via foreign keys), then four
small `.in('student_id', ids)` lookups for attendance %, latest fee,
last-active and parent name, and merges them in the query function.

**Options considered:** (a) A new Postgres view `student_roster` joining
everything, then one query; (b) One giant PostgREST embed.

**Why:** (b) isn't possible — attendance % comes from a view, and
PostgREST can't embed a view without a foreign-key relationship it can
see. (a) is cleaner long-term but means another migration and view to
maintain right now for a list of 10 rows per page; the four lookups are
each a single indexed `IN (...)` on the visible ids and run in parallel.
It still honours the real rule ("charts never aggregate raw tables"):
attendance % is read from `student_attendance_summary`, not recomputed.

**Trade-offs:** Five requests per page instead of one. If the roster page
ever feels slow, promote this to a view — the merge logic is in one
function, so the swap is local. Revisit when the dashboard (Phase 3)
adds its own roster-shaped queries anyway.

## 2026-09-14 — Design tokens applied globally; component variants left as shadcn defaults

**Decision:** The design system's palette, Archivo font and radius scale
are wired into `index.css`/`tailwind.config.js` so every shadcn component
picks them up; the raw ramps (`brand-*`, `success-*`, `warning-*`,
`info-*`) are available for spot colours. Status pills are a small
wrapper (`shared/ui/StatusBadge`) rather than edits to `badge.tsx`. Button
variants (e.g. the design's outline-style "destructive") stay as shadcn
ships them.

**Options considered:** Hand-tuning every shadcn component's variant
classes to match each hover/focus/disabled state in the mockup.

**Why:** The tokens carry ~90% of the look (ink primary, red focus ring,
12px cards, the type ramp) for zero per-component work, and CLAUDE.md
says not to hand-edit generated variant boilerplate. Coaches had no
design mockup at all, so they reuse the students screens' patterns.

**Trade-offs:** A few states are visibly "shadcn default" rather than
pixel-matched (solid red destructive button vs the design's outline
style; badge weight). Flag them if they matter and they become a
wrapper each, not a rewrite.

## 2026-09-14 — `npm run lint` runs Node with a 4 GB heap

**Decision:** The `lint` script is `node --max-old-space-size=4096
node_modules/eslint/bin/eslint.js .` rather than plain `eslint .`.

**Why:** typescript-eslint's type-aware rules load the whole program into
memory; once the students/coaches features landed, `eslint .` ran out of
heap on the development machine (which had <500 MB free at the time).
Baking the flag into the script means it works the same locally and in
CI without anyone remembering an env var. Invoking eslint's entry file
directly is what makes the flag cross-platform (a `NODE_OPTIONS=` prefix
doesn't work in Windows `cmd`).

## 2026-09-14 — react-router data router (`createBrowserRouter`) over declarative `<Routes>`

**Decision:** Route the app with `createBrowserRouter([...]) `+ `<RouterProvider>`
instead of nesting `<Routes>`/`<Route>` JSX in `App.tsx`.

**Options considered:** The classic declarative `<BrowserRouter><Routes>`
API, which is simpler for a handful of static routes.

**Why:** The data router gives every route an `errorElement` for free —
a render error in one route shows a friendly fallback there instead of
crashing routes that have nothing to do with it. Role-based route
protection also reads more clearly as its own layout route
(`<ProtectedRoute allowedRoles={[...]}>` wrapping a layout's children)
than as a wrapper component repeated in JSX at every branch.

**Trade-offs:** Slightly more indirection to read the route tree (it's a
plain array of objects in `app/routes/router.tsx`, not JSX) — acceptable
since it's one file and rarely touched once a role's routes exist.

## 2026-09-14 — Auth session state lives in a hand-written context, not TanStack Query

**Decision:** `useAuthSession` (backing `<AuthProvider>`) manages
`{ session, profile, status }` with plain `useState` + a
`supabase.auth.onAuthStateChange` subscription, not a `useQuery`.

**Options considered:** Modeling the session as a TanStack Query query
(e.g. `useQuery(['session'], ...)`), which the rest of the app's data
fetching uses.

**Why:** TanStack Query's model is "fetch on demand, refetch on
triggers"; auth session changes are **pushed** by Supabase's own
`onAuthStateChange` listener (sign-in, sign-out, token auto-refresh) —
there's nothing to poll or refetch. Forcing that through `useQuery` would
mean manually calling `queryClient.setQueryData` from inside the
subscription anyway, which is no simpler than just holding the state
directly. Profile *fetching* still goes through a plain async function
(`fetchProfile`) in `features/auth/api/`, matching the "data access
lives in `api/`" rule even though it isn't itself a `useQuery` hook.

**Trade-offs:** Auth state isn't visible in TanStack Query's devtools
alongside other server state. Acceptable — it's a single provider at the
app root, not data a feature screen fetches.

## 2026-09-14 — Distinguishing "signed out" from "session expired"

**Decision:** `useAuthSession` sets a ref flag immediately before calling
`supabase.auth.signOut()`; the `onAuthStateChange` listener only shows
the "your session expired" toast for a `SIGNED_OUT` event when that flag
is *not* set, then always clears it.

**Options considered:** Showing the expiry toast on every `SIGNED_OUT`
event.

**Why:** Supabase fires the identical `SIGNED_OUT` event whether the user
clicked "sign out" or a background token refresh failed — the SDK gives
no other way to tell them apart. Toasting "your session expired" right
after someone deliberately signs out would be confusing and wrong.

**Trade-offs:** A ref (not state) is the right tool here since setting it
must happen synchronously *before* the `signOut()` call that triggers the
listener — a state update wouldn't be committed in time. None otherwise.

## 2026-09-14 — RLS via SECURITY DEFINER helper functions, called as `(select fn())`

**Decision:** All role/tenancy checks in RLS policies go through six
`STABLE SECURITY DEFINER` helper functions (`current_user_role()`,
`current_academy_id()`, `is_super_admin()`, `is_academy_admin()`,
`is_coach()`, `is_parent()`, plus `parent_student_ids()` /
`parent_batch_ids()` for the parent role) instead of inlining a subquery
against `profiles` in every policy. Every call site wraps them as
`(select fn())` rather than calling them bare.

**Options considered:** Inlining `(select academy_id from profiles where
id = auth.uid())` directly in each policy — works, but duplicated across
~60 policies and error-prone to keep consistent. A JWT custom claim for
role/academy_id — avoids the extra table read entirely, but needs a
Postgres trigger or Edge Function to keep the claim in sync whenever a
profile's role or academy changes, which is more moving parts than this
project needs yet.

**Why:** `SECURITY DEFINER` lets the function read `profiles` without
tripping that same table's RLS (it runs as the function owner, who owns
the table and is therefore exempt from RLS on it) — this is the pattern
Supabase's own RLS performance docs recommend. Wrapping every call as
`(select fn())` turns it into an `InitPlan` that Postgres evaluates once
per statement instead of once per row; without the `select` wrapper, a
`STABLE` function can still get re-invoked per row on some query plans.

**Trade-offs:** An extra function call (cached per-statement) on every
RLS-checked query. If this ever needs to scale past caching it well,
revisit the JWT-claim approach — but don't do it preemptively.

## 2026-09-14 — Composite foreign keys `(id, academy_id)` for tenant integrity

**Decision:** Every child table's foreign key back to its parent includes
`academy_id`, e.g. `foreign key (batch_id, academy_id) references batches
(id, academy_id)`, which requires a `unique (id, academy_id)` constraint
on every parent table.

**Options considered:** A single-column FK on just the parent's `id`,
relying on RLS and application code to keep `academy_id` consistent
between a row and its parent.

**Why:** With a single-column FK, a bug in application code (or a
mistake in a future migration/seed script) could insert, say, an
`attendance` row with the wrong `academy_id` pointing at a session that
belongs to a different academy — RLS would still mostly hide the mess
from other tenants, but the data itself would be silently corrupt. The
composite FK makes that combination physically impossible to insert:
Postgres rejects it at the constraint level, before RLS is ever
evaluated. This is the standard defense-in-depth pattern for multi-tenant
Postgres schemas.

**Trade-offs:** One extra unique index per parent table, and every insert
into a child table must carry the correct `academy_id` explicitly (it
can't be inferred from the parent alone) — acceptable since the API layer
always has the current user's `academy_id` in context.

## 2026-09-14 — `ON DELETE SET NULL (column)` for single-column nulling on composite FKs

**Decision:** Where a child row should survive its optional parent being
deleted (e.g. `students.current_level_id` when a level is deleted,
`batches.coach_id` when a coach is deleted), the composite FK uses
Postgres 15's column-list form: `on delete set null (current_level_id)`
— nulling only that column, not the whole FK tuple.

**Options considered:** Plain `on delete set null` on the composite FK.

**Why:** A composite FK is `(current_level_id, academy_id)`. Plain `on
delete set null` nulls **every** column in the FK, which would try to
null `academy_id` too — but `academy_id` is `not null` on `students`, so
deleting a level would raise a constraint violation instead of quietly
detaching the student from it. The column-list form (added in Postgres
15) nulls only `current_level_id` and leaves `academy_id` untouched.

**Trade-offs:** Requires Postgres 15+ — confirmed fine, since
`supabase/config.toml` (from `supabase init`) targets major version 17
and Supabase Cloud runs 15+ on every current project.

## 2026-09-14 — `nullif()` around every attendance-percentage division

**Decision:** Every place attendance percentage is computed
(`student_attendance_summary`, `batch_attendance_summary`,
`at_risk_students`, `attendance_summary_for_range()`,
`at_risk_students_for()`) divides by `nullif(counted_sessions, 0)`, never
by the bare column — even in `at_risk_students`, where the `WHERE` clause
already has `counted_sessions >= 3` as a separate condition.

**Why:** Postgres does not guarantee that `AND` evaluates its operands
left-to-right, so `counted_sessions >= 3 AND pct < 60` does not
reliably short-circuit before the division runs — a student with 0
counted sessions in the window (all attendance rows `excused`, which
don't count either way) could hit a division-by-zero error depending on
how the planner orders the check. `nullif` removes the possibility
entirely: it returns `NULL` instead of dividing by zero, and `NULL`
compared to anything is `NULL` (not an error), which `AND` correctly
treats as excluding the row.

**Trade-offs:** None — this is strictly safer with no behavior change
for the normal case.

## 2026-09-13 — Project foundation scaffolded

**Decision:** Vite + React 18 + TypeScript (strict) + Tailwind + shadcn/ui,
with the feature-folder architecture described in CLAUDE.md, TanStack
Query for server state, Zustand for local UI state, React Hook Form +
Zod for forms, React Router for routing, Recharts for charts, Supabase
for backend, Vitest + Playwright for testing, Sentry for error tracking.

**Options considered:** Next.js was not considered — this is a
client-rendered SPA today (no SSR requirement), and Vite's dev
experience is simpler for a non-coder-led workflow. Redux/Context were
not chosen for server state — TanStack Query is a better fit since
almost all state here is Supabase data.

**Why:** Matches the stack specified for this project; each library has
one clear job so a future session (or an AI tool with no memory of past
sessions) can guess correctly which tool handles what.

**Trade-offs:** No SSR/SEO — acceptable since this is an authenticated
app, not a public marketing site. Revisit only if a public-facing
marketing/booking page (Phase 6 "Trial bookings") needs SEO.

## 2026-09-13 — React pinned to v18, not v19

**Decision:** Pin `react` and `react-dom` to `^18` even though `npm create
vite` scaffolds React 19 by default.

**Options considered:** Staying on the scaffolded React 19.

**Why:** The stack was specified as React 18; some libraries in this
ecosystem (Capacitor community plugins in particular, needed in Phase 4)
have historically lagged behind major React versions.

**Trade-offs:** Will need a deliberate upgrade decision later if a
library ends up requiring React 19.

## 2026-09-13 — jsdom pinned to v25, not the latest v26/v30

**Decision:** Use `jsdom@25` for Vitest's test environment instead of the
version npm installs by default.

**Options considered:** Latest jsdom (v30 at time of writing).

**Why:** The dev machine runs Node 20.10, and jsdom's newer versions pull
in `html-encoding-sniffer` → `@exodus/bytes`, which throws
`ERR_REQUIRE_ESM` under Node < ~20.19 due to a CJS/ESM interop bug in
that dependency chain. jsdom 25 predates that dependency and runs cleanly.

**Trade-offs:** Revisit once the dev machine's Node version is upgraded
(see the Node version note below) — newer jsdom may be preferable then.
