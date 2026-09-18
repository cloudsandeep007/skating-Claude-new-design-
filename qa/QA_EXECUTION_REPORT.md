# QA Execution Report — PRSA Skating Academy

**Cycle:** 18 Sep 2026 · **Build:** commit `4a9cd32` + working tree · **Environment:** `http://localhost:5183` (Vite dev) → live Supabase `lbjzipgeqyuovqwptuul` · **Browser:** Chromium (Claude browser pane; Playwright 1.x for the automated suite and evidence capture) · **Accounts:** `admin@`, `coach1@`, `ravi.bhat11@`, `super@skating.test`

## 1. Summary

| Metric | Value |
|---|---|
| Test cases identified | **187** |
| Executed (PASS + FAIL) | **153** |
| PASS | **132** |
| FAIL | **21** |
| BLOCKED | **1** |
| NOT RUN | **33** |
| Defects logged | **21** (Critical 0 · High 3 · Medium 5 · Low 13) |
| Automated regression | typecheck ✅ · lint ✅ · 91/91 unit ✅ · 7/7 e2e ✅ |

Per-area breakdown is in `QA_TEST_CASES.md`. Every status was set only after the step was executed; NOT RUN cases are listed in §5 with the reason.

## 2. What was executed, by phase

| Phase | Highlights |
|---|---|
| 1 Smoke | Redirect to login, all four role logins, 15 admin routes with a clean console, 404 page |
| 2 Functional | Students CRUD + archive/restore + enrol; fee plans CRUD; fees dashboard (month picker, overdue filter, partial payment, void, waive, CSV, generate-now); coaches; batch create → generate schedule → enrol → remove; schedule navigation, extra session, holidays, "Coming up"; coach attendance with credit spend/return verified in the ledger; parent book/cancel with credit counter; announcements with audience targeting and notifications; all five report tabs with CSV + PDF; progression levels; dashboard panels |
| 3 Negative | Empty submits on every form; malformed email; wrong/unknown credentials; XSS strings in search and announcement title; forbidden RPCs as parent; booking for an unrelated skater; duplicate plan name; duplicate session |
| 4 Boundary / edge | Zero / negative / oversized amounts; future payment date; past session date; capacity 0; end-before-start time; whitespace-only name; Unicode + emoji; triple-click submit; refresh mid-dialog; back/forward; cross-tab sign-out |
| 5 Roles | Route gating for all four roles; RLS on students, bookings, audit logs; RPC ownership checks |
| 6–7 UI / responsive | 375 / 768 / 1280 on fees, students, schedule, student detail, dashboard; drawer nav; no horizontal overflow; coach and parent apps on Pixel 5 emulation |
| 8 Browsers | Chromium only (Firefox / Edge / Safari NOT RUN — not installed) |
| 9 Errors | Invalid ID, unknown route, server-side failures (overflow, duplicate, invite failure) |
| 10 Regression | `npm run typecheck`, `npm run lint`, `npx vitest run` (91), `PORT=5183 npx playwright test` (7) |

## 3. Defects

Severity scale: **Critical** = data loss / security breach / money wrong with no workaround · **High** = core flow broken or data integrity at risk · **Medium** = wrong information shown or poor recovery, workaround exists · **Low** = cosmetic, copy, minor validation.

| ID | Sev | Area | Title | Steps to reproduce | Expected | Actual | Evidence |
|---|---|---|---|---|---|---|---|
| BUG-001 | Medium | Students | Non-existent student ID shows an endless loading skeleton | Open `/admin/students/00000000-0000-4000-8000-000000000000` | "Student not found" with a link back | Skeleton forever; no message | `evidence/BUG-001_student_invalid_id_endless_skeleton.png` |
| BUG-002 | Low | Students | Search does not trim whitespace | Type `  PAY PER  ` in the list search | S1 pay per class found | "No skaters match" | — |
| BUG-003 | **High** | Students | "Existing parent" never shows the parent picker | Add student → Parent → Link to → Existing parent | Picker of existing parents replaces the new-parent fields | New-parent fields stay; no picker; form cannot link a sibling to an existing parent | `evidence/BUG-003_add_student_existing_parent_no_picker.png` (confirmed by Playwright: trigger reads "Existing parent", `parent.fullName` input still present, no picker input) |
| BUG-004 | Medium | Students | Whitespace-only skater name accepted | Name `   `, fill the rest, submit | "Skater name is required" | Student created with a blank name (shows as an empty row in lists, rosters and dropdowns) | — |
| BUG-005 | **High** | Students | Add student is not atomic — orphan skater when the parent invite fails | Add student with a new parent while invites fail (see BUG-007) | Nothing saved; the real reason shown | Skater inserted and enrolled, parent invite failed, generic toast "Could not add this student. Please try again." | — |
| BUG-006 | **High** | Students | Multi-click on "Add student" creates duplicates | Fill a valid form, triple-click the submit button | One skater | Three identical skaters (no submit lock / idempotency) | — |
| BUG-007 | Medium (config) | Platform | Supabase default email provider rate-limits invites | Add 3–4 students with new parents within an hour | Invite emails sent | `email rate limit exceeded`; surfaced as a generic error | — |
| BUG-008 | Low | Fee plans | No upper bound on plan amount | Amount `99999999999999`, save | Validation error, dialog stays open | Numeric overflow from the DB → generic toast; dialog closes and input is lost | — |
| BUG-009 | Low | Fee plans | Duplicate plan name gives a generic error | Create a plan named like an existing one | "A plan with this name already exists" | DB refuses (409) but toast is generic; dialog closes | — |
| BUG-010 | Medium | Fees | Fees dashboard shows a negative balance | Open `/admin/fees` for Sep 2026, row "E2E Payments Skater" | Balance ₹0 (the ₹500 excess is held as an advance) | Balance **₹-500** | `evidence/BUG-010_fees_negative_balance_and_BUG-011_zero_paid_row.png` |
| BUG-011 | Low | Fees | Voided top-up listed as "₹0 · Paid" | Same screen; also Reports → Fee collection and the parent Fees page | Voided top-ups hidden or labelled "Voided" | Row shows amount ₹0, status Paid | same as above |
| BUG-012 | Medium | Fees | Available advance is not applied to an already-open fee | Skater holds ₹500 advance; Oct fee pending ₹1,200; click "Generate now" | Advance applied (₹700 due) or an "Apply advance" action | Stays ₹1,200 due until the nightly Edge Function runs; banner text also leaks the raw ledger note "Returned — advance application voided (e2e reset)" | Student detail → Fees tab |
| BUG-013 | Low | Coaches / Students | Phone fields accept any text | Add coach with phone `abc` | Format validation | Accepted (`z.string().min(1)` only) — same in student emergency contact and parent phone | `src/features/coaches/types.ts:24`, `src/features/students/types.ts:50` |
| BUG-014 | Low | Schedule | Extra session accepts a date in the past silently | Extra session → date Sep 10 (today Sep 18) | Refuse or warn | "Extra session added." | — |
| BUG-015 | Low | Schedule | Holiday removal has no confirmation | Click the × on a holiday | Confirm step or undo | Removed instantly | — |
| BUG-016 | Low | Attendance | Credit statement reasons don't describe attendance events | Mark a booked skater absent, then present | "Returned — marked absent" / "Spent — marked present" | "Booking cancelled" / "Attended without booking" | Student → Attendance tab |
| BUG-017 | Low | Parent | Book / cancel give no feedback and cancel has no confirm | Tap Cancel on a booked class | Toast and/or confirm | Row flips silently; credit counter changes | — |
| BUG-018 | Low | Announcements | Expiry earlier than publish time accepted | Publish now with Expires = Sep 1 | Validation error | Published and immediately "expired"; recipients still notified | — |
| BUG-019 | Low | Progression | New level inserted before the last level | Add level "QA_TEST Level" | Appended after Advanced 1 (dialog says "added at the end") | Inserted at position 3, before Advanced 1 | — |
| BUG-020 | Low | Dashboard | Attendance KPI delta shows no number | Open `/admin` | "+N pts vs last month" | "pts vs last month" | `evidence/TC-DASH-001_admin_dashboard_desktop.png` |
| BUG-021 | Low (a11y) | Coaches | Coach rows are clickable divs, not links | Tab through `/admin/coaches` | Row focusable, Enter opens, URL on hover | Not reachable by keyboard; no href | — |

### Observations (not defects)

- `class_credit_summary` called as a coach returns zeros instead of an error; no coach screen depends on it, but a future one could show wrong numbers silently.
- An academy admin can hard-delete `students` rows through the API even though the UI only offers Archive (used for cleanup here). Consider a delete guard or RLS policy if archiving is meant to be the only path.
- "Needs attention" requires ≥3 counted sessions, so a skater with 0 % over one session is not listed while the copy says "Everyone's attending well".
- The Beginner batch has historic sessions on Tue–Fri although its days are now Sat/Sun; expected after the earlier day change, but worth a cleanup.
- Generic toasts ("Could not … Please try again.") hide the server reason in every failure path tested (BUG-005/008/009). One shared fix — surface `error.message` for known Postgres codes — closes all three.

## 4. Verified strengths (things that clearly work)

- Money core: partial payments, overpay cap, advance opt-in, future-date refusal, zero/negative refusal, waive/void with mandatory reasons, receipt numbering, immutable voided rows, balance re-derivation, activity trail, CSV export, reconciliation totals matching the dashboard.
- Credit truth: booking spends, absence returns, re-present spends again, un-booked absence is neutral — all confirmed in `credit_ledger`.
- Authorisation: route gating for every role; parents limited to their own children in data and RPCs; parents cannot touch money RPCs or audit logs; booking window and past-session guards enforced server-side.
- Forms: every form refuses an empty submit with specific messages; batch and payment forms enforce sensible bounds.
- Resilience: refresh mid-dialog, back/forward, cross-tab sign-out all behave.
- Responsive: no horizontal overflow at 375 / 768 / 1280; drawer navigation on mobile; coach and parent apps usable on a phone.
- Automated suite is green.

## 5. NOT RUN / BLOCKED cases and why

| Reason | Cases |
|---|---|
| Only Chromium available | TC-UI-006/007/008 |
| Email delivery unobservable + rate limit (BUG-007) | TC-AUTH-012, TC-AUTH-013 (BLOCKED), TC-COA-006 |
| Would mutate live seed data irreversibly | TC-SCH-010 (cancel session with real bookings), TC-FEE-021 (real top-up money), TC-PAR-016 (needs a 0-credit skater) |
| Network cannot be cut from inside the browser pane | TC-ERR-006, TC-ERR-007, TC-ATT-011 |
| Not reached in this cycle (time-boxed) | TC-STU-022/023, TC-PLAN-006, TC-FEE-024/025, TC-COA-007, TC-BAT-010–013, TC-SCH-011, TC-ATT-010, TC-PAR-013/014/019, TC-ANN-006/007, TC-REP-008, TC-DASH-005/006, TC-PRG-006/007 |

## 6. Test data and cleanup

Created and removed: `QA_TEST Batch` (+ 9 sessions, 1 enrolment), `QA_TEST Plan`, `QA_TEST Holiday`, `QA_TEST Level`, two `QA_TEST` announcements (+ their notifications), four QA skaters (`QA_TEST Skater Edited`, two `QA_TEST Skater Ünïcödé 🛼` duplicates, the blank-name skater from BUG-004). Attendance and bookings on seed skaters S1/s2/s3 were restored to their starting state (s3's Sep 24 booking re-created; s3 marked present again).

Left in place by design: one **voided** ₹200 payment (`PRSA-2026-000021`, reference `QA_TEST partial 200`) on the `E2E Payments Skater` fixture — payments are append-only and cannot be deleted; it is crossed out with the reason "QA_TEST void partial" and counts for nothing.

## 7. Evidence

`qa/evidence/` — 27 screenshots named `<TC|BUG>-<id>_<description>.png`, regenerated by `node qa/evidence/capture-evidence.mjs` (run from the repo root with the dev server on 5183).
