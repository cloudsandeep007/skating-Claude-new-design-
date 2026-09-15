# Changelog

Dated, plain-language entries — what changed and why, written so a
non-technical person can follow it. Newest first.

---

## 2026-09-15 — Batch-priced fee plans, dues reminders, and a date-picker fix

- **Fee plans can now be tied to a specific batch.** When adding or
  editing a fee plan, there's a new "Batch" option — pick a batch (e.g.
  your weekend-only batch) to give it its own pricing, or leave it as
  "All batches" for a plan any student can be assigned to, like before.
  When adding or editing a student, once you've picked their batch, that
  batch's own plans show up first in the fee-plan list.
- **Admins can now see, and nudge, everyone with an outstanding fee.** A
  new "Overdue" button on the Fees screen shows every unpaid fee
  academy-wide in one click, instead of hunting month by month. Select
  any number of overdue rows (or use the reminder button on a single
  row) and click "Send reminder" — the parent gets a notification in the
  app pointing them straight to their Fees page, and the row shows when
  it was last reminded so nobody gets double-nagged by accident.
  Reminders are sent by the admin on demand, not automatically, and stay
  in-app only for now — no SMS or WhatsApp yet.
- **Fixed the date picker not opening.** Clicking a date field (in Fees,
  Reports, Attendance, adding a student, scheduling a session, and a few
  other places) sometimes didn't pop up a calendar at all. Every date and
  month field across the app now uses the same custom calendar popup
  instead of relying on the browser's own picker.

## 2026-09-15 — Full app redesign: new dark theme ("Kinetic Obsidian")

- **Every screen in the app was restyled** to match a new dark design —
  new colors, new fonts (Syne for headings, Plus Jakarta Sans for body
  text), a cyan/teal/coral accent palette instead of the old orange
  theme. This was a visual-only project: nothing about how any screen
  *works* changed, only how it looks.
- The app is now **dark-only** — there's no light mode any more, by
  request. It was previously light-only, so this is a full swap, not an
  added option.
- Fixed one real bug found while restyling: the coach's "Confirm
  attendance" button and the "Promote to next level" button used to
  briefly render in an alarming red when someone finished a positive
  action (all attendance marked, or a skater ready to level up). They
  now correctly show in the new positive/green color.
- The "Needs attention" panel on the dashboard, the coach's "today's
  session" card, and the parent home screen's "next session" card were
  redesigned to stand out clearly against the new dark background —
  they'd have blended into it otherwise.
- A few things shown in the new design's original mockups were
  deliberately **not** built, because they'd need real backend work, not
  just a new look: paying fees by UPI QR code, an autopay toggle,
  switching fee plans yourself, coaches leaving voice-note feedback, and
  an in-app "running late" / "requesting leave" button for parents.
  These are recorded as future ideas in `docs/DECISIONS.md`, not lost.
- `docs/design/latest stitch/` holds the design mockups this was built
  from, for reference.

## 2026-09-15 — Switched to a new Supabase project

- The app now points at a new Supabase database/project instead of the
  old one. All database tables, security rules, and storage buckets
  were recreated on the new project by re-running every migration file
  in order, so nothing needed to be manually copied over.
- The three backend functions (inviting a user, deleting a user,
  generating monthly fees) were redeployed to the new project.
- No data carries over automatically from the old project — this was a
  fresh, empty database. If there was real student/coach/fee data on
  the old project that needs to move over, that's a separate data-export
  step, not something this change did.
- The local `.env` file (not checked into git) was updated with the new
  project's web address and public API key.

## 2026-09-15 — Real photos everywhere, and full delete/remove permissions for admins

- **Coaches can now have a photo**, uploaded the same way students'
  photos already were — pick a file when adding or editing a coach.
- **Every circle that used to show only initials now shows the real
  photo when one exists** — the Skaters list, a skater's own profile
  page, the Coaches list, a coach's own profile page, and the dashboard's
  "Needs attention" panel. This was mostly a display gap: student photos
  were already being collected, they just weren't being shown anywhere
  except the attendance-marking screen.
- **Admins can now permanently remove a coach**, not just deactivate one
  — for an account added by mistake. This fully deletes their login too
  (deactivating stays the option for a coach who's just on leave or
  left on good terms; anything they were assigned to is simply left
  with no coach, nothing else changes).
- **Batches got the admin controls they were missing**: a
  Deactivate/Reactivate toggle (the field already existed but had no
  button anywhere), and a permanent Remove for a batch created by
  mistake. Removing a batch is explained clearly in a confirmation
  dialog first, since — unlike removing a coach — it does delete that
  batch's schedule and attendance history along with it.

---

## 2026-09-15 — PRSA branding, and a mobile/tablet pass across the whole app

- **Branding.** The academy is now named "Professional Roller Skating
  Academy" (PRSA) everywhere in the app — browser tab title and icon,
  the sign-in/forgot-password/reset-password screens, the admin
  sidebar, and the coach and parent headers — using the logo supplied
  by the academy.
- **Fixed a broken preview caused by the branding change.** The logo
  files were added under `src/assets/`, but the app's `@` shortcut
  (used in imports like `@/assets/prsa-logo.png`) had never been told
  that folder existed, so every page that used the new logo failed to
  load. Both places that shortcut is configured (the dev server and
  the type checker) now know about `@/assets`.
- **Fixed a real mobile layout bug on the Attendance page.** Marking
  attendance for a session showed the batch name overlapping the time
  and the "X marked" label on a phone-sized screen, because the row
  was too narrow for everything on one line. It's now two lines
  (name, then time) so nothing overlaps. The per-skater marking list
  underneath had the same problem — a name, a status, and a dropdown
  squeezed into one line, with the dropdown pushed off the edge of the
  screen. It's now a simple stacked layout that never needs sideways
  scrolling to mark a skater present.
- **Fixed the "Levels & skills" list truncating names to a single
  letter on a phone** (e.g. "Intermediate 1" showing as "I…") — there
  wasn't room for the name once every action icon was accounted for.
  The skill-count badge now only shows on tablet and larger, freeing
  enough space for the level name to display properly on a phone.
- **Fixed the from/to date pickers cutting off the second date field**
  on a phone screen, on both the Reports page and the Attendance "by
  batch"/"by student" filters (both use the same shared date-range
  control) — the two dates now wrap onto a second line instead of
  running off the edge of the screen.
- **Every data table in the app** (Skaters, Coaches, Fees, Reports,
  the weekly Schedule grid, and the tabs above them) now shows a
  subtle shadow at the edge when there's more content to scroll to
  sideways, instead of just cutting off with no hint that there's
  more — this was the case behind several "the table doesn't fit"
  reports on narrow screens.

---

## 2026-09-15 — The academy admin dashboard, and four exportable reports

Every number here reads a Postgres view or RPC function — no chart
queries a table directly.

- **Dashboard** (now the admin's landing page) — four stat cards (active
  students, today's attendance, fees collected this month, outstanding
  dues), each with a trend against last month; a date-range selector
  (3/6/12 months); six charts (attendance trend, revenue collected vs
  expected, students per batch vs capacity, skill level distribution,
  retention, coach load); and **Needs attention** — a full-width panel,
  deliberately the heaviest thing on the page, listing every skater
  under 60% attendance in the last 30 days with a tap-to-call parent
  phone number and a note about who also has an overdue fee. Every
  chart has its own loading skeleton and its own empty state — nothing
  on this page renders blank. **Export PDF** captures the whole page as
  it's currently filtered.
- **Reports** (new "Reports" screen) — attendance, fee collection,
  student progress, and coach activity, each filterable by an explicit
  date range and batch, each exportable to CSV or a proper (not
  screenshot) PDF table.

---

## 2026-09-14 — Fee management: plans, generation, and manual payment recording

No payment gateway yet — every payment is recorded by an admin after
money changes hands some other way (cash, UPI, bank transfer, etc.).

- **Setup (admin)** — a "Fee plans" screen: name, amount, billing cycle
  (monthly/quarterly/annual), description. A plan is assigned to a
  skater right from their Add/Edit form, and their first invoice is
  generated immediately rather than waiting for the nightly job.
- **Generation** — a scheduled job (a new Edge Function, `generate-fees`,
  on a daily cron once you wire it up — see the runbook) creates each
  skater's next billing period once their current one has ended, and
  flips overdue fees automatically. Admins also get a "Generate now"
  button on the Fees screen for on-demand use.
- **Admin dashboard** (`/admin/fees`) — collected this month / pending /
  overdue, each with a count and an amount; a filterable fee list
  (status, month, batch); **Record payment** (supports paying less than
  the full amount — a partial payment — with the balance carried
  forward); **Waive** a fee with a required reason (kept on record);
  per-skater payment history; **Export CSV**.
- **Parent** — a new Fees screen (via the Fees card on Home): current
  dues with a status badge, and every past fee with its payments listed
  underneath like receipts.

Also fixed while testing this: the skater Add/Edit forms' Photo field was
crashing both screens outright (a leftover from Phase 1.1) — it's a plain
label now instead of a form-managed one, since a file input was never
part of the form's own validated state.

---

## 2026-09-14 — Skill progression: the feature that isn't just attendance

Skaters now climb a real progression ladder, not just get marked present
or absent.

- **Setup (admin)** — a "Levels & skills" screen to manage the ladder:
  add, edit, delete and drag-reorder levels, and the skills inside each
  one. Seeded with a realistic 9-level beginner-to-advanced ladder (45
  skills — forward/backward skating, stops, crossovers, edges, turns,
  spins, jumps) that was already in the sample data.
- **Coach** — from a session or a skater, open skill assessment: every
  skill in the skater's current level with a one-tap status (not
  started / learning / achieved) and an optional note. **Bulk assess**
  marks one skill across a whole batch at once. **Promote** appears once
  every skill in the level is achieved, with a confirmation — the server
  double-checks that before moving anyone on.
- **Parent** — a new "Progress" tab: which level their skater is on and
  how far along the ladder that is, the current level's skills as
  colorful reward tiles (not a checklist), a locked preview of what's
  next, and a history of what was achieved, when, and by which coach.
- **Admin** — a "Progress" report: how many active skaters are on each
  level (chart), and who hasn't achieved a skill in 30/60/90 days.

---

## 2026-09-14 — Vercel hosting set up; database types refreshed

- Added `vercel.json` so Vercel serves the app correctly on every URL
  (not just the home page) and knows how to build it. The runbook now
  has a "Deploying" section listing the environment variables Vercel
  needs and the Supabase URL settings to update.
- Migrations 0002–0005 and the invite Edge Function are now live on the
  Supabase project; the generated database types were regenerated from
  it and match what the code expected.

---

## 2026-09-14 — The app now looks like the design handoff

A visual pass over everything built so far, using the design files in
`docs/design`. Nothing about *what* the app does changed.

- **Admin console shell** — black left sidebar with the academy's
  wordmark ("Glide." with a red full stop), a white pill on the current
  section, and the active-skater count at the bottom. The top bar shows
  the academy name and current section, a global "Search skaters" box
  (press Enter to jump to the filtered skater list), a bell that goes to
  announcements with an unread count, and an identity menu with sign out.
- **Developer console shell** — dark throughout, with a full-width
  environment banner (blue for development, amber for staging, red for
  production) showing the Supabase host and build, a "Skating/dev" rail
  with Overview / Academies / Error log / Feature flags / Jobs and audit,
  and a header naming the current screen. The four new sections are
  placeholders until their phases arrive.
- **Sign-in, forgot- and reset-password pages** carry the wordmark.
- **Buttons, inputs, dropdowns, tables, tabs, cards, dialogs, toasts,
  loading shimmers and empty states** all match the design system —
  taller touch targets, thicker borders, underline-style tabs, and
  dialogs that slide up from the bottom on phones.
- Empty states now have a distinct red icon when something failed to
  load versus grey when there's simply nothing yet.

---

## 2026-09-14 — The parent app, and announcements with live notifications

Parents now have a proper app, not just an attendance page. **Home**
shows their skater (a dropdown if they have more than one), the next
session in a bold card, this month's attendance percentage, whether fees
are paid or due, and the latest announcement. Tabs along the bottom go to
the full **Schedule** (upcoming sessions, cancellations shown with the
reason), **Attendance** (six months, month by month), and **News**; the
icon top-right opens the parent's own **Profile** — edit name and phone,
see the skaters linked to the account, change password, sign out — and
from there the **child's profile** (level, age, batches, coach, and the
emergency contact and medical notes the academy has on file).

Admins can now post **announcements**: a title and message, who should
see it (everyone, parents, coaches, or one batch's families and coach),
publish now or schedule for a date and time, with an optional expiry.
Publishing creates a notification for every recipient. Parents and
coaches see the posts in a feed with a red dot on anything unread, the
tab shows an unread count, and tapping a post marks it read. New
notifications arrive live — no refresh — with a small toast.

Under the hood: queries no longer silently "pause" when the browser
thinks it's offline (which showed up as empty screens); they try and
report an error instead.

**Needs doing on Supabase:** run `0005_announcements.sql`. Parent and
coach feeds show posts without it; the admin Announcements page, unread
badges, mark-as-read and live updates need it.

## 2026-09-14 — Attendance: coach marking, admin tools, parent history

The daily screen. A coach opens **Today**, taps a session and gets the
roster with big ✓ / ✗ buttons per skater. The fastest path is one tap on
**Mark all present** and then tapping only the exceptions — each tap on a
row steps present → absent → late. A counter in the dark header shows
"12 of 15 marked" with a progress bar, and the confirm button turns red
once everyone is marked. Marks can be changed for 24 hours after the
session (in the academy's own timezone), then they lock — admins can
still correct them.

Rink wifi is unreliable, so confirming never waits on the network: the
marks are saved on the phone first, the coach sees "saved on this
device", a small "1 to sync" badge appears in the header, and the app
sends them as soon as it can — on its own, retrying every 20 seconds and
whenever the connection returns. Reopening the session shows what the
coach marked, even if it hasn't reached the server yet.

Admins get an **Attendance** page: by date (expand any session and
override a skater's mark from a dropdown — every change lands in the
audit log with the admin's name), by batch (each skater's percentage
over a date range, exportable to CSV), and by student (their full
session history with percentage, also exportable).

Parents now land on their child's attendance: overall percentage for the
last six months, then each month with its own percentage, counts and
session list — the same numbers the admin sees. If they have more than
one child, a dropdown switches between them.

The percentage rule is now covered by unit tests (present and late count
as attended; excused is ignored; nothing counted shows "—", not 0%).

**Needs doing on Supabase:** run `0004_attendance.sql`. Until then
coaches' saves queue up (visibly) and sync once it's in; admin and
parent views work now.

## 2026-09-14 — Batches and the weekly schedule

Under **Batches**, the admin now sees every class with its coach, time,
days and how full it is (the enrolled count turns amber at the last two
places and red when full), can create and edit batches (name, level
range, coach, capacity, time, days, venue), and open one to see its
roster and upcoming sessions. Skaters are enrolled from the batch page
with a dropdown; if the batch is full the app warns clearly but still
lets the admin go ahead. Removing a skater keeps their history.

**Generate schedule** on a batch page turns its weekly pattern into real
sessions for a chosen date range. It's safe to run again — days that
already have a session are left alone — and it skips holidays and any
day the coach is already booked at that time, then tells you exactly how
many it created and how many it skipped and why.

Under **Schedule**, a Monday-to-Sunday calendar shows every session
colour-coded by batch with the coach and skater count, today marked,
holidays flagged, and week-by-week navigation. From here the admin can
**cancel a session** (a reason is required, and every affected parent
gets a notification with it — one per parent even if two of their
children are in the batch), **add a one-off extra session** (it refuses
if the coach would be double-booked), and maintain the **holiday list**.

Coaches now land on a **Today** screen: their sessions today as bold
cards with time, batch, venue and skater count — cancelled ones greyed
with the reason.

Two safety rules worth knowing: editing a batch's time never rewrites
sessions that already exist unless you tick "also move upcoming
scheduled sessions" (and even then, past and cancelled sessions are
left alone); and adding a holiday doesn't cancel anything already on
the calendar — you cancel those yourself so parents are told why.

**Needs doing on Supabase:** run `0003_scheduling.sql` (RUNBOOK.md).
Browsing batches, the calendar, enrolling and the coach view all work
against the existing data; generating, cancelling and holidays need the
migration.

## 2026-09-14 — Students and coaches screens for the academy admin

The first real day-to-day screens. Under **Skaters**, the admin now sees
the full roster as a table — each skater's photo initials, parent, batch,
level, attendance percentage (colour-coded, with a bar), fee status, and
when they were last at the rink — ten at a time with Prev/Next, a search
box, and batch/status filters. Clicking a skater opens their profile:
contact details, emergency contact, medical notes, their coach and
parent's phone/email, with tabs for Attendance, Progress, Fees and Notes
that are placeholders until those features are built. From there the
admin can edit the skater or **archive** them (which hides them from the
active list but keeps everything on file — nothing is ever deleted, and
they can be restored with one click).

Adding a skater is a single form: their details, an optional photo, an
emergency contact, and their parent — either picked from parents already
in the system or a brand-new one, in which case the app creates the
parent's login and emails them an invite to set a password.

Under **Coaches**, the admin sees each coach with how many batches and
skaters they cover, can invite a new coach (same invite-email flow), edit
their details, and deactivate/reactivate them.

The whole admin area now follows the design handoff in `docs/design/`:
the dark left sidebar with a white highlight on the current section,
the Archivo typeface, the red-accent focus rings and status pill colours,
and the rounded card style. Coach screens had no mockup, so they copy the
student screens' look.

**Two things need doing on the Supabase side before every part of this
works** — both are in RUNBOOK.md: run the new `0002_storage.sql`
migration (for photo uploads) and deploy the `invite-user` function (for
sending invites). Everything else — browsing, searching, editing,
archiving, linking an existing parent — works right now against the
seeded data and was checked in a browser.

## 2026-09-14 — Login, roles, and the app's overall shell

Built the part of the app everyone touches before anything else: signing
in. There's now a login page, "forgot password" and "set a new password"
pages, and the app remembers who's signed in and automatically renews
that sign-in in the background so people aren't logged out mid-session
for no reason. If a sign-in genuinely does expire, they see a clear
"please log in again" message instead of just being bounced with no
explanation.

Each of the four roles — super admin, academy admin, coach, parent — now
lands on its own home screen after login (still empty/placeholder
screens, the real dashboards come in later phases) and can't wander into
another role's screens. The admin screen has a sidebar that collapses
into a slide-out menu on phones; the coach and parent screens are
mobile-first with a bottom tab bar; the super-admin console is
deliberately dark and shows a loud banner naming which environment
(development/staging/production) it's talking to, so it's never
mistaken for the regular admin view.

Also wired up: toast notifications, a friendly "something went wrong"
screen instead of a blank crash, Sentry error tracking, and a GitHub
Actions check that runs on every push and fails the build if the code
doesn't type-check, isn't linted, breaks a test, or fails to build. Wrote
one automated browser test that logs in as each of the four roles and
confirms each lands in the right place — this passed against the real
seeded Supabase project before this session ended.

No real business screens yet (student lists, attendance, fees, etc.) —
this is the login/navigation skeleton those get built inside, starting
Phase 1.

## 2026-09-14 — Complete database schema and demo data

Built the entire database for the app as a single migration file
(`supabase/migrations/0001_initial_schema.sql`) — every table (academies,
people, students, batches, schedule, attendance, skill progression, fees,
payments, announcements, notifications, and the platform's own audit/error
logs and feature flags), all the security rules that keep one academy's
data invisible to another, and the calculations the dashboard will read
from later (attendance percentages, monthly fee collection, "students who
need attention").

Also wrote `supabase/seed.sql` — realistic demo data for one academy
("Glide Skating Academy" in Bengaluru): 3 coaches, 40 students with
parent logins, 9 skating levels with 5 skills each, 6 class batches, about
three months of attendance history, and three months of fees and
payments including a few overdue and partially-paid examples. Every demo
login uses the password `Password123!`.

Nothing in the app reads this data yet — that starts in Phase 1. This
session only builds the ground the features stand on. See
[DATA-MODEL.md](./DATA-MODEL.md) for the full table-by-table reference and
[RUNBOOK.md](./RUNBOOK.md) for how to apply it to a Supabase project.

## 2026-09-13 — Project foundation

Set up the empty project: the tools it's built with (React, Tailwind,
Supabase, etc.), the folder structure every feature will follow, code
style checks, and a starter test for both the fast (unit) and slow
(full app in a browser) kinds of tests. No actual app features yet —
this is the empty scaffolding everything else gets built on top of.

Also wrote the ground rules in `CLAUDE.md` so every future session
follows the same structure, and set up the documentation files
(this one included) that every session is expected to keep up to date.
