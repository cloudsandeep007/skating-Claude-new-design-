# QA Execution Report — PRSA Skating Academy

**Cycle:** 18 Sep 2026 (execution) · 19 Sep 2026 (fix & re-test) · **Build tested:** commit `4a9cd32` + working tree · **Build after fixes:** see git log (migrations `0033`, `0034`) · **Environment:** `http://localhost:5183` (Vite dev) → live Supabase `lbjzipgeqyuovqwptuul` · **Browser:** Chromium (Claude browser pane; Playwright 1.x for the automated suite and evidence capture) · **Accounts:** `admin@`, `coach1@`, `ravi.bhat11@`, `super@skating.test`

## 1. Summary

| Metric | 18 Sep (execution) | 19 Sep (after fixes, re-test) |
|---|---|---|
| Test cases identified | **187** | **187** |
| Executed (PASS + FAIL) | **153** | **152** (+1 moved to BLOCKED) |
| PASS | **132** | **152** |
| FAIL | **21** | **0** |
| BLOCKED | **1** | **2** (both email-delivery: TC-AUTH-013, TC-STU-015) |
| NOT RUN | **33** | **33** |
| Defects logged | **21** (Critical 0 · High 3 · Medium 5 · Low 13) | **20 fixed · 1 mitigated in code, needs SMTP config (BUG-007)** |
| Automated regression | typecheck ✅ · lint ✅ · 91/91 unit ✅ · 7/7 e2e ✅ | typecheck ✅ · lint ✅ · 122/122 unit ✅ · 8/8 e2e ✅ |

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

| ID | Sev | Area | Title | Steps to reproduce | Expected | Actual | Evidence | Outcome (19 Sep) |
|---|---|---|---|---|---|---|---|---|
| BUG-001 | Medium | Students | Non-existent student ID shows an endless loading skeleton | Open `/admin/students/00000000-0000-4000-8000-000000000000` | "Student not found" with a link back | Skeleton forever; no message | `evidence/BUG-001_student_invalid_id_endless_skeleton.png` | **Fixed** — Not-found state with a link back; a bad id is not retried (`getStudent.ts`, `StudentDetailPage.tsx`) |
| BUG-002 | Low | Students | Search does not trim whitespace | Type `  PAY PER  ` in the list search | S1 pay per class found | "No skaters match" | — | **Fixed** — Search trims before matching (`listStudents.ts`) |
| BUG-003 | **High** | Students | "Existing parent" never shows the parent picker | Add student → Parent → Link to → Existing parent | Picker of existing parents replaces the new-parent fields | New-parent fields stay; no picker; form cannot link a sibling to an existing parent | `evidence/BUG-003_add_student_existing_parent_no_picker.png` (confirmed by Playwright: trigger reads "Existing parent", `parent.fullName` input still present, no picker input) | **Fixed** — Mode change goes through the form field, then the other mode's inputs are cleared (`AddStudentPage.tsx`) |
| BUG-004 | Medium | Students | Whitespace-only skater name accepted | Name `   `, fill the rest, submit | "Skater name is required" | Student created with a blank name (shows as an empty row in lists, rosters and dropdowns) | — | **Fixed** — `requiredText()` trims + refuses blank on every name field (`shared/lib/validation.ts`) |
| BUG-005 | **High** | Students | Add student is not atomic — orphan skater when the parent invite fails | Add student with a new parent while invites fail (see BUG-007) | Nothing saved; the real reason shown | Skater inserted and enrolled, parent invite failed, generic toast "Could not add this student. Please try again." | — | **Fixed** — Compensating delete when enrolment/invite fails; real reason via `describeError()`; unit-tested (`createStudent.test.ts`) |
| BUG-006 | **High** | Students | Multi-click on "Add student" creates duplicates | Fill a valid form, triple-click the submit button | One skater | Three identical skaters (no submit lock / idempotency) | — | **Fixed** — Submit lock (`useRef`) — triple-click created exactly one skater on re-test |
| BUG-007 | Medium (config) | Platform | Supabase default email provider rate-limits invites | Add 3–4 students with new parents within an hour | Invite emails sent | `email rate limit exceeded`; surfaced as a generic error | — | **Mitigated (config)** — Error now reads "email service limit was reached… link an existing parent"; skater is not created. SMTP provider to be configured — RUNBOOK → Email provider |
| BUG-008 | Low | Fee plans | No upper bound on plan amount | Amount `99999999999999`, save | Validation error, dialog stays open | Numeric overflow from the DB → generic toast; dialog closes and input is lost | — | **Fixed** — Amount ≤ ₹1 crore, rate ≤ ₹10 lakh in the schema; server errors keep the dialog open with input intact |
| BUG-009 | Low | Fee plans | Duplicate plan name gives a generic error | Create a plan named like an existing one | "A plan with this name already exists" | DB refuses (409) but toast is generic; dialog closes | — | **Fixed** — Unique-violation reads "One with this name already exists"; dialog stays open |
| BUG-010 | Medium | Fees | Fees dashboard shows a negative balance | Open `/admin/fees` for Sep 2026, row "E2E Payments Skater" | Balance ₹0 (the ₹500 excess is held as an advance) | Balance **₹-500** | `evidence/BUG-010_fees_negative_balance_and_BUG-011_zero_paid_row.png` | **Fixed** — `fee_paid_total()` sums the fee portion (amount − advance deposit) — `0033`; client `paidTotal()` mirrors it. Sep row now ₹0 |
| BUG-011 | Low | Fees | Voided top-up listed as "₹0 · Paid" | Same screen; also Reports → Fee collection and the parent Fees page | Voided top-ups hidden or labelled "Voided" | Row shows amount ₹0, status Paid | same as above | **Fixed** — Voided top-ups excluded from `student_fees_list` / `fee_collection_report` (`0033`); skater tab shows a Voided badge |
| BUG-012 | Medium | Fees | Available advance is not applied to an already-open fee | Skater holds ₹500 advance; Oct fee pending ₹1,200; click "Generate now" | Advance applied (₹700 due) or an "Apply advance" action | Stays ₹1,200 due until the nightly Edge Function runs; banner text also leaks the raw ledger note "Returned — advance application voided (e2e reset)" | Student detail → Fees tab | **Fixed** — `generate_upcoming_fees()` applies advances; **Apply now** button on the skater's Fees tab; banner copy no longer leaks the ledger note |
| BUG-013 | Low | Coaches / Students | Phone fields accept any text | Add coach with phone `abc` | Format validation | Accepted (`z.string().min(1)` only) — same in student emergency contact and parent phone | `src/features/coaches/types.ts:24`, `src/features/students/types.ts:50` | **Fixed** — `phoneSchema` (7–15 digits) on coach, emergency contact and parent phone |
| BUG-014 | Low | Schedule | Extra session accepts a date in the past silently | Extra session → date Sep 10 (today Sep 18) | Refuse or warn | "Extra session added." | — | **Fixed** — Extra session refuses dates before yesterday: "That date has passed — pick today, yesterday, or a date ahead" |
| BUG-015 | Low | Schedule | Holiday removal has no confirmation | Click the × on a holiday | Confirm step or undo | Removed instantly | — | **Fixed** — Holiday removal asks first (AlertDialog) |
| BUG-016 | Low | Attendance | Credit statement reasons don't describe attendance events | Mark a booked skater absent, then present | "Returned — marked absent" / "Spent — marked present" | "Booking cancelled" / "Attended without booking" | Student → Attendance tab | **Fixed** — Attendance sets `app.ledger_reason` → "Marked absent — class returned" / "Marked present" (`0033`, `0034`) |
| BUG-017 | Low | Parent | Book / cancel give no feedback and cancel has no confirm | Tap Cancel on a booked class | Toast and/or confirm | Row flips silently; credit counter changes | — | **Fixed** — Toasts on book/cancel; cancelling a confirmed booking asks first (withdrawing a request stays one tap) |
| BUG-018 | Low | Announcements | Expiry earlier than publish time accepted | Publish now with Expires = Sep 1 | Validation error | Published and immediately "expired"; recipients still notified | — | **Fixed** — Expiry must be after the publish time (now, when publishing now) |
| BUG-019 | Low | Progression | New level inserted before the last level | Add level "QA_TEST Level" | Appended after Advanced 1 (dialog says "added at the end") | Inserted at position 3, before Advanced 1 | — | **Fixed** — New level/skill sequence = max existing + 1, not count + 1 |
| BUG-020 | Low | Dashboard | Attendance KPI delta shows no number | Open `/admin` | "+N pts vs last month" | "pts vs last month" | `evidence/TC-DASH-001_admin_dashboard_desktop.png` | **Fixed** — Caption reads "no data for last month" / "same as last month (N%)" / "pts vs N% last month" |
| BUG-021 | Low (a11y) | Coaches | Coach rows are clickable divs, not links | Tab through `/admin/coaches` | Row focusable, Enter opens, URL on hover | Not reachable by keyboard; no href | — | **Fixed** — Coach name is a real `<Link>` inside the row (keyboard-reachable, has an href) |

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

## 8. Fix & re-test (19 Sep 2026)

All 21 defects were worked in one pass and re-verified in the browser
against the same seed accounts:

| Check | Result |
|---|---|
| BUG-003 Existing parent picker | Picker appears; a skater was created linked to an existing parent |
| BUG-004 / BUG-013 blank name, bad phone | "Skater's name is required" / "Enter a valid phone number" on submit |
| BUG-006 triple-click | One skater created |
| BUG-005 atomicity | Unit tests: invite failure and enrolment failure both delete the skater and rethrow the reason |
| BUG-001 unknown id | "Skater not found" with link to All skaters |
| BUG-002 whitespace search | "  PAY PER  " finds S1 |
| BUG-008 / BUG-009 plan dialog | "Amount must be under ₹1 crore" inline; duplicate → "One with this name already exists" and the dialog stays open with the name intact |
| BUG-010 / BUG-011 Fees dashboard | E2E Sep row: ₹640 paid, balance ₹0; no ₹0 rows in the list |
| BUG-012 Apply now | ₹500 applied; Oct fee ₹1,200 → ₹700 due; banner gone |
| BUG-014 past extra session | Refused with the new message |
| BUG-015 holiday removal | Confirm dialog, then removed |
| BUG-016 ledger reasons | "Marked absent — class returned" / "Marked present" on a parent-made booking |
| BUG-017 cancel confirm | Confirmed booking → dialog; e2e updated and green |
| BUG-018 expiry in the past | "Expiry must be in the future" |
| BUG-019 level order | QA_TEST Level appended at position 4, then removed |
| BUG-020 caption | "no data for last month" |
| BUG-021 coach rows | Name is an `<a href>` |
| BUG-007 | Cannot be re-tested until SMTP is configured; the failure path is unit-tested and the message is now specific |

Test data created during re-test (`QA_TEST Triple Click`, `QA_TEST Orphan
Check`, `QA_TEST Level`, `QA_TEST Holiday`) was removed; S1 and s3 attendance
marks were restored to present.
