# QA Test Plan — PRSA Skating Academy

**Version:** 1.0 · **Date:** 18 Sep 2026 · **Build under test:** commit `4a9cd32` + working tree (Payments audit Phase 3 complete) · **Tester:** Claude (Senior QA / SDET role) · **Environment:** local Vite dev server `http://localhost:5183` against the live Supabase project `lbjzipgeqyuovqwptuul`, Chromium (Claude browser pane + Playwright).

## 1. Purpose and scope

Decide whether the PRSA skating-academy application is ready for production use by a non-technical academy owner. The plan covers every user-facing area of the app for all four roles (super admin, academy admin, coach, parent), with emphasis on the money and credit flows that were rebuilt in the last five sessions.

**In scope**

| Area | Screens |
|---|---|
| Authentication & sessions | Login, logout, session persistence, cross-tab sign-out, protected-route redirects |
| Role & tenant isolation | Route gating (403), RLS on students, bookings, payments, audit logs, RPC authorisation |
| Students | List, search, filters, sort, add, edit, archive/restore, detail tabs (overview, attendance, fees, activity), enrolment |
| Fee plans | Create, edit, delete, validation |
| Fees & payments | Fees dashboard, month picker, quick filters, record payment (partial / overpay / advance / future date / zero / negative), waive, void, receipt numbers, CSV export, generate-now, activity trail, credit statement |
| Coaches | List, detail, add-coach validation |
| Batches | List, create with validation, generate schedule, enrol, remove |
| Schedule | Week calendar, navigation, extra sessions, holidays, "Coming up" bookings view |
| Attendance | Coach roster with booked flags, marking, confirm, persistence, credit spend/return rules |
| Parent app | Home, schedule (book/cancel, window, credits), fees, attendance, profile, password change, announcements, notifications |
| Announcements | Create, validation, audience targeting, expiry, delete |
| Reports & dashboard | All five report tabs, CSV/PDF exports, dashboard KPIs and panels |
| Progression | Overview, levels CRUD |
| Non-functional | 404/403, back/forward, refresh mid-workflow, responsive (375 / 768 / 1280), console errors, automated regression (typecheck, lint, 91 unit tests, 7 e2e tests) |

**Out of scope / not possible in this environment**

- Firefox, Edge, Safari and real iOS/Android devices — only Chromium is installed.
- Email delivery (invites, password reset) — Supabase's default SMTP is rate-limited and cannot be observed from the test machine.
- Load / performance testing, penetration testing beyond RLS and RPC authorisation probes.
- Destructive flows on live seed data that cannot be reverted (cancelling real sessions with live bookings, deleting seed skaters).

## 2. Test approach

1. **Smoke** — app loads, login works for every role, all admin routes render, no console errors.
2. **Functional** — each module exercised end-to-end with `QA_TEST_*` data, verifying both the UI and the database effect (via the Supabase client in the browser console).
3. **Negative** — empty submits, invalid formats, injection strings, wrong credentials, forbidden RPC calls.
4. **Boundary / edge** — zero/negative/oversized numbers, past/future dates, duplicates, rapid multi-click, whitespace-only input, Unicode.
5. **Roles** — every role tried against every other role's area; data-level RLS probed with direct queries.
6. **UI / responsive** — mobile, tablet, desktop; drawer navigation; overflow checks via `scrollWidth`.
7. **Error handling** — invalid IDs, unknown routes, refresh mid-dialog, cross-tab sign-out.
8. **Regression** — full automated suite after manual testing.
9. **Cleanup** — every `QA_TEST_*` record removed; immutable rows (voided payment) left crossed-out by design.

Rule applied throughout: a case is **PASS** only if it was executed and observed; **FAIL** if executed and the result deviated; **BLOCKED** if it could not proceed because of a defect or environment limit; **NOT RUN** if it was identified but not executed.

## 3. Entry and exit criteria

**Entry:** dev server up on 5183; seed accounts available (`super@`, `admin@`, `coach1@`, `ravi.bhat11@skating.test` / `Password123!`); migrations 0001–0031 applied; Edge Function deployed.

**Exit:** all identified cases have a status; every defect logged with severity, steps, expected/actual and evidence; all `QA_TEST_*` data removed; automated suite green; readiness recommendation issued.

## 4. Test data

Prefix `QA_TEST` on every created record (skaters, batch, plan, holiday, level, announcement, payment reference). The existing `E2E Payments Skater` fixture (used by the Playwright suite) was reused for payment flows because its history is already test-only. Live seed skaters (S1, s2, s3) were touched only through reversible attendance/booking actions and were restored to their starting state.

## 5. Risks and assumptions

- The dev server and the e2e suite both point at the **production** Supabase project; a mistake would affect real data. Mitigated by the `QA_TEST` prefix, immediate cleanup, and avoiding irreversible actions on seed records.
- Supabase's default email provider allows only a few emails per hour, which blocks any flow that depends on an invite or reset email.
- The user was working in the same database during the cycle; unexpected rows not prefixed `QA_TEST` were left untouched.

## 6. Deliverables

`qa/QA_TEST_PLAN.md` (this file), `qa/QA_TEST_CASES.md`, `qa/QA_EXECUTION_REPORT.md`, `qa/QA_CHECKLIST.md`, `qa/PRODUCTION_READINESS_REPORT.md`, `qa/PRODUCTION_BLOCKERS.md`, `qa/evidence/*.png` (+ `capture-evidence.mjs`, the script that reproduces the screenshots).

## 7. Schedule (as executed)

| Phase | Status |
|---|---|
| 1 Smoke | Complete |
| 2 Functional | Complete for all modules; some sub-flows NOT RUN (listed in the execution report) |
| 3 Negative | Complete |
| 4 Boundary / edge | Complete |
| 5 Roles | Complete |
| 6 UI | Complete |
| 7 Responsive | Complete (3 breakpoints) |
| 8 Browsers | Chromium only |
| 9 Error / network | Partial — network-loss simulation NOT RUN |
| 10 Regression | Complete (typecheck, lint, 91 unit, 7 e2e — all green) |
| 11 Assessment | Complete — see `PRODUCTION_READINESS_REPORT.md` |
