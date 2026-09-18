# Production Blockers — PRSA Skating Academy

**Status on 19 Sep 2026: no open code blockers.** Every defect from the 18 Sep
cycle is fixed and re-verified (see `QA_EXECUTION_REPORT.md` §8). One item
remains that only configuration can close.

## Must do before go-live

| # | Item | Why | Action | Owner |
|---|---|---|---|---|
| 1 | **BUG-007 — email provider** | Supabase's default sender allows a handful of emails per hour; parent/coach invites and password resets fail after that. The app now refuses cleanly ("The email service limit was reached…") and creates nothing, but families still can't be invited in bulk. | Configure a custom SMTP provider (Resend / Postmark / SES) under Supabase → Authentication → SMTP, raise the rate limit, then send one real invite end-to-end (TC-AUTH-013). RUNBOOK → "Email provider". | Academy owner / Supabase admin |

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

**Ready for a single-academy launch once the SMTP provider is configured and
one invite has been sent end-to-end.** No Critical or High defects remain;
the money core, credit ledger, booking approvals and role separation all
held up under the 18 Sep negative and boundary testing and the 19 Sep
re-test.
