# Production Readiness Report — PRSA Skating Academy

**Date:** 18 Sep 2026 · **Build:** commit `4a9cd32` + working tree · **Assessment by:** Claude, Senior QA / SDET · **Basis:** 187 identified cases, 153 executed in Chromium against the live Supabase project, 21 defects, automated suite green.

## Verdict

| | |
|---|---|
| **Overall** | **CONDITIONAL — not ready today; ready after 4 fixes** |
| Critical defects | 0 |
| High defects | 3 (BUG-003, BUG-005, BUG-006 — all in the Add-student flow) |
| Medium defects | 5 (BUG-001, 004, 007, 010, 012) |
| Low defects | 13 |
| Security / isolation failures | 0 |
| Money-integrity failures | 0 in the ledger; 2 display defects (BUG-010, BUG-012) |
| Automated regression | typecheck ✅ lint ✅ unit 91/91 ✅ e2e 7/7 ✅ |

## Readiness by area

| Area | Rating | Basis |
|---|---|---|
| Authentication & sessions | ✅ Ready | 11/13 PASS; the two remaining depend on email delivery (config, BUG-007) |
| Roles & data isolation | ✅ Ready | 10/10 PASS incl. RLS and RPC ownership probes |
| Fees & payments | 🟡 Ready with caveats | 19/25 PASS; ledger, receipts, void/waive, exports and reconciliation all correct; two display defects (negative balance, advance not applied until nightly) |
| Credit ledger & attendance truth | ✅ Ready | 9/12 PASS, 1 copy defect; every spend/return verified in `credit_ledger` |
| Parent app | ✅ Ready | 14/19 PASS; booking window and ownership enforced server-side; only feedback polish missing |
| Students | 🔴 Not ready | 7 FAIL — the Add-student flow can create orphans, duplicates and blank names, and cannot link to an existing parent |
| Coaches | 🟡 Ready with caveats | Creation depends on invite emails (BUG-007); phone validation missing |
| Batches & schedule | ✅ Ready | 17/24 PASS, 1 Low; generate/enrol/remove and duplicate/clash guards behave |
| Announcements & notifications | ✅ Ready | Audience targeting and notifications correct; one Low validation gap |
| Reports & dashboard | ✅ Ready | All tabs and exports work; totals reconcile; one Low copy defect |
| Progression | 🟡 Ready with caveats | Levels CRUD works; ordering bug (Low); skills/assessment NOT RUN |
| Responsive / UI | ✅ Ready | No overflow at 375/768/1280; phone layouts for coach and parent verified |
| Cross-browser | ⚪ Unknown | Chromium only |
| Error handling | 🟡 Ready with caveats | Routing/refresh/back all fine; server errors are always shown as a generic toast |

## What was proven

- **The money model holds.** Partial payments, the overpay cap, the advance opt-in, future-date refusal, mandatory reasons on void/waive, immutable voided rows, receipt numbering, balance re-derivation, activity trail, CSV/PDF exports and the reconciliation report were all executed and matched the ledger.
- **Credits follow attendance.** Booking spends a credit, absence returns it, re-marking present spends it again, an un-booked absence is neutral — each transition confirmed in `credit_ledger` with the right sign.
- **Roles are sealed.** Every role is blocked from the other areas; parents only see and act on their own children; money RPCs, audit logs and other families' bookings are inaccessible to them.
- **The app recovers.** Refresh mid-dialog, back/forward, unknown routes and cross-tab sign-out behave correctly.

## What is not proven

- Email-dependent flows (invite acceptance, password reset) — blocked by the default SMTP rate limit.
- Firefox / Edge / Safari / real devices.
- Network-loss behaviour and the coach offline queue.
- Session cancellation with live bookings, top-up minimums via the UI, booking at 0 credits, batch capacity limit, coach clash detection, scheduled/batch-targeted announcements, report filters, skills assessment.

## Go-live conditions

1. Fix and re-test BUG-003, BUG-005, BUG-006 (Add-student flow) — one PR.
2. Configure a production SMTP provider in Supabase Auth and send one real invite end-to-end (BUG-007).
3. Strongly recommended in the same release: BUG-010, BUG-012 (money display), BUG-001, BUG-004.
4. Run the "would mutate live data" NOT RUN cases on a staging copy of the database.
5. One manual smoke pass of the parent app on an iPhone (Safari) and one on Firefox.

With 1–2 done the application is fit for a single-academy launch; with 3–5 done it is fit for daily use by a non-technical owner without engineering support on standby.

## Deliverables

| File | Contents |
|---|---|
| `qa/QA_TEST_PLAN.md` | Scope, approach, entry/exit criteria, risks |
| `qa/QA_TEST_CASES.md` | All 187 cases with status and evidence links |
| `qa/QA_EXECUTION_REPORT.md` | Counts, phase log, 21 defects with repro steps, NOT RUN reasons, cleanup record |
| `qa/QA_CHECKLIST.md` | Tick-box checklist of what was and wasn't covered |
| `qa/PRODUCTION_BLOCKERS.md` | Blockers with suggested fixes and effort |
| `qa/evidence/` | 27 screenshots + `capture-evidence.mjs` to regenerate them |
