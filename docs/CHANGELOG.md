# Changelog

Dated, plain-language entries — what changed and why, written so a
non-technical person can follow it. Newest first.

---

## 2026-09-18 — Payments & credits audit, Phase 3: receipts to parents, advances, reconciliation, activity trail, auto-reminders

- **Parents get a receipt the moment a payment is recorded** — an in-app
  notification: "Payment received — ₹4,000 · Receipt PRSA-2026-000014 ·
  Cash · 8 classes added, valid till 31 Oct 2026." (or, for a flat fee,
  the period and what's still due).
- **Overpayments are kept as an advance, never lost.** If a family pays
  more than what's owed, the payment dialog offers "Keep the extra ₹X as
  an advance". The receipt shows the full amount; the extra sits on the
  skater's Fees tab as "₹X paid in advance" and is applied automatically
  to the next fee — when it's generated, nightly, or straight away if one
  is already open. An applied advance shows on the fee as "Advance
  balance" and is never counted as new money in "Collected". Voiding an
  applied advance puts it back.
- **Reconciliation report** — a new tab under Reports: for each day, what
  came in by cash / UPI / card / bank / cheque / other, the receipt-number
  range, voided amounts and advances applied, with totals. CSV and PDF
  like the other reports. This is the sheet to check against the cash box
  and the UPI statement at month-end.
- **Activity tab on every skater profile** — who changed what, when, in
  plain language: fees added and re-priced, payments recorded and voided
  (with reasons), bookings, make-ups, attendance marks. Written by the
  database automatically; nothing here can be edited.
- **Automatic reminders (optional, off by default).** Turn on
  `auto_fee_reminders` for the academy and the nightly job reminds
  parents 3 days before a fee is due (`fee_reminder_days_before`), the day
  after it goes overdue, and when a plan term is within 7 days of ending
  or has lapsed — never more than once a week per fee or skater.

## 2026-09-17 — Payments & credits audit, Phase 2 complete: clawback with a preview, and the last guards

- **Voiding a payment that granted credits now shows the consequence
  first.** If the skater has already booked with those credits, the void
  dialog lists exactly which upcoming classes will be cancelled ("3
  upcoming bookings will be cancelled: Thu Sep 24, Fri Sep 25, Mon Sep
  28") and won't proceed until you tick "Cancel those bookings and
  notify the parent". The newest bookings go first; the parent gets one
  notification with the dates. Classes already attended are never
  undone — if those alone leave the skater short, it shows as "owes N
  classes". Deleting a waived period works the same way.
- **A voided top-up is not a debt.** Voiding the payment on a top-up
  zeroes it ("Top-up · voided · ₹0") instead of leaving a ₹4,000 overdue
  amount with Record payment and Remind buttons on it.
- **A period that costs ₹0 is created already paid**, so its classes are
  usable. If a plan is later corrected to a real amount, such a period
  re-prices and goes back to pending — "paid is frozen" only protects
  money that actually changed hands. Re-pricing now also prorates a
  part-month period correctly (it used to apply the full monthly amount).
- **Bookings open 7 days ahead, enforced by the database** (a
  per-academy setting, `booking_window_days`). Trying earlier says when
  the class opens. No cancellation cut-off was added: with attendance as
  the final word, a class you cancel late and don't attend is returned
  anyway, so a cut-off would be a rule with no effect.
- **Leaving frees your bookings.** Archiving a skater, or moving them out
  of a batch, cancels their upcoming bookings there and returns the
  credits.
- **A session with attendance recorded can't be deleted** — cancel it
  instead. (Deleting would have refunded everyone's credits and erased
  the attendance.)
- **A top-up is refused if the skater isn't enrolled in the plan's
  batch** — "This plan is for the Beginner batch, which the skater isn't
  enrolled in — fix the plan or the batch first".

## 2026-09-16 — Pay-per-class becomes top-ups; attendance is the final word on credits

The credit system is now a proper ledger, and pay-per-class works the way
the academy actually sells it.

- **Pay-per-class is bought in blocks of classes, not billed monthly.**
  No more ₹15,000 "pending" for a 30-class month. When a family pays, the
  admin records a **top-up** of N classes on the skater's Fees tab; the
  amount is N × the plan's rate and the classes are usable immediately.
  Each top-up gets a receipt number and can be voided like any payment.
- **A top-up starts or renews a plan term.** The first top-up (or a
  top-up after the plan lapsed) must be at least **8 classes on a monthly
  plan, 24 on quarterly, 96 on annual** and starts a term of one cycle.
  Renewing before the term ends extends it straight on, and unused
  classes carry forward. Smaller top-ups inside an active term just add
  classes. The dialog shows exactly what a number of classes will do
  before you record it.
- **Unused classes expire when a term ends without renewal.** The nightly
  job zeroes them, as a visible "Expired" line on the skater's statement —
  never silently.
- **Renewals due** — a new dashboard panel lists skaters whose term ends
  within 7 days or has lapsed, grouped monthly / quarterly / annual, with
  how many classes are at risk and a **Remind** button that notifies the
  parents ("plan ends 30 Sep — top up before then to carry 12 unused
  classes forward").
- **Attendance is the final word.** Marked present or late → one credit
  spent, whether or not the skater had booked (a walk-in is recorded as a
  booking). Marked absent, excused, or not marked at all when the coach
  completes the session → the booked credit is returned. Correcting a
  mark later moves the credit the other way. A walk-in with no credits
  left goes negative and the profile says "owes 2 classes" until they top
  up. Make-up credits are no longer created for skaters on a credit plan —
  the refund on absence replaces them.
- **The coach's roster shows everyone enrolled**, with a BOOKED / NOT
  BOOKED tag. "Everyone present" only pre-marks the booked skaters, so a
  no-show can't be charged by accident.
- **Coming up** — a new page off the admin Schedule listing, for the next
  7 days, every session and the skaters who've booked it by name.
- **Credit statement** on the skater's Attendance tab: every credit
  movement (added, spent, returned, expired, adjusted) with the reason and
  who did it. Admins can also adjust credits by hand, with a reason.
- Booking messages now say the real cause: "Top up first", "The plan
  ended on 31 Jul — top up to renew", "owes 2 classes from attending
  without credits".
- The parent's credits card shows the term ("Valid till Sat, Oct 31") and
  no longer offers Book on a session that's already been marked.
- End-to-end tests updated to the current UI (they still asserted the
  pre-redesign headings); all 7 pass.

## 2026-09-15 — Payments & credits audit, Phase 1: an immutable payment ledger

Every rupee ever recorded now stays visible, with its history, forever.

- **Payments are voided, never deleted.** The trash icon on a payment
  now opens a "Void" dialog that asks for a reason. The payment stays on
  the skater's Fees tab, crossed out, with the reason under it — and
  stops counting toward the fee, whose status and balance recalculate on
  their own. Every total in the app (Collected this month, balances,
  reminders, reports) ignores voided payments.
- **Every payment gets a receipt number** — `PRSA-2026-000001`,
  `-000002`, … per academy, per year, shown on the payment line and in
  the confirmation. The prefix comes from the academy name (or a
  `receipt_prefix` setting).
- **A retried request can't double-record.** If the app sends the same
  "Record payment" twice (a lost response on bad Wi-Fi, then a retry),
  the second one gets back the payment already recorded instead of
  creating another.
- **You can't record more than what's owed.** The amount field is capped
  at the balance, and the database refuses anything over it, or a date
  in the future, or a payment on a fee that's already paid.
- **A fee's status can't be typed in any more.** Paid / Pending /
  Overdue / Waived are now derived by the database from what's actually
  been paid. A raw edit — from the app, a script, or the Supabase table
  editor — is refused. Waiving goes through its own function with the
  same reason requirement as before.
- **Admins can no longer edit or delete payment rows directly** — only
  the record and void actions can write to them.
- **"Overdue" now flips at midnight in the academy's own timezone**, not
  the server's.
- **A period with any payment history can't be deleted**, even if every
  payment on it is voided — history is history. Void a wrong payment
  instead; the balance fixes itself.
- **New end-to-end test** (`tests/e2e/payments.spec.ts`) drives the real
  form: record → receipt → void → status back to pending, on a
  dedicated "E2E Payments Skater" it creates and resets for itself.

## 2026-09-15 — Payments & credits audit, Phase 0: nothing loses money or goes negative

A full audit of the fees, payments and class-credit system found four
critical problems and several serious ones. This release closes the ones
that can lose money or leave a skater with negative credits. (The audit
report lists all 22 findings and the remaining phases.)

- **Switching a skater's fee plan no longer stops their billing.** Before,
  moving a skater to a different plan (or deleting a plan and assigning a
  new one) meant no further fees were ever generated for them — the next
  period kept trying to restart at their join month, found a fee already
  there, and gave up, forever. Now the next period always continues from
  wherever their last one ended, on any plan.
- **A new fee is never born overdue.** The due date used to be the first
  day of the period, which — now that periods start on the 1st — was
  usually already in the past when the fee was created, so it showed
  "Overdue" before the parent had seen it. Now the coming period is
  generated 7 days before the current one ends, and the due date is
  5 days after the period starts (or after today, if it's created late).
  Both numbers are per-academy settings (`fee_generate_lead_days`,
  `fee_grace_days`).
- **This afternoon's calendar-month change no longer double-bills.** A
  skater whose previous period ended mid-month (the old join-date scheme)
  now gets a short "stub" period from the day after it to the end of that
  month, priced for those days only — then clean calendar months. It never
  snaps back over days already billed. The same applies to a mid-month
  join: the first fee covers join date → month end, pro-rata.
- **Two taps can't spend one credit twice.** Booking a class now locks the
  skater for the moment it takes, so two requests racing for the last
  credit queue up and the second is refused instead of both succeeding.
- **A parent with two children in one batch books for the right child.**
  The booking used to guess; it now takes the child from the page you're
  on and checks they're linked to your account.
- **Deleting a payment or a period can't leave a skater short of credits.**
  If removing it would leave them with more booked classes than credits,
  it's refused with the exact number of upcoming bookings to cancel first.
  (A skater whose balance was already negative from before this rule can
  still have unrelated periods cleaned up.)
- **A period with payments can't be deleted.** Money that was received is
  never removed as a side effect — delete each payment deliberately
  first, then the period. The dialog now says so instead of offering a
  delete button.
- **Fixed: "Delete payment" never actually worked** — a type mismatch in
  the status recalculation made every call fail. It works now, with the
  guard above.
- Booked sessions beyond the 7-day booking window now still show as
  Booked on the parent's schedule (they were hidden before).

## 2026-09-15 — Unpaid fees now stay in sync with plan and batch edits

- **Fixed: editing a batch's schedule or a fee plan's rate after a fee
  was generated didn't update that fee.** A per-class fee priced off a
  5-day batch (₹8,800) kept showing ₹8,800 even after the batch was
  changed to weekends-only — the number only made sense for a schedule
  that no longer existed.
- **Now:** any fee that's still **pending or overdue** (nothing paid, or
  not fully paid yet) automatically recalculates the moment you change
  the batch's days, the plan's rate/amount, or the academy's holidays —
  no more manual "delete and regenerate" needed for this case. A fee
  that's already **paid or waived is never touched** — that's money
  already collected under the terms it was collected under, and stays
  exactly as it was.
- If a rate change happens to fully cover a fee that already had a
  partial payment on it, the fee flips straight to Paid automatically.

## 2026-09-15 — Billing cycles now align to the calendar month

- **A skater's fee period now always runs 1st–30th/31st of the month**,
  no matter what day they joined. Before, someone joining on the 15th
  got billed Sep 15 – Oct 14, Oct 15 – Nov 14, and so on forever, tied
  to their join date. Now everyone's period lines up with the calendar
  — easier to read, and easier to match against a bank statement or a
  month-by-month report.
- This only affects periods generated from now on — fees already
  generated keep the dates they were created with, same as every other
  "generate now" change so far.

## 2026-09-15 — Admins can now delete a payment or a fee period

- **Made a mistake on a payment or a fee?** You can now delete it. Each
  payment on a skater's Fees tab has a small delete icon, and each fee
  period has a **Delete period** button. Deleting a payment recalculates
  the fee's status automatically; deleting a whole period also removes
  any payments recorded on it, so you can generate a clean replacement.
  Both ask you to confirm first and can't be undone.

## 2026-09-15 — Credits now require payment, and admins can see the balance

- **Class credits only count once the fee is paid.** A skater's period
  used to grant credits the moment it was generated, even before the fee
  was collected — now a pending or overdue fee grants zero credits, so
  booking is gated behind payment. Once the fee's marked Paid (or
  Waived), the credits appear right away.
- **Booking now says why, not just "no credits left".** If a skater's
  stuck at 0 because their fee isn't paid yet, the app says so directly
  ("Pay first" on each class, and a clear note on the credits card)
  instead of leaving the parent to guess.
- **Admins can now see a skater's credit balance too**, not just their
  bookings. The skater's profile shows a "N credits left" badge, and a
  full breakdown (granted, booked, bonus from make-up credits, available)
  on the Attendance tab. The academy-wide student list also gained a
  **Credits** column, right next to Fee status, so you can see who's
  running low without opening each profile.

## 2026-09-15 — Weekly class booking and credits, for every plan type

- **Every plan tied to a batch now works on class credits.** Whether a
  skater is on a per-class plan, a weekend plan, or a monthly/weekday
  plan, each billing period grants them a number of class credits (based
  on how many classes that batch actually holds in the period).
- **Parents book which classes they're coming to, a week at a time.**
  The skater's Schedule page now shows a credit balance ("6 of 16 classes
  left") and a Book/Cancel button on each of the coming week's classes.
  Once credits run out, booking is disabled until more are granted next
  period (or a make-up credit frees one up).
- **A missed booked class still carries forward, automatically** — same
  mechanism as today's make-up credits: if a booked class is marked
  absent, that credit comes right back, ready to book another day.
  Unused credits never expire either — if a skater doesn't use everything
  they paid for, it's still there the next time they book.
- **Coaches now see who's actually booked, not just who's enrolled** —
  the attendance screen's roster for a class follows the week's bookings
  for skaters on a booking-enabled plan (skaters on an older, non-batch
  -specific plan are unaffected and still show as before). The Schedule
  calendar also shows a "Booked: N" count on each class.

## 2026-09-15 — Make-up classes for missed sessions, and per-class billing

- **A missed class now carries forward instead of just being lost.** If a
  student personally misses a class (marked absent), they automatically
  get a "make-up owed" credit — no admin action needed. If the *academy*
  cancels a class (rain, coach unwell, etc.), an admin can click
  "Schedule make-up" on the Schedule screen to add one make-up session
  for the whole batch, and every enrolled family gets notified.
- **Parents can see it on their dashboard.** The Attendance screen now
  shows "Expected N · Attended M · K make-up class(es) owed" alongside
  the usual percentage, with a highlighted banner when something's owed.
- **Admins can see and clear it too.** A skater's profile has a new
  "Make-up credits" card (in the Attendance tab) listing what's owed,
  with a "Mark fulfilled" button once the student has attended the
  make-up. The Attendance report also gained "Expected" and "Make-up
  owed" columns, in both the on-screen table and CSV/PDF export.
- **Fee plans can now bill per class instead of a flat amount.** When
  adding or editing a fee plan, a new "Pricing" choice switches between
  the existing flat cycle amount and a per-class rate — pick a batch,
  set a rate per class, and the amount charged each period is calculated
  from how many classes that batch actually has on its weekly schedule
  (minus any holidays). Useful for a batch that meets a different number
  of times than others, like a weekend-only one.

## 2026-09-15 — Batch-priced fee plans, dues reminders, and a date-picker fix

- **Fee plans can now be tied to a specific batch.** When adding or
  editing a fee plan, there's a new "Batch" option — pick a batch (e.g.
  your weekend-only batch) to give it its own pricing, or leave it as
  "All batches" for a plan any student can be assigned to, like before.
  When adding or editing a student, once you've picked their batch, that
  batch's own plans show up first in the fee-plan list.
- **Admins can now see, and nudge, everyone with an outstanding fee.** A
  new "Overdue" button on the Fees screen shows every unpaid fee
  academy-wide in one click, instead of hunting month by month. Select
  any number of overdue rows (or use the reminder button on a single
  row) and click "Send reminder" — the parent gets a notification in the
  app pointing them straight to their Fees page, and the row shows when
  it was last reminded so nobody gets double-nagged by accident.
  Reminders are sent by the admin on demand, not automatically, and stay
  in-app only for now — no SMS or WhatsApp yet.
- **Fixed the date picker not opening.** Clicking a date field (in Fees,
  Reports, Attendance, adding a student, scheduling a session, and a few
  other places) sometimes didn't pop up a calendar at all. Every date and
  month field across the app now uses the same custom calendar popup
  instead of relying on the browser's own picker.

## 2026-09-15 — Full app redesign: new dark theme ("Kinetic Obsidian")

- **Every screen in the app was restyled** to match a new dark design —
  new colors, new fonts (Syne for headings, Plus Jakarta Sans for body
  text), a cyan/teal/coral accent palette instead of the old orange
  theme. This was a visual-only project: nothing about how any screen
  *works* changed, only how it looks.
- The app is now **dark-only** — there's no light mode any more, by
  request. It was previously light-only, so this is a full swap, not an
  added option.
- Fixed one real bug found while restyling: the coach's "Confirm
  attendance" button and the "Promote to next level" button used to
  briefly render in an alarming red when someone finished a positive
  action (all attendance marked, or a skater ready to level up). They
  now correctly show in the new positive/green color.
- The "Needs attention" panel on the dashboard, the coach's "today's
  session" card, and the parent home screen's "next session" card were
  redesigned to stand out clearly against the new dark background —
  they'd have blended into it otherwise.
- A few things shown in the new design's original mockups were
  deliberately **not** built, because they'd need real backend work, not
  just a new look: paying fees by UPI QR code, an autopay toggle,
  switching fee plans yourself, coaches leaving voice-note feedback, and
  an in-app "running late" / "requesting leave" button for parents.
  These are recorded as future ideas in `docs/DECISIONS.md`, not lost.
- `docs/design/latest stitch/` holds the design mockups this was built
  from, for reference.

## 2026-09-15 — Switched to a new Supabase project

- The app now points at a new Supabase database/project instead of the
  old one. All database tables, security rules, and storage buckets
  were recreated on the new project by re-running every migration file
  in order, so nothing needed to be manually copied over.
- The three backend functions (inviting a user, deleting a user,
  generating monthly fees) were redeployed to the new project.
- No data carries over automatically from the old project — this was a
  fresh, empty database. If there was real student/coach/fee data on
  the old project that needs to move over, that's a separate data-export
  step, not something this change did.
- The local `.env` file (not checked into git) was updated with the new
  project's web address and public API key.

## 2026-09-15 — Real photos everywhere, and full delete/remove permissions for admins

- **Coaches can now have a photo**, uploaded the same way students'
  photos already were — pick a file when adding or editing a coach.
- **Every circle that used to show only initials now shows the real
  photo when one exists** — the Skaters list, a skater's own profile
  page, the Coaches list, a coach's own profile page, and the dashboard's
  "Needs attention" panel. This was mostly a display gap: student photos
  were already being collected, they just weren't being shown anywhere
  except the attendance-marking screen.
- **Admins can now permanently remove a coach**, not just deactivate one
  — for an account added by mistake. This fully deletes their login too
  (deactivating stays the option for a coach who's just on leave or
  left on good terms; anything they were assigned to is simply left
  with no coach, nothing else changes).
- **Batches got the admin controls they were missing**: a
  Deactivate/Reactivate toggle (the field already existed but had no
  button anywhere), and a permanent Remove for a batch created by
  mistake. Removing a batch is explained clearly in a confirmation
  dialog first, since — unlike removing a coach — it does delete that
  batch's schedule and attendance history along with it.

---

## 2026-09-15 — PRSA branding, and a mobile/tablet pass across the whole app

- **Branding.** The academy is now named "Professional Roller Skating
  Academy" (PRSA) everywhere in the app — browser tab title and icon,
  the sign-in/forgot-password/reset-password screens, the admin
  sidebar, and the coach and parent headers — using the logo supplied
  by the academy.
- **Fixed a broken preview caused by the branding change.** The logo
  files were added under `src/assets/`, but the app's `@` shortcut
  (used in imports like `@/assets/prsa-logo.png`) had never been told
  that folder existed, so every page that used the new logo failed to
  load. Both places that shortcut is configured (the dev server and
  the type checker) now know about `@/assets`.
- **Fixed a real mobile layout bug on the Attendance page.** Marking
  attendance for a session showed the batch name overlapping the time
  and the "X marked" label on a phone-sized screen, because the row
  was too narrow for everything on one line. It's now two lines
  (name, then time) so nothing overlaps. The per-skater marking list
  underneath had the same problem — a name, a status, and a dropdown
  squeezed into one line, with the dropdown pushed off the edge of the
  screen. It's now a simple stacked layout that never needs sideways
  scrolling to mark a skater present.
- **Fixed the "Levels & skills" list truncating names to a single
  letter on a phone** (e.g. "Intermediate 1" showing as "I…") — there
  wasn't room for the name once every action icon was accounted for.
  The skill-count badge now only shows on tablet and larger, freeing
  enough space for the level name to display properly on a phone.
- **Fixed the from/to date pickers cutting off the second date field**
  on a phone screen, on both the Reports page and the Attendance "by
  batch"/"by student" filters (both use the same shared date-range
  control) — the two dates now wrap onto a second line instead of
  running off the edge of the screen.
- **Every data table in the app** (Skaters, Coaches, Fees, Reports,
  the weekly Schedule grid, and the tabs above them) now shows a
  subtle shadow at the edge when there's more content to scroll to
  sideways, instead of just cutting off with no hint that there's
  more — this was the case behind several "the table doesn't fit"
  reports on narrow screens.

---

## 2026-09-15 — The academy admin dashboard, and four exportable reports

Every number here reads a Postgres view or RPC function — no chart
queries a table directly.

- **Dashboard** (now the admin's landing page) — four stat cards (active
  students, today's attendance, fees collected this month, outstanding
  dues), each with a trend against last month; a date-range selector
  (3/6/12 months); six charts (attendance trend, revenue collected vs
  expected, students per batch vs capacity, skill level distribution,
  retention, coach load); and **Needs attention** — a full-width panel,
  deliberately the heaviest thing on the page, listing every skater
  under 60% attendance in the last 30 days with a tap-to-call parent
  phone number and a note about who also has an overdue fee. Every
  chart has its own loading skeleton and its own empty state — nothing
  on this page renders blank. **Export PDF** captures the whole page as
  it's currently filtered.
- **Reports** (new "Reports" screen) — attendance, fee collection,
  student progress, and coach activity, each filterable by an explicit
  date range and batch, each exportable to CSV or a proper (not
  screenshot) PDF table.

---

## 2026-09-14 — Fee management: plans, generation, and manual payment recording

No payment gateway yet — every payment is recorded by an admin after
money changes hands some other way (cash, UPI, bank transfer, etc.).

- **Setup (admin)** — a "Fee plans" screen: name, amount, billing cycle
  (monthly/quarterly/annual), description. A plan is assigned to a
  skater right from their Add/Edit form, and their first invoice is
  generated immediately rather than waiting for the nightly job.
- **Generation** — a scheduled job (a new Edge Function, `generate-fees`,
  on a daily cron once you wire it up — see the runbook) creates each
  skater's next billing period once their current one has ended, and
  flips overdue fees automatically. Admins also get a "Generate now"
  button on the Fees screen for on-demand use.
- **Admin dashboard** (`/admin/fees`) — collected this month / pending /
  overdue, each with a count and an amount; a filterable fee list
  (status, month, batch); **Record payment** (supports paying less than
  the full amount — a partial payment — with the balance carried
  forward); **Waive** a fee with a required reason (kept on record);
  per-skater payment history; **Export CSV**.
- **Parent** — a new Fees screen (via the Fees card on Home): current
  dues with a status badge, and every past fee with its payments listed
  underneath like receipts.

Also fixed while testing this: the skater Add/Edit forms' Photo field was
crashing both screens outright (a leftover from Phase 1.1) — it's a plain
label now instead of a form-managed one, since a file input was never
part of the form's own validated state.

---

## 2026-09-14 — Skill progression: the feature that isn't just attendance

Skaters now climb a real progression ladder, not just get marked present
or absent.

- **Setup (admin)** — a "Levels & skills" screen to manage the ladder:
  add, edit, delete and drag-reorder levels, and the skills inside each
  one. Seeded with a realistic 9-level beginner-to-advanced ladder (45
  skills — forward/backward skating, stops, crossovers, edges, turns,
  spins, jumps) that was already in the sample data.
- **Coach** — from a session or a skater, open skill assessment: every
  skill in the skater's current level with a one-tap status (not
  started / learning / achieved) and an optional note. **Bulk assess**
  marks one skill across a whole batch at once. **Promote** appears once
  every skill in the level is achieved, with a confirmation — the server
  double-checks that before moving anyone on.
- **Parent** — a new "Progress" tab: which level their skater is on and
  how far along the ladder that is, the current level's skills as
  colorful reward tiles (not a checklist), a locked preview of what's
  next, and a history of what was achieved, when, and by which coach.
- **Admin** — a "Progress" report: how many active skaters are on each
  level (chart), and who hasn't achieved a skill in 30/60/90 days.

---

## 2026-09-14 — Vercel hosting set up; database types refreshed

- Added `vercel.json` so Vercel serves the app correctly on every URL
  (not just the home page) and knows how to build it. The runbook now
  has a "Deploying" section listing the environment variables Vercel
  needs and the Supabase URL settings to update.
- Migrations 0002–0005 and the invite Edge Function are now live on the
  Supabase project; the generated database types were regenerated from
  it and match what the code expected.

---

## 2026-09-14 — The app now looks like the design handoff

A visual pass over everything built so far, using the design files in
`docs/design`. Nothing about *what* the app does changed.

- **Admin console shell** — black left sidebar with the academy's
  wordmark ("Glide." with a red full stop), a white pill on the current
  section, and the active-skater count at the bottom. The top bar shows
  the academy name and current section, a global "Search skaters" box
  (press Enter to jump to the filtered skater list), a bell that goes to
  announcements with an unread count, and an identity menu with sign out.
- **Developer console shell** — dark throughout, with a full-width
  environment banner (blue for development, amber for staging, red for
  production) showing the Supabase host and build, a "Skating/dev" rail
  with Overview / Academies / Error log / Feature flags / Jobs and audit,
  and a header naming the current screen. The four new sections are
  placeholders until their phases arrive.
- **Sign-in, forgot- and reset-password pages** carry the wordmark.
- **Buttons, inputs, dropdowns, tables, tabs, cards, dialogs, toasts,
  loading shimmers and empty states** all match the design system —
  taller touch targets, thicker borders, underline-style tabs, and
  dialogs that slide up from the bottom on phones.
- Empty states now have a distinct red icon when something failed to
  load versus grey when there's simply nothing yet.

---

## 2026-09-14 — The parent app, and announcements with live notifications

Parents now have a proper app, not just an attendance page. **Home**
shows their skater (a dropdown if they have more than one), the next
session in a bold card, this month's attendance percentage, whether fees
are paid or due, and the latest announcement. Tabs along the bottom go to
the full **Schedule** (upcoming sessions, cancellations shown with the
reason), **Attendance** (six months, month by month), and **News**; the
icon top-right opens the parent's own **Profile** — edit name and phone,
see the skaters linked to the account, change password, sign out — and
from there the **child's profile** (level, age, batches, coach, and the
emergency contact and medical notes the academy has on file).

Admins can now post **announcements**: a title and message, who should
see it (everyone, parents, coaches, or one batch's families and coach),
publish now or schedule for a date and time, with an optional expiry.
Publishing creates a notification for every recipient. Parents and
coaches see the posts in a feed with a red dot on anything unread, the
tab shows an unread count, and tapping a post marks it read. New
notifications arrive live — no refresh — with a small toast.

Under the hood: queries no longer silently "pause" when the browser
thinks it's offline (which showed up as empty screens); they try and
report an error instead.

**Needs doing on Supabase:** run `0005_announcements.sql`. Parent and
coach feeds show posts without it; the admin Announcements page, unread
badges, mark-as-read and live updates need it.

## 2026-09-14 — Attendance: coach marking, admin tools, parent history

The daily screen. A coach opens **Today**, taps a session and gets the
roster with big ✓ / ✗ buttons per skater. The fastest path is one tap on
**Mark all present** and then tapping only the exceptions — each tap on a
row steps present → absent → late. A counter in the dark header shows
"12 of 15 marked" with a progress bar, and the confirm button turns red
once everyone is marked. Marks can be changed for 24 hours after the
session (in the academy's own timezone), then they lock — admins can
still correct them.

Rink wifi is unreliable, so confirming never waits on the network: the
marks are saved on the phone first, the coach sees "saved on this
device", a small "1 to sync" badge appears in the header, and the app
sends them as soon as it can — on its own, retrying every 20 seconds and
whenever the connection returns. Reopening the session shows what the
coach marked, even if it hasn't reached the server yet.

Admins get an **Attendance** page: by date (expand any session and
override a skater's mark from a dropdown — every change lands in the
audit log with the admin's name), by batch (each skater's percentage
over a date range, exportable to CSV), and by student (their full
session history with percentage, also exportable).

Parents now land on their child's attendance: overall percentage for the
last six months, then each month with its own percentage, counts and
session list — the same numbers the admin sees. If they have more than
one child, a dropdown switches between them.

The percentage rule is now covered by unit tests (present and late count
as attended; excused is ignored; nothing counted shows "—", not 0%).

**Needs doing on Supabase:** run `0004_attendance.sql`. Until then
coaches' saves queue up (visibly) and sync once it's in; admin and
parent views work now.

## 2026-09-14 — Batches and the weekly schedule

Under **Batches**, the admin now sees every class with its coach, time,
days and how full it is (the enrolled count turns amber at the last two
places and red when full), can create and edit batches (name, level
range, coach, capacity, time, days, venue), and open one to see its
roster and upcoming sessions. Skaters are enrolled from the batch page
with a dropdown; if the batch is full the app warns clearly but still
lets the admin go ahead. Removing a skater keeps their history.

**Generate schedule** on a batch page turns its weekly pattern into real
sessions for a chosen date range. It's safe to run again — days that
already have a session are left alone — and it skips holidays and any
day the coach is already booked at that time, then tells you exactly how
many it created and how many it skipped and why.

Under **Schedule**, a Monday-to-Sunday calendar shows every session
colour-coded by batch with the coach and skater count, today marked,
holidays flagged, and week-by-week navigation. From here the admin can
**cancel a session** (a reason is required, and every affected parent
gets a notification with it — one per parent even if two of their
children are in the batch), **add a one-off extra session** (it refuses
if the coach would be double-booked), and maintain the **holiday list**.

Coaches now land on a **Today** screen: their sessions today as bold
cards with time, batch, venue and skater count — cancelled ones greyed
with the reason.

Two safety rules worth knowing: editing a batch's time never rewrites
sessions that already exist unless you tick "also move upcoming
scheduled sessions" (and even then, past and cancelled sessions are
left alone); and adding a holiday doesn't cancel anything already on
the calendar — you cancel those yourself so parents are told why.

**Needs doing on Supabase:** run `0003_scheduling.sql` (RUNBOOK.md).
Browsing batches, the calendar, enrolling and the coach view all work
against the existing data; generating, cancelling and holidays need the
migration.

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
