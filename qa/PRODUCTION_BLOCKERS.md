# Production Blockers — PRSA Skating Academy

Cycle of 18 Sep 2026. A blocker is a defect that would cause wrong data, a broken core workflow, or a locked-out user on day one. Fix these before go-live. Full details and evidence in `QA_EXECUTION_REPORT.md`.

## Must fix before go-live

| # | Defect | Why it blocks | Suggested fix | Effort |
|---|---|---|---|---|
| 1 | **BUG-003** — "Existing parent" never shows the parent picker | A second child of an existing family cannot be added correctly; the admin is forced to create a duplicate parent (and burn an invite email) | In `AddStudentPage.tsx` the `Select`'s `onValueChange` calls `form.setValue('parent', {...})` but the branch renders from `form.watch('parent.mode')`; either `setValue('parent.mode', value, { shouldDirty: true })` first or use `useWatch` on the nested field, then render the picker | S |
| 2 | **BUG-005** — Add student is not atomic | Failed invites leave orphan skaters (enrolled, billable) with no parent; the generic toast hides the cause, so the admin retries and creates more orphans | Move student + enrolment + parent link into one `security definer` RPC (`create_student_with_parent`) that runs in a transaction and invites the parent last; on invite failure roll back or mark the student "invite pending" and show the real message | M |
| 3 | **BUG-006** — Rapid double/triple submit creates duplicate skaters | Real risk on slow mobile connections; duplicates then pollute rosters, fees and reports | Disable the submit button while `mutation.isPending`; add an idempotency key to the RPC from #2 | S |
| 4 | **BUG-007** — Supabase default SMTP rate limit | Parent and coach invites fail after 3–4 per hour; onboarding a batch of families on launch day is impossible | Configure a custom SMTP provider (Resend / Postmark / SES) in Supabase Auth settings and raise the rate limit; surface the provider error in the toast | S (config) |

## Should fix before go-live (money is displayed wrongly, workaround exists)

| # | Defect | Impact | Suggested fix |
|---|---|---|---|
| 5 | **BUG-010** — Fees dashboard shows a negative balance | Admin sees "₹-500" for a fully-paid fee and may refund cash that is already parked as an advance | `fee_paid_total()` (or the dashboard view) should count only the fee portion of a payment that carried an advance (`amount − advance_portion`), or clamp the displayed balance at 0 and show "+₹500 advance" |
| 6 | **BUG-012** — Advance not applied to an already-open fee until the nightly job | Parent is asked for the full amount while the academy holds their money | Call `apply_all_advances()` inside "Generate now", and add an "Apply advance" button on the student Fees tab; replace the raw ledger note in the banner with plain copy |
| 7 | **BUG-001** — Endless skeleton on an unknown student ID | Broken bookmarks / deleted skaters look like an app hang | Render a not-found state when the query resolves to `null` |
| 8 | **BUG-004** — Whitespace-only names accepted | Blank rows in rosters, dropdowns and reports | `z.string().trim().min(1)` on every name/title field |

## Not blocking (fix in the first maintenance release)

BUG-002, 008, 009, 011, 013–021 — copy, validation polish, confirmations, ordering and accessibility. See the execution report.

## Environment / process prerequisites for launch

- Custom SMTP configured and tested with a real invite (unblocks TC-AUTH-013).
- Run the cycle's NOT RUN cases that touch live data on a staging copy of the database (session cancel with bookings, top-up minimums, 0-credit booking).
- Smoke test on Safari/iOS and Firefox once — the parent app is phone-first and was only verified in Chromium.
- Keep `npm run typecheck && npm run lint && npm test && npm run test:e2e` green in CI before every deploy.

## Recommendation

**Not ready for production today.** Ready after items 1–4 are fixed and re-verified (estimated one to two working days), with items 5–8 strongly recommended in the same release. No Critical defects and no security or data-isolation failures were found; the money core, credit ledger and role separation all held up under negative and boundary testing.
