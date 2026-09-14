# Admin dashboard

## Purpose

The academy admin's landing page — where things stand right now, and who
needs a call today. Every number and chart reads a Postgres view or RPC
function; no chart component runs a raw table query.

## Screens

**`/admin`** (the admin's index route)
- **4 stat cards** — active students, today's attendance %, fees
  collected this month, outstanding dues — each with a trend indicator
  against last month.
- **A date-range selector** (last 3/6/12 months) driving the three trend
  charts (attendance, revenue, retention) and coach load's window.
- **6 charts** (Recharts), 2 columns on desktop, 1 on mobile:
  1. Attendance % trend — line, filterable by batch independently of the
     page-wide date range
  2. Revenue collected vs expected — grouped bar
  3. Students per batch vs capacity — horizontal bar
  4. Skill level distribution — bar (reads the same `level_distribution()`
     RPC as the Progress screen)
  5. Retention (active students) — line
  6. Coach load (students & sessions) — grouped bar
- **Needs attention** — the visual anchor, not a footnote: a full-width
  ink panel below the charts, heavier than the chart cards above it.
  Students under 60% attendance in the last 30 days, each with photo (or
  initials fallback), name, batch, level, attendance % with a colored
  bar, parent name/phone, and a tap-to-call `tel:` link. A footer note
  flags how many also have an overdue fee, linking to the Fees screen.
- **Export PDF** — captures the stat cards + charts + attention panel as
  they're currently rendered (current date range, current batch filter)
  into a paginated PDF.

Every chart card has its own skeleton while loading and its own empty
state when the academy has no data for it yet — nothing on this page can
render blank.

## Data touched

All reads, via the RPCs documented in DATA-MODEL.md under "Dashboard &
reports RPCs" — `dashboard_stat_cards`, `monthly_attendance_trend`,
`monthly_collection_totals` (existing view, read directly), `batch_capacity_summary`,
`level_distribution` (existing, from skill progression), `monthly_active_students`,
`coach_load_summary`, `needs_attention`.

## Business rules

- **"vs last month" is an honest proxy, not invented history.** This app
  keeps no historical snapshot of academy state, so:
  - Active students compares against students who joined *this* month
    (there's no count of "active as of last month" otherwise).
  - Today's attendance % compares against last calendar month's overall
    %, not "yesterday" or "this day last month".
  - Fees collected and outstanding-due-this-month come straight from
    `monthly_collection_totals`, which already tracks by month, so
    these two are real month-over-month comparisons, not proxies.
  All of this is documented in `dashboard_stat_cards()`'s own SQL comment
  — read that before changing what a card means.
- **"Needs attention" is fixed at 30 days / 60% / 3 sessions minimum,**
  matching the spec exactly ("below 60% in the last 30 days") — it is
  not affected by the page's date-range selector, because it's a
  standing alert threshold, not a report window.
- **The date-range selector** only drives the three trend charts
  (attendance, revenue, retention) and coach load's day window
  (`months × 30`). Batch capacity and skill distribution are point-in-time
  snapshots with no time dimension, so the selector doesn't apply to them
  — this is intentional, not a missing filter.
- **PDF export** captures whatever's currently on screen (`html2canvas` →
  `jspdf`), including the active date range and batch filter — it is not
  a separate, more-precise print layout.

## Edge cases

- **A brand-new academy with no attendance/fees/students yet** — every
  stat card shows "—", every chart shows its own empty state, and the
  attention panel shows "Everyone's attending well" rather than an empty
  list (there being nobody at risk and there being no data yet look the
  same from the RPC's point of view, which is fine — both mean nothing
  to flag).
- **Fewer months of history than the selected range** — the trend charts
  simply show however many months actually have sessions; no fabricated
  zero-value months are inserted.
- **A student without a parent phone on file** — the "Call" button is
  omitted for that row rather than linking to nothing.

## Known limitations

- No real historical snapshots — every "vs last month" figure is a
  best-effort proxy (see Business rules); a future phase could add a
  nightly snapshot table if exact historical comparisons matter.
- PDF export is an image capture of the rendered page, not a
  print-optimized layout — chart colors and card shadows are included
  as-is.
- The batch filter on the attendance trend chart is independent of any
  batch context elsewhere on the page (there's no "apply to all charts"
  batch filter, since most of the other charts are inherently
  academy-wide).
