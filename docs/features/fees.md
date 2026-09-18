# Fee management

> Restyled to the "Kinetic Obsidian" dark theme 2026-09-15 — visual only.
> The redesign mockups showed UPI QR payment, autopay, and self-service
> plan switching; none of that was built — see docs/DECISIONS.md.
>
> Also 2026-09-15: fee plans can now be scoped to a batch, and admins can
> send an in-app fee reminder to parents with an outstanding balance. See
> the "Batch-scoped fee plans" and "Dues visibility & reminders" sections
> below, and docs/DECISIONS.md for the design rationale.
>
> Also 2026-09-15: a fee plan can now bill per class instead of a flat
> cycle amount — see "Per-class billing" below.
>
> Also 2026-09-15: any batch-scoped plan (cycle or per-class) now grants
> the student class credits, spent by booking specific upcoming sessions
> a week ahead — see docs/features/schedule.md's "Class bookings"
> section. A credit only counts once its fee is **paid** (or waived).
>
> **2026-09-16: pay-per-class is no longer billed by period.** A
> per-class skater buys classes in **top-ups** recorded by the admin; a
> top-up of at least the cycle minimum starts or renews a **term**, and
> unused classes expire when the term ends without renewal. See "Top-ups
> and terms" below. Flat-fee (cycle) plans are unchanged.

## Purpose

Manual fee tracking and payment recording — plans, generation, dues,
partial payments, waivers, and a per-student receipt history. No payment
gateway; every rupee that moves is typed in by an admin after it's been
collected some other way (cash, UPI, bank transfer, etc.).

## Screens

**Admin — setup** (`/admin/fee-plans`)
- Fee plans list: name, amount, billing cycle (monthly/quarterly/annual),
  description, a **batch badge** — "All batches" for an academy-wide
  plan, or the specific batch it's scoped to — and a **Per class** badge
  when the plan bills that way (see "Per-class billing"). Add/edit/delete.
- The form's **Pricing** toggle switches between **Cycle amount** (the
  existing flat-per-period Amount field) and **Per class** (a **Rate per
  class** field instead, and the batch picker becomes required).
- A plan is assigned to a student from their **Add/Edit student** form
  ("Fee plan" picker) — that's "assign on enrollment"; saving triggers an
  immediate `generate_upcoming_fees()` call so the first invoice appears
  right away instead of waiting for the next scheduled run. Once a batch
  is picked on that same form, plans scoped to that batch sort to the top
  of the fee-plan picker (labelled "(other batch)" for ones that aren't,
  so it's clear a mismatched plan can still be picked deliberately).

**Admin — dashboard** (`/admin/fees`)
- Three summary cards: **Collected this month** (by payment date, with
  payment count), **Pending** and **Overdue** (by due date within the
  selected month, with fee count) — see "Business rules" for why collected
  uses a different date than pending/overdue.
- Filters: month, status, batch. A table of every matching fee (student,
  batch, plan, due date, amount, balance, status) with **Record payment**,
  **Waive**, and **Remind** actions per row, and **Export CSV**.
- **Overdue quick filter** — one click sets status to overdue and clears
  the month filter, showing every outstanding fee academy-wide instead of
  one month at a time. The status/month controls disable while it's on;
  click it again to go back to manual filtering.
- Row checkboxes + a **Send reminder (N)** bulk button next to Export CSV
  — sends the same in-app reminder as the per-row action to everyone
  selected in one call. Only rows with a balance can be selected.
  Reminded rows show "Reminded N days ago" under their balance.
- **Generate now** — calls `generate_upcoming_fees()` for the admin's own
  academy on demand, for whenever you don't want to wait for the
  scheduled job.

**Admin — skater profile** (`/admin/students/:id`, "Fees" tab)
- The same receipt history as the parent screen, but with **Record
  payment** / **Waive** actions per fee period — the natural place to
  handle one student's fee without leaving their profile.
- **Void payment** (the trash icon on each payment line) — a payment is
  never deleted. Voiding asks for a reason, keeps the line on the tab
  crossed out with "Voided — <reason>" under it, and the fee's status
  and balance recalculate from what's left. If the fee stops granting
  credits the skater has already booked with, the dialog lists the
  upcoming classes that will be cancelled (newest first) and requires a
  "Cancel those bookings and notify the parent" tick before the button
  enables; the parent gets one notification with the dates. Voiding a
  top-up's payment turns the row into "Top-up · voided · ₹0" — it's
  undone, never owed.
- Each payment line shows its **receipt number** (`PRSA-2026-000012`)
  and who recorded it. The confirmation toast repeats the number.
- **Delete period** — only for a period with **no payment history at
  all** (voided included). The dialog explains this and offers no delete
  button otherwise. Also refused if it would strand booked credits. Use
  it, then **Generate now**, to replace a mis-generated unpaid period —
  though since 0018 an unpaid period re-prices itself when the plan or
  batch changes, so this is rarely needed.
- **Record payment** defaults to the balance. More than the balance is
  refused unless you tick **"Keep the extra ₹X as an advance"** — then
  the receipt shows the full amount, the extra appears on the tab as
  "₹X paid in advance", and it's applied to the next fee automatically
  (shown on that fee as an "Advance balance" line, no receipt number).
  A date in the future is refused.
- **The parent is notified of every payment** with the receipt number,
  method and what it covered — and again when an advance is applied.

**Admin — top-ups** (skater profile → Fees tab, pay-per-class skaters only)
- **Top up classes** — "the family paid for N classes". The dialog shows
  the plan's rate, the current term, and — as you type the number —
  exactly what it will do: add classes to the current term, renew it
  (next term follows on, unused classes carry forward), or start a new
  term (needs the minimum). Amount = N × rate; method/reference/notes as
  for any payment; a receipt number is issued. Each top-up appears in the
  list as "Top-up · 8 classes · valid Oct 1 – Oct 31" and can be voided.

**Admin — dashboard, "Renewals due" panel** (`/admin`)
- Skaters whose plan term ends within 7 days or has already lapsed,
  grouped monthly / quarterly / annual, with the term end, unused classes
  at risk, the parent's phone, and when they were last reminded.
  **Remind** (per row or bulk-selected) sends an in-app notification to
  the parents.

**Admin — Reports → Reconciliation** (`/admin/reports`)
- Per day: cash / UPI / card / bank / cheque / other, collected total,
  number of receipts and their number range, voided amount, advances
  applied; totals row; CSV and PDF. Voided payments and applied advances
  are never in "collected".

**Admin — skater profile → Activity tab**
- Every audit-logged change to the skater's fees, payments, bookings,
  make-ups and attendance, newest first, with who did it — "Payment added
  ₹740 · cash · PRSA-2026-000018", "Fee changed status: pending → paid",
  "Payment changed voided · void reason: — → cheque bounced".

**Parent** (`/parent/fees`, reached from the Fees card on Home)
- Current dues (amount, due date, status badge) and a receipt-style
  payment history — every fee period with its payments underneath, read
  only.

## Data touched

| Table / object                      | Read | Write | Notes                                                          |
| ------------------------------------- | ---- | ----- | ------------------------------------------------------------------ |
| `fee_plans`                           | ✓    | ✓     | admin CRUD, plain RLS-guarded table writes                         |
| `students.fee_plan_id`                | ✓    | ✓     | which plan a student is billed on; set from the student form       |
| `student_fees`                        | ✓    | (RPC) | generated by RPC; status/amount can only change through RPCs (guard trigger) |
| `payments`                            | ✓    | (RPC) | append-only; `record_payment()` / `void_payment()` are the only writers — admins have select-only RLS |
| `receipt_counters`                    |      | (RPC) | per-academy per-year receipt numbering, bumped inside `record_payment()` |
| RPC `generate_upcoming_fees`          |      | ✓     | "Generate now" button and the scheduled Edge Function              |
| RPC `mark_fees_overdue`               |      | ✓     | scheduled Edge Function only                                       |
| RPC `record_payment`                  |      | ✓     | idempotent insert + receipt number + re-derived status, one call   |
| RPC `void_payment`                    |      | ✓     | admin-only; marks a payment void with a reason, re-derives status  |
| RPC `waive_fee`                       |      | ✓     | admin-only; the Waive dialog                                       |
| RPC `delete_student_fee`               |      | ✓     | admin-only; removes a period that has no payment history            |
| RPC `record_credit_topup`             |      | ✓     | admin-only; a `kind = 'topup'` fee + its payment in one call        |
| `student_advances` / RPC `student_advance_balance` | ✓ | (RPC) | overpayments kept ahead; written by `record_payment` / `apply_student_advance` / `void_payment` |
| RPC `reconciliation_report`           | ✓    |       | Reports → Reconciliation (reports feature)                          |
| RPC `student_activity`                | ✓    |       | skater profile → Activity (students feature)                        |
| `notifications`                       |      | ✓     | `payment_recorded`, `advance_applied` written by the payment functions; `fee_due` / `renewal_due` by `run_auto_reminders` when enabled |
| RPC `credit_plan_status`              | ✓    |       | the term shown in the Top-up dialog (via the schedule feature)      |
| RPC `renewals_due` / `send_renewal_reminders` | ✓ | ✓ | dashboard "Renewals due" panel (dashboard feature)                 |
| `credit_ledger`                       |      | (auto)| grant/clawback rows follow a fee's status — see docs/features/schedule.md |
| RPC `student_fees_list`               | ✓    |       | admin dashboard table + CSV export; also returns `last_reminded_at` |
| RPC `send_fee_reminders`              |      | ✓     | per-row Remind button + bulk "Send reminder"                       |
| view `monthly_collection_totals`      | ✓    |       | dashboard's "Collected this month" card only                       |
| `notifications`                       |      | ✓     | one row per parent per reminded fee, written by `send_fee_reminders` |
| `parents_students`                    | ✓    |       | resolves which parents to notify for a reminded student            |
| `fee_plans.batch_id`                  | ✓    | ✓     | optional batch scope, set from the fee plan form                   |
| `fee_plans.pricing_mode`, `.per_class_rate` | ✓ | ✓  | cycle (default) vs per-class pricing, set from the fee plan form   |
| RPC `expected_classes_from_schedule`  | ✓    |       | called by `generate_upcoming_fees` for a per-class plan's amount, and for every batch-scoped plan's `credits_granted` |
| `student_fees.credits_granted`        |      | ✓     | set by `generate_upcoming_fees`; feeds `class_credit_balance()` — see docs/features/schedule.md |
| `audit_logs`                          |      | (auto)| existing `audit_student_fees` / `audit_payments` triggers          |
| RPC `recompute_open_fees_for_plan`    |      | (auto)| fired by triggers on `fee_plans`/`batches`/`holidays` writes, never called from the UI — see "Fees stay in sync" below |
| `batches.days_of_week`                | ✓    |       | read by `recompute_open_fees_for_plan` via `expected_classes_from_schedule`, same as generation |
| `holidays`                            | ✓    |       | same — an added/removed academy holiday can change a batch-scoped plan's open fees |

## Top-ups and terms (pay-per-class)

- A per-class plan has a **rate** (₹/class) and a **billing cycle**, but
  no period fees are generated for it. Credits come only from top-ups.
- **Minimum to start or renew a term:** 8 classes (monthly), 24
  (quarterly), 96 (annual) — `academies.settings.topup_min_classes`.
- **Term rules** (`record_credit_topup()`, mirrored by `planTopup()` in
  the schedule feature, unit-tested): no term or lapsed → a top-up ≥
  minimum starts a term of one cycle from the payment date (smaller is
  refused, with the minimum and amount in the message); term active →
  ≥ minimum renews it, the next term running straight on from the
  current end; < minimum adds classes to the current term without moving
  its dates.
- **Expiry:** when the latest term ends and nothing newer has been paid,
  the nightly job writes off the remaining balance as an "Expired" line.
  Renewing before the end keeps every unused class.
- **Rate snapshot:** a top-up is priced at the rate on the day it's
  recorded; changing the plan's rate later doesn't reprice it.
- **Top-ups need the right batch.** A top-up is refused if the skater
  isn't actively enrolled in the plan's batch (the plan picker allows a
  mismatch deliberately, so this is where it's caught).
- **Flat-fee plans follow the same "one active plan" idea:** the paid
  period is the term; if the next period isn't paid by the time the
  current one ends, leftover credits expire the same way.

## Business rules

- **A ₹0 period is born paid** and its classes are usable. Because no
  money was collected, it isn't frozen: correcting the plan's amount
  later re-prices it (prorated for a part-month) and it goes back to
  pending.
- **Fees stay in sync with plan/batch changes — until they're paid.** A
  `pending`/`overdue` fee's `amount` and `credits_granted` automatically
  recalculate the instant its fee plan's rate/amount/pricing mode/batch,
  the batch's schedule, or an academy holiday changes — no need to
  delete and regenerate. A fee that's already `paid` or `waived` is
  never touched by this; that's money already collected, and it stays
  exactly as recorded (see DECISIONS, 2026-09-15). A rate change that
  suddenly fully covers a fee with an existing partial payment flips it
  straight to Paid.
- **Payments are a ledger: written once, voided never deleted.**
  (2026-09-15, audit Phase 1.) Every total — a fee's balance, "Collected
  this month", reminders, reports — sums only payments that haven't been
  voided (`fee_paid_total()` in the database, `paidTotal()` in
  `hooks/feeMath.ts`, unit-tested). Each payment carries a receipt number
  and an idempotency key, so a retried request never records twice. A
  payment can't exceed what's owed or be dated in the future.
- **Status is derived, never typed.** `paid` means live payments cover
  the amount; `overdue` means pending past due at the academy's midnight;
  `waived` means an admin waived it with a reason. The database refuses
  any other way of setting these (a trigger on `student_fees`), so no
  screen, script or table-editor edit can make a fee read Paid with
  nothing collected.
- **No "partial" status.** A fee is `pending` or `overdue` until payments
  covering its full `amount` have been recorded, at which point
  `record_payment()` flips it to `paid`. A partial payment is fully
  recorded (and shows in the balance and the payment history) but changes
  nothing about status — this is the whole mechanism for supporting
  partial payments without a fifth enum value. (`hooks/feeMath.ts`,
  unit-tested: `remainingBalance`, `isFullyPaid`.)
- **Generation runs a week ahead, never a duplicate.**
  `generate_upcoming_fees()` creates a student's *next* period once their
  current one is within `fee_generate_lead_days` (default 7) of ending —
  or immediately if they have none yet — so the bill exists before it's
  due. Never further ahead than that one period; never a duplicate
  (`unique(student_id, period_start)` is the backstop). (`hooks/feeMath.ts`:
  `nextPeriod`, `isPeriodDue`, unit-tested.)
- **Periods chain from the last one, on any plan.** The next period starts
  the day after the student's latest period — whichever plan it was on,
  including a plan that has since been deleted. Switching plans continues
  billing from where the old plan stopped; it never restarts at the join
  date. (Before 2026-09-15 it did, and that silently stopped billing —
  see DECISIONS.)
- **Stub, then calendar months.** A period that doesn't start on the 1st
  (a mid-month join, or the one-time transition from the old join-date
  scheme) runs only to the end of that month and is priced pro-rata —
  per-class plans by counting the classes in range, cycle plans as
  `monthly amount × days covered / days in month`. Every period after it
  is a full calendar month / quarter / year starting on the 1st. Already-
  generated fees keep their dates. (`hooks/feeMath.ts`: `isStubPeriod`,
  `prorateCycleAmount`, unit-tested.)
- **A fee is never overdue on the day it's created.** `due_date` is
  `fee_grace_days` (default 5) after the period starts — or after today,
  if generated late. Both day-counts are per-academy settings
  (`academies.settings`); see DATA-MODEL. (`hooks/feeMath.ts`: `dueDate`.)
- **Overdue is a one-way, pending-only flip.** `mark_fees_overdue()` only
  ever moves `pending` → `overdue`; paid and waived fees are untouched
  regardless of their due date, and a fee due *today* is not yet overdue
  — it flips starting the next day. (`hooks/feeMath.ts`: `isOverdue`,
  unit-tested.)
- **Waiving requires a reason**, is only offered while something is still
  owed (`pending`/`overdue` — not `paid`, not already `waived`), and is
  written to `audit_logs` via the existing generic trigger — no separate
  logging code. (`hooks/feeMath.ts`: `canWaive`, unit-tested.)
- **"Collected this month" and "Pending/Overdue" use different dates on
  purpose.** Collected is by *payment* date (`monthly_collection_totals`,
  a payment made this month for last month's fee still counts as
  collected this month). Pending/Overdue are by the fee's *due* date
  within the selected month (`student_fees_list`, filtered client-side
  by status) — a fee due last month that's still unpaid keeps showing up
  under last month, not this one, until it's paid or waived.
- **Per-class billing is computed upfront, from the schedule — not from
  actual sessions held.** A `per_class` plan's amount is
  `per_class_rate * expected_classes_from_schedule(batch_id, period_start,
  period_end)`, where that function counts the batch's `days_of_week`
  minus `holidays` over the period — the same weekday-counting approach
  `generate_sessions()` uses, just counting instead of inserting. This
  runs at generation time (before the period even starts), so it never
  waits to see how many sessions actually happened; if the batch's
  schedule or holidays change mid-period, only the *next* generated
  period reflects it (`billing_cycle` — monthly/quarterly/annual — still
  controls how long a period is; per-class only changes the amount
  formula, not the period length).
- **A batch-scoped plan doesn't change billing logic.** `fee_plans.batch_id`
  is purely a filter/suggestion for the plan picker — `generate_upcoming_fees()`
  still bills off the explicit `students.fee_plan_id` assignment, so a
  student in more than one batch is never ambiguous. Nothing about
  generation, payments, or the waive flow reads `batch_id` at all.
- **Reminders are admin-triggered, not automatic.** `send_fee_reminders()`
  only runs when an admin clicks Remind/Send reminder — there's no daily
  job nudging parents on its own (a deliberate scope decision, see
  DECISIONS). It reuses the exact same `notifications` delivery the app
  already uses for `session_cancelled` — one row per linked parent,
  realtime toast + unread badge — so there was nothing new to build on
  the delivery side, only the RPC that creates the rows.
- **The academy scoping trick.** Every fee RPC is `SECURITY INVOKER`.
  Called by an admin (with their session), the existing
  `student_fees_admin_all` / `payments_admin_all` policies silently
  restrict it to their own academy no matter what's passed in. Called by
  the scheduled Edge Function (service-role key, bypasses RLS), the same
  RPC covers every academy in one run. One function, two trust levels —
  see DECISIONS.

## Edge cases

- **A plan is deleted while students are on it** — `fee_plan_id` is set
  null on those students (and on their historical `student_fees` rows);
  they simply stop being billed. Nothing about already-generated fees or
  payments changes.
- **Two payments land on the same fee** (e.g. a partial then the rest) —
  each is its own row; the balance and status reflect the sum, and both
  show in the receipt history with their own date/method/reference.
- **An overpayment** — accepted as-is (no cap), and still flips the fee
  to `paid`; the balance never goes negative in the UI even though the
  raw numbers would allow it.
- **A student with no fee plan** — never appears in generation; their
  Fees tab / parent screen just shows nothing (or whatever fees existed
  before the plan was removed).
- **`generate_upcoming_fees()` called twice in a row** (e.g. the button
  clicked twice) — the second call finds every eligible student already
  has a current-or-future period and generates nothing; not an error.
- **A fee is reminded but the student has no linked parent** —
  `send_fee_reminders()` silently skips it (not an error); the returned
  count can be lower than the number of fees selected, and the toast
  reflects the actual count sent.
- **A batch used by a scoped fee plan is deleted** — the plan's `batch_id`
  is set null (`on delete set null`), so the plan survives as an
  academy-wide one rather than being deleted along with the batch.

## Known limitations

- No payment gateway — every payment is typed in after the fact.
- No refunds (money going *back* to a family) — voiding reverses a
  recording mistake, it doesn't represent cash returned. An advance /
  family balance is planned (audit Phase 3).
- No proration for a plan change mid-period — switching a student's plan
  only affects the *next* generated period.
- No per-family / multi-child combined billing — each student is billed
  independently even if siblings share a parent account.
- CSV export is exactly what's on screen (the current month/status/batch
  filter), not full history.
- No scheduled/automatic reminders — an admin has to click Remind. No
  SMS/WhatsApp/email — reminders are in-app notifications only (toast +
  badge + a link to the parent's Fees page).
- A per-class plan must be scoped to a batch (enforced by a check
  constraint) — there's no academy-wide per-class plan, since the rate
  needs one batch's schedule to price from.
- A batch can have more than one scoped fee plan (e.g. Monthly and
  Quarterly for the same batch) — there's no limit or "default" concept,
  same as academy-wide plans today.
