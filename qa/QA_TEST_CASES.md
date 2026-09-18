# QA Test Cases — PRSA Skating Academy

Cycle executed 18 Sep 2026 against the local dev build (`http://localhost:5183`, commit `4a9cd32` + working tree) using the live Supabase project. Every status below was set only after the step was actually executed in Chromium; nothing is assumed.

| Status | Count |
|---|---|
| PASS | 132 |
| FAIL | 21 |
| BLOCKED | 1 |
| NOT RUN | 33 |
| **Total** | **187** |

Evidence paths are relative to `qa/`. Defect IDs refer to `QA_EXECUTION_REPORT.md`.

## Authentication
*13 cases — PASS 11 · FAIL 0 · BLOCKED 1 · NOT RUN 1*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-AUTH-001 | App loads unauthenticated and redirects to /login | Open http://localhost:5183/ | Login page shown, URL /login | **PASS** |  |
| TC-AUTH-002 | Empty login submit shows field validation | Click Sign in with both fields empty | Inline errors for email and password | **PASS** | evidence/TC-AUTH-002_login_empty_submit_validation.png |
| TC-AUTH-003 | Malformed email rejected | Enter 'abc' as email, submit | Validation error, no request sent | **PASS** |  |
| TC-AUTH-004 | Wrong password shows generic error | admin@skating.test + wrong password | Generic 'invalid credentials' message | **PASS** | evidence/TC-AUTH-004_login_wrong_password_generic_error.png |
| TC-AUTH-005 | Unknown email shows the same generic error (no user enumeration) | nobody@skating.test + any password | Same message as TC-AUTH-004 | **PASS** |  |
| TC-AUTH-006 | Valid admin login lands on /admin | admin@skating.test / Password123! | Dashboard renders | **PASS** |  |
| TC-AUTH-007 | Session survives a page refresh | Reload /admin | Still logged in | **PASS** |  |
| TC-AUTH-008 | Logout returns to /login | Avatar menu → Sign out | URL /login | **PASS** |  |
| TC-AUTH-009 | Browser Back after logout does not expose a protected page | Logout, press Back | Redirected to /login | **PASS** |  |
| TC-AUTH-010 | Direct protected URL while logged out redirects | Open /admin/fees logged out | Redirected to /login | **PASS** |  |
| TC-AUTH-011 | Sign-out in one tab signs out the other tab | Two tabs; sign out in tab 2; act in tab 1 | Both tabs on /login | **PASS** |  |
| TC-AUTH-012 | Forgot-password / reset email flow | Request reset, open link, set password | Password changed | **NOT RUN** | Email delivery cannot be observed from the test environment; Supabase default email rate limit (BUG-007) |
| TC-AUTH-013 | Parent invite acceptance (set password from invite link) | Invite parent, open link, set password | Parent can log in | **BLOCKED** | Invite emails failed with 'email rate limit exceeded' (BUG-007) |

## Roles & data isolation
*10 cases — PASS 10 · FAIL 0 · BLOCKED 0 · NOT RUN 0*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-ROLE-001 | Coach cannot open admin routes | Login coach1, open /admin | 403 page | **PASS** | evidence/TC-ROLE-002_coach_blocked_from_admin.png |
| TC-ROLE-002 | Parent cannot open admin routes | Login parent, open /admin/fees | 403 page | **PASS** | evidence/TC-ROLE-003_parent_blocked_from_admin.png |
| TC-ROLE-003 | Super admin lands on /dev and is kept out of /admin (by design) | Login super@ | /dev renders; /admin → 403 | **PASS** |  |
| TC-ROLE-004 | Admin cannot open /dev or /coach | Login admin, open /dev then /coach | 403 page both times | **PASS** |  |
| TC-ROLE-005 | RLS: parent only sees their own children | As parent query students | Only linked children returned | **PASS** |  |
| TC-ROLE-006 | RLS: parent cannot call money RPCs | As parent call record_payment / void_payment / waive_fee / record_credit_topup | All refused | **PASS** |  |
| TC-ROLE-007 | RLS: parent cannot read audit_logs | As parent select audit_logs | Empty / denied | **PASS** |  |
| TC-ROLE-008 | Parent cannot book or cancel for an unrelated skater (RPC) | As parent call book_class_slot / cancel_class_slot with a skater not linked | 'That skater is not linked to your account' | **PASS** |  |
| TC-ROLE-009 | Parent sees only bookings for their own children | As parent select class_bookings for a session | Only own children's rows | **PASS** |  |
| TC-ROLE-010 | Coach cannot read the credit ledger | As coach call class_credit_summary | Restricted (returns zeros, no data leak) | **PASS** | Observation: returns zeros rather than an error — no coach screen relies on it |

## Students
*24 cases — PASS 15 · FAIL 7 · BLOCKED 0 · NOT RUN 2*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-STU-001 | Student list renders | Open /admin/students | Table with skaters, batches, status | **PASS** | evidence/TC-STU-001_students_list.png |
| TC-STU-002 | Search is partial and case-insensitive | Type 'pay per' | S1 pay per class found | **PASS** |  |
| TC-STU-003 | No-match search shows empty state | Type 'zzzz' | Empty state message | **PASS** |  |
| TC-STU-004 | Script tag in search is inert | Type <script>alert(1)</script> | Treated as text; no execution | **PASS** |  |
| TC-STU-005 | Search trims surrounding whitespace | Type '  PAY PER  ' | Should still find S1 | **FAIL** | BUG-002 |
| TC-STU-006 | Batch filter narrows the list | Pick Beginner | Only Beginner skaters | **PASS** |  |
| TC-STU-007 | Clear filters resets | Click clear | Full list | **PASS** |  |
| TC-STU-008 | Sort by name asc/desc | Click column header twice | Order flips | **PASS** |  |
| TC-STU-009 | Add student: empty submit shows every required-field message | Submit blank form | 8 validation messages | **PASS** |  |
| TC-STU-010 | Add student with Unicode/emoji name | Name 'QA_TEST Skater Ünïcödé 🛼' | Stored and displayed intact | **PASS** |  |
| TC-STU-011 | Whitespace-only skater name is refused | Name '   ' | Validation error | **FAIL** | BUG-004 — student '   ' was created |
| TC-STU-012 | 'Existing parent' shows a parent picker | Switch Link-to → Existing parent | Parent picker replaces new-parent fields | **FAIL** | BUG-003 — picker never appears; evidence/BUG-003_add_student_existing_parent_no_picker.png |
| TC-STU-013 | Add student is atomic when the parent invite fails | Submit with a new parent while invites are rate-limited | No student created, real error shown | **FAIL** | BUG-005 — orphan skater created, generic toast |
| TC-STU-014 | Rapid multi-click on Add student creates one skater | Triple-click submit | One record | **FAIL** | BUG-006 — three identical skaters created |
| TC-STU-015 | Parent invite email is sent | Add student with new parent | Invite delivered | **FAIL** | BUG-007 — 'email rate limit exceeded' (Supabase default SMTP) |
| TC-STU-016 | Edit student persists after reload | Edit name, save, reload | New name shown | **PASS** |  |
| TC-STU-017 | Archive dialog can be cancelled | Archive → Cancel | Student still active | **PASS** |  |
| TC-STU-018 | Archive confirms and persists | Archive → Confirm, reload | Status archived | **PASS** |  |
| TC-STU-019 | Archived student can be restored | Restore | Status active | **PASS** |  |
| TC-STU-020 | Non-existent student ID shows a not-found state | Open /admin/students/<random uuid> | Not-found message | **FAIL** | BUG-001 — permanent loading skeleton; evidence/BUG-001_student_invalid_id_endless_skeleton.png |
| TC-STU-021 | Detail tabs Overview / Attendance / Fees / Activity render | Click each tab | Content loads, no console errors | **PASS** | evidence/TC-ACT-001_student_activity_trail.png |
| TC-STU-022 | Detail tabs Progress / Notes | Click each tab | Content loads | **NOT RUN** |  |
| TC-STU-023 | Photo upload | Upload a JPG | Avatar updated | **NOT RUN** |  |
| TC-STU-024 | Enroll skater from batch detail | Batch → Enroll skater → choose → Enroll | Roster shows skater; Enroll disabled until a skater is chosen | **PASS** |  |

## Fee plans
*6 cases — PASS 3 · FAIL 2 · BLOCKED 0 · NOT RUN 1*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-PLAN-001 | Create a fee plan | Add plan QA_TEST Plan | Appears in list | **PASS** |  |
| TC-PLAN-002 | Edit a fee plan | Change amount, save | Updated | **PASS** |  |
| TC-PLAN-003 | Delete a fee plan asks for confirmation | Remove → confirm | Gone from list | **PASS** |  |
| TC-PLAN-004 | Amount upper bound | Amount 99999999999999 | Validation error, dialog stays open | **FAIL** | BUG-008 — numeric overflow → generic toast; dialog closes and input is lost |
| TC-PLAN-005 | Duplicate plan name | Create plan with an existing name | Clear duplicate-name message | **FAIL** | BUG-009 — DB blocks it but toast is generic and dialog closes |
| TC-PLAN-006 | Plan/batch change re-prices open pending fees | Change plan amount with a pending fee | Pending fee amount recomputed | **NOT RUN** | Covered by unit tests for feeMath; DB trigger not exercised in this cycle |

## Fees & payments
*25 cases — PASS 19 · FAIL 3 · BLOCKED 0 · NOT RUN 3*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-FEE-001 | Fees dashboard loads with collected / pending / overdue totals | Open /admin/fees | Cards + table | **PASS** |  |
| TC-FEE-002 | Overdue quick filter and its empty state | Toggle Overdue | 'Overdue — showing all months', empty state; toggles back | **PASS** |  |
| TC-FEE-003 | Month picker switches month | Sep 2026 → Oct 2026 | Oct fees listed | **PASS** |  |
| TC-FEE-004 | Balance never displays negative | View Sep 2026 row for E2E Payments Skater | Balance ₹0 (excess is an advance) | **FAIL** | BUG-010 — shows ₹-500; evidence/BUG-010_fees_negative_balance_and_BUG-011_zero_paid_row.png |
| TC-FEE-005 | Voided top-up is not listed as a paid ₹0 fee | View Sep 2026 table / fee collection report / parent fees | Voided top-up hidden or labelled voided | **FAIL** | BUG-011 |
| TC-FEE-006 | Record a partial payment from the table row | ₹200 on ₹1,200 Oct fee | Balance ₹1,000, status Pending, receipt number issued | **PASS** |  |
| TC-FEE-007 | Overpayment is refused by default | ₹2,000 on ₹1,200 balance | 'Value must be ≤ 1200' | **PASS** |  |
| TC-FEE-008 | Overpayment allowed only with 'Keep the extra as an advance' ticked | Tick checkbox | Cap removed; copy shows ₹800 advance; receipt shows full ₹2,000 | **PASS** | Form-level check; not submitted to avoid polluting the fixture |
| TC-FEE-009 | Payment date cannot be in the future | Pick Sep 25 (today Sep 18) | 'Can't be in the future' | **PASS** |  |
| TC-FEE-010 | Zero amount refused | Amount 0 | 'Enter an amount greater than 0' | **PASS** |  |
| TC-FEE-011 | Negative amount refused | Amount -50 | Browser min=0 validation | **PASS** |  |
| TC-FEE-012 | Waive requires a reason | Waive → submit blank | 'A reason is required to waive a fee' | **PASS** |  |
| TC-FEE-013 | Waive can be cancelled | Keep fee | Fee unchanged | **PASS** |  |
| TC-FEE-014 | Export CSV for the month | Click Export CSV | fees-2026-10.csv with correct header and row | **PASS** |  |
| TC-FEE-015 | Generate now is idempotent | Click Generate now | 'Everyone is already up to date.' | **PASS** |  |
| TC-FEE-016 | Void requires a reason | Void → submit blank | 'A reason is required to void a payment' | **PASS** |  |
| TC-FEE-017 | Void keeps the receipt on record, crosses it out and re-derives the balance | Void ₹200 with reason | Row struck through with reason; balance back to ₹1,200; status Pending | **PASS** | evidence/TC-FEE-020_student_fees_tab_voided_qa_payment.png |
| TC-FEE-018 | Activity trail records payment added / voided / status changes | Student → Activity tab | Entries with who/when/what | **PASS** |  |
| TC-FEE-019 | An available advance is applied to an already-open pending fee | Skater holds ₹500 advance, Oct fee pending ₹1,200; click Generate now | Advance applied (₹700 due) or an 'Apply advance' action offered | **FAIL** | BUG-012 — stays ₹1,200 due until the nightly job; banner also shows raw ledger note 'Returned — advance application voided (e2e reset)' |
| TC-FEE-020 | Credit statement on Attendance tab matches ledger | Student → Attendance tab | Bought/spent/returned/expired totals and statement rows | **PASS** |  |
| TC-FEE-021 | Top-up dialog enforces minimum classes and multiples of the rate | Open Top-up on a per-class skater | Below-minimum refused; amount = classes × rate | **NOT RUN** | Would add real money rows to a live skater; verified during Phase 2/3 delivery, not re-executed in this cycle |
| TC-FEE-022 | A period with payment history cannot be deleted | Playwright payments.spec | Delete refused | **PASS** | Playwright e2e |
| TC-FEE-023 | Record a payment with receipt, then void it (e2e) | Playwright payments.spec | Receipt issued; void reflected | **PASS** | Playwright e2e |
| TC-FEE-024 | Remind (single) sends a notification | Click Remind | Parent notification created | **NOT RUN** |  |
| TC-FEE-025 | Bulk select + remind | Select all → remind | Notifications for each | **NOT RUN** |  |

## Coaches
*7 cases — PASS 4 · FAIL 1 · BLOCKED 0 · NOT RUN 2*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-COA-001 | Coach list renders | Open /admin/coaches | Row with batches/students/status | **PASS** |  |
| TC-COA-002 | Row opens coach detail | Click coach name | Detail with assigned batches | **PASS** | Observation: row is a clickable div, not a link (BUG-021) |
| TC-COA-003 | Add coach: empty submit shows required messages | Submit blank | Name, email, phone messages | **PASS** |  |
| TC-COA-004 | Invalid email rejected | 'not-an-email' | 'Enter a valid email address' | **PASS** |  |
| TC-COA-005 | Phone format validated | Phone 'abc' | Validation error | **FAIL** | BUG-013 — any non-empty string accepted |
| TC-COA-006 | Create coach (sends invite) | Fill valid form, submit | Coach created, invite sent | **NOT RUN** | Invite emails rate-limited (BUG-007); avoided creating a real auth user |
| TC-COA-007 | Deactivate / reactivate coach | Click Deactivate | Status inactive | **NOT RUN** |  |

## Batches
*13 cases — PASS 9 · FAIL 0 · BLOCKED 0 · NOT RUN 4*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-BAT-001 | Batch list renders | Open /admin/batches | Rows with coach, timing, days, enrolled | **PASS** |  |
| TC-BAT-002 | New batch: empty submit | Submit blank | Name, start, end, day messages | **PASS** | evidence/TC-BAT-003_new_batch_empty_validation.png |
| TC-BAT-003 | End time must be after start time | 10:00 → 09:00 | 'End time must be after start time' | **PASS** |  |
| TC-BAT-004 | Capacity 0 refused | Capacity 0 | 'Capacity must be at least 1' | **PASS** |  |
| TC-BAT-005 | Create batch | QA_TEST Batch Mon/Wed 10–11, cap 5 | Detail page opens | **PASS** |  |
| TC-BAT-006 | Generate schedule creates one session per batch day | Sep 18 – Oct 15 | 8 sessions (Mon/Wed) | **PASS** |  |
| TC-BAT-007 | Generate schedule is idempotent | Run again | '0 sessions created · 8 already existed' | **PASS** |  |
| TC-BAT-008 | Enroll skater | Choose QA_TEST Skater Edited → Enroll | 'Skater enrolled.'; 1/5 | **PASS** |  |
| TC-BAT-009 | Remove batch asks for confirmation and cascades sessions | Remove → Remove batch | Batch and its 9 sessions gone | **PASS** |  |
| TC-BAT-010 | Edit batch | Change days/time | Saved; open fees re-priced | **NOT RUN** |  |
| TC-BAT-011 | Deactivate batch | Click Deactivate | Status inactive | **NOT RUN** |  |
| TC-BAT-012 | Capacity limit enforced when full | Enroll beyond capacity | Refused | **NOT RUN** |  |
| TC-BAT-013 | Coach clash detection on generate | Two batches, same coach, same slot | Clash reported | **NOT RUN** |  |

## Schedule
*11 cases — PASS 8 · FAIL 1 · BLOCKED 0 · NOT RUN 2*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-SCH-001 | Week calendar renders with sessions and booked counts | Open /admin/schedule | 7 columns; 'Booked: N' | **PASS** | evidence/TC-SCH-001_week_calendar.png |
| TC-SCH-002 | Previous / This week / Next week | Click each | Range label updates; sessions follow | **PASS** |  |
| TC-SCH-003 | Extra session: empty submit | Submit blank | Batch, start, end messages | **PASS** |  |
| TC-SCH-004 | Extra session times default from the batch | Pick QA_TEST Batch | 10:00–11:00 prefilled | **PASS** |  |
| TC-SCH-005 | Duplicate extra session refused | Same batch/date/time as an existing one | 'That batch already has a session at this exact time.' | **PASS** |  |
| TC-SCH-006 | Extra session on a past date is refused or warned | Date Sep 10 (today Sep 18) | Refused or warning | **FAIL** | BUG-014 — accepted silently |
| TC-SCH-007 | Holiday requires name and date | Submit blank / name only | 'Name the holiday', 'Choose a date' | **PASS** |  |
| TC-SCH-008 | Add and remove a holiday | Add QA_TEST Holiday; remove | Appears; disappears | **PASS** | Observation: removal is instant with no confirm (BUG-015) |
| TC-SCH-009 | Coming up matches calendar booked counts | Open /admin/schedule/coming-up | Same per-session numbers and names | **PASS** | evidence/TC-SCH-010_coming_up_bookings.png |
| TC-SCH-010 | Cancel a session releases bookings and notifies parents | Cancel session with bookings | Bookings cancelled, credits returned, parents notified | **NOT RUN** | Would affect live bookings of real seed skaters |
| TC-SCH-011 | Schedule a make-up session | From a cancelled session | Make-up created | **NOT RUN** |  |

## Attendance (coach)
*12 cases — PASS 9 · FAIL 1 · BLOCKED 0 · NOT RUN 2*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-ATT-001 | Coach home lists today's and yesterday's open sessions | Login coach1 | Today + 'still open for changes' | **PASS** | evidence/TC-COACH-001_coach_home_mobile.png |
| TC-ATT-002 | Roster shows every enrolled skater with BOOKED / NOT BOOKED | Open today's session | Badges per row | **PASS** | evidence/TC-ATT-001_coach_mark_attendance_roster_mobile.png |
| TC-ATT-003 | Tapping present/absent updates counters | Mark S1 present, s2 absent | '3 of 7 marked · 2 present · 1 absent' | **PASS** |  |
| TC-ATT-004 | Confirm saves and persists after reload | Confirm anyway; reload | 'Attendance saved'; 3/7 marked still shown | **PASS** |  |
| TC-ATT-005 | Present on a booked class does not spend a second credit | S1 present | No new ledger row | **PASS** |  |
| TC-ATT-006 | Absent on a booked class returns the credit | s3 absent | Ledger +1 refund; available 1 → 2 | **PASS** |  |
| TC-ATT-007 | Re-marking present spends the credit again | s3 present | Ledger −1; available back to 1 | **PASS** |  |
| TC-ATT-008 | Absent on an un-booked class changes nothing | s2 absent (not booked) | No ledger row | **PASS** |  |
| TC-ATT-009 | Admin attendance page by date | Open /admin/attendance | Today's session with marked count | **PASS** |  |
| TC-ATT-010 | 'Mark all present' skips un-booked credit-plan skaters | Click Mark all present | Only booked/non-credit skaters marked | **NOT RUN** |  |
| TC-ATT-011 | Offline queue retries when back online | Go offline, mark, go online | Saved after reconnect | **NOT RUN** |  |
| TC-ATT-012 | Ledger reason text reflects attendance events | Read statement after absent / re-present | 'Marked absent' / 'Marked present' | **FAIL** | BUG-016 — reads 'Booking cancelled' / 'Attended without booking' |

## Parent
*19 cases — PASS 14 · FAIL 1 · BLOCKED 0 · NOT RUN 4*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-PAR-001 | Parent home shows next session, attendance, fees, latest news | Login ravi.bhat11 | Cards populated | **PASS** | evidence/TC-PAR-001_parent_home_mobile.png |
| TC-PAR-002 | Schedule shows credits left, term validity and 7-day booking window | Open /parent/schedule | '6 classes left to book · Valid till Oct 31'; Book only within 7 days | **PASS** | evidence/TC-PAR-010_parent_schedule_book_cancel_mobile.png |
| TC-PAR-003 | Cancel a booking returns a credit | Cancel Fri Sep 25 | 6 → 7; row shows Book | **PASS** |  |
| TC-PAR-004 | Book a class spends a credit | Book Fri Sep 25 | 7 → 6; row shows Booked/Cancel | **PASS** |  |
| TC-PAR-005 | Booking outside the window is refused (RPC) | book_class_slot for Sep 28 | 'Classes open for booking 7 days ahead — this one opens on 21 Sep' | **PASS** |  |
| TC-PAR-006 | Booking a past/completed session is refused | book_class_slot for Sep 17 | 'This session is not open for booking' | **PASS** |  |
| TC-PAR-007 | Book button hidden on today's already-marked session | View today's row | No Book/Cancel control | **PASS** |  |
| TC-PAR-008 | Fees page lists periods, top-ups, receipts and voids | Open /parent/fees | History with receipt numbers | **PASS** | evidence/TC-PAR-020_parent_fees_mobile.png |
| TC-PAR-009 | Attendance page totals match reports | Open /parent/attendance | 66.7% (2 of 3) same as admin report | **PASS** |  |
| TC-PAR-010 | Profile is prefilled | Open /parent/profile | Name 'Ravi Bhat', phone filled, 3 skaters listed | **PASS** |  |
| TC-PAR-011 | Change password: mismatch refused | Different confirm | 'Passwords do not match' | **PASS** |  |
| TC-PAR-012 | Change password: too short refused | 'abc' | 'At least 8 characters' | **PASS** |  |
| TC-PAR-013 | Save profile name/phone | Edit, Save | Persisted | **NOT RUN** |  |
| TC-PAR-014 | Child switcher | Switch to s2 | Pages update for s2 | **NOT RUN** |  |
| TC-PAR-015 | Book/cancel give feedback | Book / cancel | Toast or confirm step | **FAIL** | BUG-017 — silent; cancel is one tap with no confirm |
| TC-PAR-016 | Booking with 0 credits is refused | Skater at 0 credits taps Book | Refused with top-up hint | **NOT RUN** |  |
| TC-PAR-017 | Announcements feed shows targeted posts | Open /parent/announcements | QA_TEST Parents-only notice visible | **PASS** |  |
| TC-PAR-018 | Announcement creates a parent notification | Query notifications as parent | Row with title/body | **PASS** |  |
| TC-PAR-019 | Progress page | Open /parent/progress | Levels/skills | **NOT RUN** |  |

## Announcements
*7 cases — PASS 4 · FAIL 1 · BLOCKED 0 · NOT RUN 2*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-ANN-001 | Empty submit shows required messages | Publish blank | 'Give it a title', 'Write the announcement' | **PASS** |  |
| TC-ANN-002 | HTML in title is rendered as text | Title with <script> | Shown literally, not executed | **PASS** |  |
| TC-ANN-003 | Expiry before publish time is refused | Expires Sep 1 (past) | Validation error | **FAIL** | BUG-018 — published as 'expired'; recipients still notified |
| TC-ANN-004 | Delete asks for confirmation and removes notifications | Delete → confirm | Gone; notifications removed | **PASS** |  |
| TC-ANN-005 | Audience 'Parents' excludes coaches | Publish Parents-only | Parent sees it; coach does not (announcements + notifications) | **PASS** |  |
| TC-ANN-006 | Schedule for later | Publish = later | Not visible until time | **NOT RUN** |  |
| TC-ANN-007 | Audience 'One batch' | Pick a batch | Only that batch's parents | **NOT RUN** |  |

## Reports & dashboard
*14 cases — PASS 10 · FAIL 1 · BLOCKED 0 · NOT RUN 3*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-REP-001 | Attendance report matches parent-facing numbers | Open /admin/reports | S1 66.7%, s3 100% | **PASS** | evidence/TC-REP-001_reports_attendance.png |
| TC-REP-002 | CSV export | Click CSV | attendance-report-….csv with header + rows | **PASS** |  |
| TC-REP-003 | PDF export | Click PDF | application/pdf blob (11 KB) | **PASS** |  |
| TC-REP-004 | Fee collection tab | Click tab | Rows per fee | **PASS** | Shows the voided-top-up '₹0 · Paid' row (BUG-011) |
| TC-REP-005 | Reconciliation totals match Fees dashboard | Click tab | ₹14,240 collected, cash/UPI split, voided, advances | **PASS** | evidence/TC-REP-003_reports_reconciliation.png |
| TC-REP-006 | Student progress tab | Click tab | Rows with level/skills | **PASS** |  |
| TC-REP-007 | Coach activity tab | Click tab | Karthik Menon 4 sessions 71.4% | **PASS** |  |
| TC-REP-008 | Date range and batch filters | Change range/batch | Data filtered | **NOT RUN** |  |
| TC-DASH-001 | Dashboard KPIs and charts render without console errors | Open /admin | Cards, charts, panels | **PASS** | evidence/TC-DASH-001_admin_dashboard_desktop.png |
| TC-DASH-002 | Renewals due panel | View panel | Empty state correct (no term ends within 7 days) | **PASS** |  |
| TC-DASH-003 | Needs attention panel | View panel | Uses ≥3 counted sessions rule; s2 (1 session) correctly excluded | **PASS** | By design; copy 'Everyone's attending well' can mislead when a skater has too few sessions to count |
| TC-DASH-004 | Attendance KPI delta text | Read 'Today's attendance' card | '+N pts vs last month' | **FAIL** | BUG-020 — reads 'pts vs last month' with no number |
| TC-DASH-005 | Dashboard Export PDF | Click Export PDF | PDF produced | **NOT RUN** |  |
| TC-DASH-006 | Send renewal reminders | Renewals panel → remind | Notifications sent | **NOT RUN** | Panel empty; no skater due |

## Progression
*7 cases — PASS 4 · FAIL 1 · BLOCKED 0 · NOT RUN 2*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-PRG-001 | Progress overview renders | Open /admin/progression | Distribution chart + haven't-progressed panel | **PASS** |  |
| TC-PRG-002 | Levels page renders | Open /admin/levels | 3 levels with skill counts | **PASS** |  |
| TC-PRG-003 | Add level requires a name | Submit blank | 'Level name is required' | **PASS** |  |
| TC-PRG-004 | New level is appended at the end | Add QA_TEST Level | Position 4 (after Advanced 1) | **FAIL** | BUG-019 — inserted at position 3, before Advanced 1 |
| TC-PRG-005 | Remove level asks for confirmation | Remove → Remove level | Gone | **PASS** |  |
| TC-PRG-006 | Skills CRUD and coach 'Assess skills' | Add skill; assess | Progress recorded | **NOT RUN** |  |
| TC-PRG-007 | Drag-to-reorder levels | Drag | Order persisted | **NOT RUN** |  |

## Navigation, errors & edge cases
*7 cases — PASS 4 · FAIL 1 · BLOCKED 0 · NOT RUN 2*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-ERR-001 | Unknown route shows 404 | Open /this-route-does-not-exist | 404 page with link home | **PASS** | evidence/TC-ERR-001_404_page.png |
| TC-ERR-002 | All 15 admin routes render with no console errors | Visit each | No errors | **PASS** |  |
| TC-ERR-003 | Browser Back / Forward keep the SPA in sync | students → fees → back → forward | Correct pages | **PASS** |  |
| TC-ERR-004 | Refresh with a dialog open loses nothing and recovers | Open Add plan, type, reload | Page recovers; nothing half-saved | **PASS** |  |
| TC-ERR-005 | Server errors surface a meaningful message | Trigger overflow / duplicate / invite failure | Specific message | **FAIL** | Generic 'Could not … Please try again.' in every case (BUG-005/008/009) |
| TC-ERR-006 | Network loss during a mutation | Go offline, submit | Error + retry, no partial state | **NOT RUN** | Cannot cut the network from inside the browser pane; Playwright route-blocking not exercised |
| TC-ERR-007 | Slow API / loading states | Throttle | Skeletons then content | **NOT RUN** |  |

## UI, responsive & browsers
*8 cases — PASS 4 · FAIL 1 · BLOCKED 0 · NOT RUN 3*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-UI-001 | Mobile 375×812: no horizontal page overflow; drawer nav works | Fees, Students, Schedule, Student detail | scrollWidth == innerWidth; drawer opens/closes | **PASS** | evidence/TC-RESP-mobile_admin_fees.png, TC-RESP-mobile_admin_schedule.png |
| TC-UI-002 | Tablet 768×1024: no overflow | Dashboard, Fees | No overflow | **PASS** | evidence/TC-RESP-tablet_admin_fees.png |
| TC-UI-003 | Desktop 1280+: layout intact | All pages | Sidebar + content | **PASS** |  |
| TC-UI-004 | Coach/parent mobile-first layouts | Pixel 5 emulation | Bottom nav; readable rosters | **PASS** |  |
| TC-UI-005 | Keyboard reachability of list rows | Tab to coach row | Focusable/enter opens | **FAIL** | BUG-021 — coach rows are divs |
| TC-UI-006 | Firefox | Full smoke | Works | **NOT RUN** | Only Chromium available in this environment |
| TC-UI-007 | Edge | Full smoke | Works | **NOT RUN** | Only Chromium available |
| TC-UI-008 | Safari / iOS | Full smoke | Works | **NOT RUN** | Only Chromium available |

## Regression (automated)
*4 cases — PASS 4 · FAIL 0 · BLOCKED 0 · NOT RUN 0*

| ID | Test | Steps | Expected | Status | Notes / evidence |
|---|---|---|---|---|---|
| TC-REG-001 | TypeScript typecheck | npm run typecheck | 0 errors | **PASS** |  |
| TC-REG-002 | ESLint | npm run lint | 0 errors | **PASS** |  |
| TC-REG-003 | Unit tests (Vitest) | npx vitest run | 91 passed | **PASS** |  |
| TC-REG-004 | E2E tests (Playwright, Chromium) | PORT=5183 npx playwright test | 7 passed | **PASS** |  |

