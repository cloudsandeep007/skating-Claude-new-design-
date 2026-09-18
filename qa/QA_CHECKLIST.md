# QA Checklist — PRSA Skating Academy

Cycle of 18 Sep 2026, re-tested 19 Sep after fixes. ✅ executed and passed · ✅🔧 failed on 18 Sep, fixed and passed on 19 Sep · ❌ still failing · ⛔ blocked · ⬜ not run.

## Smoke
- ✅ App loads, unauthenticated user lands on /login
- ✅ Login for super admin, academy admin, coach, parent
- ✅ All 15 admin routes render with no console errors
- ✅ 404 page for unknown routes
- ✅ Logout and protected-route redirects

## Authentication
- ✅ Empty / malformed / wrong / unknown credential handling (generic message, no enumeration)
- ✅ Session persists on refresh; cross-tab sign-out
- ⬜ Forgot-password email flow
- ⛔ Parent invite acceptance (email rate limit, BUG-007)

## Roles & isolation
- ✅ Coach, parent, admin, super admin each blocked from the other areas (403)
- ✅ RLS: parent sees only own children, own bookings; no audit logs; no money RPCs
- ✅ RPC ownership: booking/cancelling for an unrelated skater refused
- ✅ Coach cannot read the credit ledger

## Students
- ✅ List, search (partial, case-insensitive, XSS-safe), batch filter, clear, sort
- ✅🔧 Search trims whitespace (BUG-002)
- ✅ Add-student required-field validation (8 messages)
- ✅ Unicode/emoji names
- ✅🔧 Whitespace-only name refused (BUG-004)
- ✅🔧 Existing-parent picker (BUG-003)
- ✅🔧 Atomic create when invite fails (BUG-005)
- ✅🔧 Double-submit protection (BUG-006)
- ⛔ Invite email delivery (BUG-007 — SMTP provider to configure; app now refuses cleanly)
- ✅ Edit persists; archive cancel/confirm/persist; restore
- ✅🔧 Not-found state for unknown ID (BUG-001)
- ✅ Detail tabs: overview, attendance (credit statement), fees, activity
- ⬜ Progress and Notes tabs; photo upload
- ✅ Enrol from batch detail

## Fee plans
- ✅ Create, edit, delete with confirmation
- ✅🔧 Amount upper bound (BUG-008) · ✅🔧 duplicate-name message (BUG-009)
- ⬜ Plan/batch change re-prices pending fees (unit-tested only)

## Fees & payments
- ✅ Dashboard totals; month picker; overdue quick filter + empty state
- ✅ Partial payment (balance/status/receipt); overpay capped; advance opt-in; future date refused; zero/negative refused
- ✅ Waive requires reason / cancellable; void requires reason / crosses out / re-derives balance
- ✅ Export CSV; Generate now idempotent; activity trail; credit statement
- ✅ E2E: record + void; delete-period guard (Playwright)
- ✅🔧 Negative balance displayed (BUG-010) · ✅🔧 voided top-up as "₹0 · Paid" (BUG-011) · ✅🔧 advance not applied to open fee (BUG-012)
- ⬜ Top-up minimums via UI; single/bulk remind

## Coaches
- ✅ List; detail; empty-form and email validation
- ✅🔧 Phone format (BUG-013)
- ⬜ Create coach (invite); deactivate

## Batches
- ✅ List; empty validation; end-after-start; capacity ≥ 1; create
- ✅ Generate schedule (8 sessions, idempotent); enrol (button disabled until chosen); remove with cascade
- ⬜ Edit; deactivate; capacity limit; coach clash

## Schedule
- ✅ Week calendar with booked counts; prev/this/next week
- ✅ Extra session validation; batch time defaults; duplicate refused
- ✅🔧 Past-date extra session accepted (BUG-014)
- ✅ Holiday name/date validation; add; remove
- ✅🔧 Holiday remove has no confirm (BUG-015)
- ✅ "Coming up" matches calendar counts
- ⬜ Cancel session (bookings released, parents notified); make-up session

## Attendance (coach)
- ✅ Today/yesterday sessions; roster with BOOKED / NOT BOOKED
- ✅ Marking, counters, confirm, persistence after reload
- ✅ Credit rules verified in ledger: present-booked = no change; absent-booked = +1; re-present = −1; absent-unbooked = no change
- ✅🔧 Ledger reason copy (BUG-016)
- ✅ Admin attendance by date
- ⬜ "Mark all present" skip rule; offline queue

## Parent
- ✅ Home; schedule with credits, term and 7-day window; book (−1) / cancel (+1)
- ✅ Window and past-session guards (server); Book hidden on marked session
- ✅ Fees; attendance (matches report); profile prefilled; password mismatch/short refused
- ✅ Announcements feed; notification created
- ✅🔧 No feedback on book/cancel, no cancel confirm (BUG-017)
- ⬜ Save profile; child switcher; 0-credit booking; progress page

## Announcements
- ✅ Required fields; HTML inert; delete with confirm (notifications removed); Parents-only audience excludes coaches
- ✅🔧 Expiry before publish accepted (BUG-018)
- ⬜ Schedule for later; one-batch audience

## Reports & dashboard
- ✅ Attendance (matches parent page), fee collection, reconciliation (matches dashboard), student progress, coach activity
- ✅ CSV and PDF exports
- ✅ Dashboard KPIs/charts; renewals-due panel; needs-attention rule (≥3 sessions)
- ✅🔧 Attendance delta copy (BUG-020)
- ⬜ Report filters; dashboard PDF; send renewal reminders

## Progression
- ✅ Overview; levels list; add requires name; remove with confirm
- ✅🔧 New level not appended at the end (BUG-019)
- ⬜ Skills CRUD / assess; drag reorder

## Errors & edge cases
- ✅ 404; invalid ID (✅🔧 BUG-001); back/forward; refresh mid-dialog; cross-tab sign-out
- ✅🔧 Generic server-error toasts (BUG-005/008/009)
- ⬜ Network loss; slow API

## UI / responsive / browsers
- ✅ 375 / 768 / 1280 without horizontal overflow; drawer nav; phone layouts for coach & parent
- ✅🔧 Coach rows not keyboard-reachable (BUG-021)
- ⬜ Firefox, Edge, Safari/iOS

## Regression
- ✅ `npm run typecheck` · ✅ `npm run lint` · ✅ `npx vitest run` (122 after fixes) · ✅ `PORT=5183 npx playwright test` (8 after fixes)

## Cleanup
- ✅ All `QA_TEST_*` skaters, batch (+sessions), plan, holiday, level, announcements (+notifications) removed
- ✅ Seed skaters' attendance/bookings restored
- ✅ Voided QA payment left crossed-out (append-only ledger, by design)
