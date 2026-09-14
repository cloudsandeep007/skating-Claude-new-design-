# Reports

## Purpose

Four exportable reports for anything the dashboard's charts summarize
but an admin needs the underlying rows for — accounting, a coach
review, a parent meeting.

## Screens

**`/admin/reports`** — four tabs, each with the same two filters (an
explicit from/to date range, defaulting to the last 30 days, and a
batch picker) and the same two export buttons:

- **Attendance** — per student: counted/attended/absent/late/excused
  sessions and attendance % in the range. Reads the same
  `attendance_summary_for_range()` RPC the existing admin Attendance
  screen's "by batch" view uses.
- **Fee collection** — per fee due in the range: student, batch, plan,
  due date, amount, balance, status. `fee_collection_report()`.
- **Student progress** — per student: batch, current level, skills
  marked achieved in the range, their current level's total skill
  count (shown for context, not as a denominator — see Business rules),
  and attendance % in the range. `student_progress_report()`.
- **Coach activity** — per coach: batches, sessions held, distinct
  students seen, and attendance % for their sessions in the range.
  `coach_activity_report()`.

Each table has its own skeleton while loading, an error state with
retry, and an empty state ("try a wider range or a different batch").

## Data touched

All reads, via `attendance_summary_for_range` (existing, from the
attendance feature), `fee_collection_report`, `student_progress_report`,
`coach_activity_report` (new — see DATA-MODEL.md).

## Business rules

- **CSV export** is exactly the rows on screen for the current
  filters — `shared/lib/csv.ts`'s existing `downloadCsv`, the same
  helper the Attendance and Fees screens already use.
- **PDF export** is a genuine table (`jspdf-autotable`), not a screen
  capture — a title, the date range, and a paginated table, landscape
  orientation so wider reports (fees, progress) don't truncate columns.
- **Student progress's two skill numbers aren't a fraction of each
  other.** "Skills achieved (range)" counts skills marked achieved
  *within the date range*, across any level the student has passed
  through — a student who advanced two levels in the period can show
  more skills achieved than their current level even has. "Skills in
  level" is their *current* level's total, shown for context. The UI
  says this explicitly above the table so it doesn't read as "X of Y".
- **Both PDF paths (this page's table export and the dashboard's whole-page
  export) dynamically `import()` jspdf/jspdf-autotable/html2canvas**
  rather than importing them at module scope — together they're several
  hundred KB, and most page loads never click an export button. See
  DECISIONS.md.

## Edge cases

- **No batch selected ("All batches")** — every report's `p_batch_id` is
  omitted, matching every batch.
- **A student who left a batch mid-range** — the batch filter checks
  *current* active enrollment, so a student who's since left the
  filtered batch drops out of that filtered view even for dates while
  they were still enrolled; switch to "All batches" to see their full
  history.

## Known limitations

- No saved/scheduled reports — every export is generated on demand from
  whatever's currently on screen.
- Date range is a single shared piece of state per tab switch reset —
  changing tabs keeps the same range, but there's no "remember my last
  report's settings" across a reload.
