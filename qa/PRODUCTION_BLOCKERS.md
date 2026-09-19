# Production Blockers — PRSA Skating Academy

**Status on 19 Sep 2026 (evening): no open blockers.** Every defect from the
18 Sep cycle is fixed and re-verified (see `QA_EXECUTION_REPORT.md` §8), and
the last configuration item — invites depending on Supabase's rate-limited
mailer — was removed by making invites work through a shareable sign-in link.

## Must do before go-live

Nothing outstanding in code or configuration.

| Was | Resolved by |
|---|---|
| **BUG-007 — email provider** (invites failed after ~2 emails/hour) | `invite-user` now creates the account with `generateLink` and returns a one-time sign-in link the admin shares on WhatsApp; `/welcome` verifies it in-app. Email is attempted as well and its outcome shown. Verified end-to-end 19 Sep: link → set password → parent home; email+password login afterwards. Custom SMTP remains *recommended* for emailed password resets (RUNBOOK → Email provider). |

## Fixed since the 18 Sep report (for the record)

| Was | Fixed by |
|---|---|
| BUG-003 Existing-parent picker never appeared | `AddStudentPage.tsx` — mode change goes through the form field |
| BUG-005 Add student not atomic | `createStudent.ts` compensating delete + `describeError`; unit-tested |
| BUG-006 Multi-click duplicates | Submit lock |
| BUG-010 Negative balance | `0033` — `fee_paid_total()` counts the fee portion |
| BUG-012 Advance not applied to open fee | `0033` — applied on generate; **Apply now** button |
| BUG-001 / 004 / 013 and all Low items | See `QA_EXECUTION_REPORT.md` defect table, "Outcome" column |

## Still recommended before launch (not blockers)

- Run the NOT RUN cases that touch live data on a staging copy: cancel a
  session with bookings, top-up minimums via the UI, booking at 0 credits,
  batch capacity limit, coach clash.
- One manual smoke pass of the parent app on Safari/iOS and Firefox.
- Keep `npm run typecheck && npm run lint && npm test && npm run test:e2e`
  green in CI before every deploy (all green on 19 Sep: 122 unit, 8 e2e).

## Recommendation

**Ready for a single-academy launch.** Configure a custom SMTP provider when convenient so "Forgot password" emails are reliable; it is no longer on the critical path. No Critical or High defects remain;
the money core, credit ledger, booking approvals and role separation all
held up under the 18 Sep negative and boundary testing and the 19 Sep
re-test.
