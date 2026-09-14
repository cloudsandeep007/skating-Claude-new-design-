# Architecture decision log

Newest first. One entry per real choice made — not every line of code,
but anything a future session (or future you) would otherwise have to
re-derive or might accidentally reverse.

Format:

```
## YYYY-MM-DD — <short decision title>

**Decision:** what was decided.
**Options considered:** the alternatives and why they were on the table.
**Why:** the reasoning that picked the option above.
**Trade-offs:** what this costs or risks, and when to revisit it.
```

---

## 2026-09-15 — Scroll-shadow affordance for overflowing tables, instead of restructuring every table for mobile

**Decision:** Every horizontally-scrollable table/grid in the app (the
shared `Table` component, the schedule week grid, the reports table
wrapper, and the shared tabs list) gets a `.scroll-shadow-x` utility
class (defined once in `index.css`) — a CSS-only edge shadow that
shows while there's more content to scroll to, using the classic
`background-attachment: local, scroll` trick, no JavaScript.

**Options considered:** (a) leave tables as plain `overflow-x-auto`
with no visual hint that they scroll; (b) restructure every table into
a stacked card layout below a breakpoint, the way the parent app's
Attendance history already does; (c) a CSS-only scroll-shadow on the
existing table markup.

**Why:** A table that's wider than the screen but gives no visual hint
that it scrolls looks broken, not scrollable — this is what was behind
several "the table just doesn't fit" reports. Restructuring every
admin list/report table into cards (option b) would have been the more
thorough mobile treatment, but it's a much larger change across many
features for a phase whose scope was auditing and fixing, not
redesigning; the parent app's own history views already use that card
pattern where a table would have been genuinely unusable (see the
per-skater attendance-marking fix below). The scroll-shadow is a
one-file, zero-JS fix that makes every existing table's real
scrollability visible without changing any table's markup or data.

**Trade-offs:** Wide tables (Fees, Reports, weekly Schedule) still
require horizontal scrolling on a phone — the shadow makes that
discoverable, it doesn't remove the scrolling itself. If a specific
table's mobile experience still feels cramped, restructuring that one
table into a card list (as was done for the Attendance per-skater
marking rows, which needed direct interaction and couldn't rely on
just scrolling) is the next step, not a blanket rule.

---

## 2026-09-15 — Attendance marking rows rebuilt as flex layouts instead of a table, on mobile

**Decision:** The per-session row on the admin Attendance "By date" tab,
and the per-skater roster row inside it (name, status badge, override
dropdown), were rebuilt from a fixed-height single-line layout (and a
3-column `Table`, for the roster) into flex layouts that wrap onto
their own lines.

**Options considered:** (a) leave the fixed-height/fixed-width layout
and rely on the new scroll-shadow for discoverability; (b) rebuild as
a layout that never needs horizontal scrolling.

**Why:** Unlike a read-only report table, marking attendance is a
direct per-row action (tap a status). Losing sight of *whose* row
you're editing while scrolling sideways to reach the dropdown is a
real usability problem, not just a discoverability one — this was the
cause of the batch name visually overlapping the time and the "marked"
count on a phone. Scrolling is the right trade-off for a report you
mostly read; it's the wrong one for a control you're actively using.

**Trade-offs:** None significant — the change is purely layout
(flex-wrap instead of a table/fixed-width row); no data, props, or
interaction logic changed.

---

## 2026-09-15 — PDF export libraries are dynamically imported, never at module scope

**Decision:** `shared/lib/pdf.ts`'s two exported functions each
`import('jspdf')` / `import('jspdf-autotable')` / `import('html2canvas')`
inside the function body, not as top-of-file imports.

**Options considered:** (a) normal static imports, simplest code; (b)
dynamic `import()` inside each export function.

**Why:** jsPDF + html2canvas + jspdf-autotable together are roughly
600KB minified. A static import pulls them into whatever chunk
references `pdf.ts`, which — since the Dashboard and Reports pages both
import it directly — means every visitor downloads the whole PDF
toolchain on page load whether or not they ever click an export button.
Confirmed by measurement: the main bundle dropped from 2.23MB to 1.60MB
(gzip 650KB → 461KB) switching to dynamic imports, with zero change to
when or how export actually runs (Vite/Rollup code-splits the dynamic
import into its own chunk automatically, fetched on first click).

**Trade-offs:** The first export click on a fresh page load has a brief
extra network fetch before the PDF starts generating (both export
buttons already show a pending/"Exporting…" state, so this reads as
normal loading, not a stall). Every other feature keeps the "boring"
static-import default — this exception applies specifically because the
library weight is large and the usage is optional/occasional, not
because dynamic imports are the new default policy.

---

## 2026-09-14 — Partial payments use balance math, not a fifth fee status

**Decision:** `student_fees.status` stays the original four values
(pending/paid/overdue/waived). A partial payment is fully recorded in
`payments` and reflected in the computed balance everywhere it's shown;
status only flips to `paid` once payments sum to the full amount.

**Options considered:** (a) add a `partial` status, flipped on the first
payment; (b) leave status alone and derive "how much is left" from
`payments` at read time.

**Why:** A `partial` status doesn't actually carry more information than
`amount - sum(payments)` already does, and it opens a bug class: does a
second partial payment reaching 100% need explicit code to flip
`partial → paid`, and does an admin correcting an over-recorded payment
need code to flip back? (b) has one rule ("paid once fully covered") that
both the generation RPC and the UI apply identically, instead of a status
machine with more states than the business actually needed.

**Trade-offs:** Every screen showing a fee's status must also fetch/sum
its payments to show the balance correctly (`student_fees_list()` and
`useStudentFees()` both pre-compute this so no screen does it by hand).
A quick "show me all partially-paid fees" filter isn't a single `WHERE
status = 'partial'` — it's `WHERE status IN ('pending','overdue') AND
paid > 0`, which the admin fee list doesn't currently expose as a filter
(revisit if it's asked for).

---

## 2026-09-14 — One fee RPC serves both the admin's manual trigger and the scheduled job

**Decision:** `generate_upcoming_fees(p_academy_id default null)` and
`mark_fees_overdue()` are both `SECURITY INVOKER` with no internal
academy check. The admin's "Generate now" button calls the first with
their own `academy_id`; the scheduled Edge Function calls both with the
service-role key and no academy filter.

**Options considered:** (a) two separate functions — one `SECURITY
DEFINER` for the cron path with its own academy-loop, one plain one for
the admin button; (b) one function, relying on RLS to scope the admin
path and the service-role key's RLS bypass to cover every academy for
the cron path.

**Why:** (b) means the generation *logic* — which students are eligible,
what period comes next — exists in exactly one place, so a future rule
change can't accidentally diverge between "admin clicks a button" and
"the nightly job runs". The two callers differ only in *auth context*,
which RLS already exists to handle; writing a second function to
re-implement that would just be duplicating what Postgres does for free.

**Trade-offs:** Anyone reading `generate_upcoming_fees()` in isolation
might assume it's always academy-scoped, since there's no visible check
— the DATA-MODEL.md entry and the function's own comment exist
specifically to make the dual-purpose design discoverable. The
scheduling step itself (wiring an actual cron trigger to the Edge
Function) is a one-time manual step in the Supabase Dashboard or a SQL
snippet the user fills in with their own key — see RUNBOOK.md — rather
than something this migration can set up unattended, since that would
require embedding a service-role key in a committed file.

---

## 2026-09-14 — Skill promotion is a SECURITY DEFINER RPC, not a wider RLS policy

**Decision:** `promote_student()` runs as SECURITY DEFINER and re-checks
the caller's role and academy internally, rather than adding a coach
UPDATE policy on `students`. Reordering (`reorder_levels`/`reorder_skills`)
and the two admin reports stay SECURITY INVOKER, relying entirely on the
existing `levels`/`skills` RLS.

**Options considered:** (a) add a narrow coach UPDATE policy on `students`
restricted to `current_level_id`; (b) a SECURITY DEFINER function that
re-validates permission and the "all skills achieved" business rule
before writing.

**Why:** Postgres RLS can't restrict an UPDATE to one column — a coach
policy on `students` would, in practice, let a coach's client update any
column on any student row in their academy (student status, medical
notes, emergency contact) as long as the request also touched
`current_level_id`, unless every other column were pinned to its old
value in the policy's WITH CHECK, which is fragile and easy to break in
a later migration. A SECURITY DEFINER function with an explicit
permission check and an explicit single UPDATE statement has no such
surface — it can only ever do the one thing it's written to do.

**Trade-offs:** Business logic (the promotion gate) now lives in SQL
instead of RLS+app code, which is less visible than a policy — the
DATA-MODEL.md entry exists specifically to make it discoverable. The
existing `audit_students` trigger still fires (it's a normal UPDATE
inside the function), so promotions are still in the audit trail with no
extra code.

---

## 2026-09-14 — Design system is applied by retuning shadcn class strings, not by wrapping every primitive

**Decision:** The class strings inside `src/shared/ui/*` (button, input,
textarea, select, table, tabs, card, dialog, alert-dialog, skeleton,
sonner) are edited to match the handoff in `docs/design/handoff/…` —
48px inputs with 1.5px neutral borders, ink primary buttons, red-outline
destructive, underline tabs, bottom-sheet dialogs under `sm`, shimmer
skeletons, ink-filled toasts. Component structure, props, and behaviour
stay exactly as generated by shadcn.

**Options considered:** (a) leave shadcn defaults and override with
`className` at every call site; (b) wrap every primitive in a
`shared/ui/Skating*` component; (c) edit the class strings in place.

**Why:** (a) scatters the design across hundreds of call sites and drifts
immediately; (b) doubles the component surface for no behavioural gain;
(c) keeps one source of truth per primitive and every feature gets the
look for free. The CLAUDE.md "don't hand-edit" rule was about variant
*logic* and props — it now says so explicitly.

**Trade-offs:** Re-running `npx shadcn add <component>` would overwrite
the tuning — re-apply from git history if that ever happens. Layouts
that need more than a primitive (the admin sidebar, dev console rail,
EmptyState, StatusBadge) are still separate components.

---

## 2026-09-14 — Announcement fan-out is lazy (on feed load), not a cron job

**Decision:** `publish_due_announcements()` creates notification rows for
every due, un-notified announcement in the caller's academy. The app calls
it right after an admin publishes and at the top of every feed/admin-list
load. `notified_at` makes it exactly-once.

**Options considered:** (a) Fan out in the client at creation time — but
then a *scheduled* post would have to be fanned out by whoever's browser
happens to be open at the right moment, or not at all; (b) `pg_cron`
every minute.

**Why:** (b) needs the extension enabled per project and a variant of the
function that loops academies; it's documented in RUNBOOK.md as the
upgrade path. The lazy call costs one cheap indexed query per feed load
and needs no infrastructure. For an academy whose parents open the app
daily, "goes out when someone next opens the app" is indistinguishable
from a cron for a message scheduled for the morning.

**Trade-offs:** A scheduled post could be late by however long nobody
opens the app. The function is `SECURITY DEFINER` (it writes rows for
other users) but scoped to the caller's academy and to posts an admin
already published — it can't be used to send anything new.

## 2026-09-14 — TanStack Query runs in `networkMode: 'always'`

**Decision:** Queries and mutations don't pause when the browser reports
offline; they attempt the request and fail normally.

**Why:** The default mode leaves a query at `status: 'pending'` with
`fetchStatus: 'paused'` — no error, no data — which every list screen
renders as "nothing here yet". That's actively misleading on rink wifi,
where a parent would rather see "couldn't load, try again". The one write
that must survive offline (attendance) has its own persisted queue.

**Trade-offs:** Requests made while genuinely offline fail immediately
instead of waiting for reconnect; TanStack's `retry: 1` softens that.

## 2026-09-14 — Read state comes from the reader's own notification row

**Decision:** "Unread" for an announcement means "this user has a
`notifications` row for it with `read_at is null`". The feed joins the
two; marking read updates that row. There is no separate
`announcement_reads` table.

**Why:** The notification row already exists per recipient and the
unread nav badge already counts `read_at is null` across all types, so
one mechanism serves cancelled-session notices and announcements alike.
A post someone can *see* but wasn't *notified* about (published before
they joined) simply has no dot — correct, and free.

## 2026-09-14 — Attendance saves are queued locally first, then synced

**Decision:** Confirm on the coach's attendance screen writes the marks to
a persisted Zustand store (`localStorage`) and returns immediately; a
background loop pushes each queued session to the `save_attendance` RPC
and retries on reconnect and every 20 s until the server confirms.

**Options considered:** (a) A normal mutation with TanStack Query's
`retry` — retries a few times, then the marks are gone if the tab closes;
(b) full offline-first with a service worker and IndexedDB.

**Why:** The brief is a rink with flaky wifi. (a) loses data exactly when
it matters. (b) is the right long-term shape for Phase 4 (native shells)
but is a lot of machinery for one screen today. A tiny persisted queue
gets the important property — *a confirmed save is never lost* — with
~60 lines, and the UI can honestly say "saved on this device".

**Trade-offs:** Zustand now holds something more than trivial UI state
(still client-only, not a server cache — the rule in CLAUDE.md holds). A
permanently rejected save (e.g. synced after the 24 h lock) sits in the
queue with its error; a discard control is a known gap.

## 2026-09-14 — The 24-hour lock lives in RLS, in the academy's timezone

**Decision:** `session_is_editable()` is the single source of truth,
called from the coach `attendance` policies; the UI only mirrors it. It
converts the session's date/time using `academies.settings->>'timezone'`.

**Options considered:** Checking the window in the app only; comparing
against `now()` in server time.

**Why:** A client-only check is trivially bypassed and drifts. Server
time is UTC — for a Kolkata evening session that silently adds 5½ hours
to the window. Reading the academy's own timezone setting makes the rule
mean what the admin thinks it means, per academy.

**Trade-offs:** The function is `SECURITY DEFINER` so it can read
`academies.settings` for the session's academy regardless of the caller;
it only returns a boolean, so nothing leaks.

## 2026-09-14 — One attendance rule, implemented twice, tested once

**Decision:** `features/attendance/hooks/attendancePct.ts` re-implements
the SQL views' percentage rule in TypeScript (for the parent's monthly
summary and the "by student" admin view, where per-month grouping is
easier client-side), with unit tests that pin the exact numbers.

**Why:** The parent must see the same number the admin's roster shows.
The tests encode the view definition (`(present+late)/(present+absent+late)`,
excused excluded, one decimal, null when nothing counts) so a future
change to either side is caught.

**Trade-offs:** Two implementations to keep in step. If a third consumer
appears, promote the per-month grouping to a view and delete the TS copy.

## 2026-09-14 — Schedule generation and cancellation are Postgres functions, not client loops

**Decision:** `generate_sessions()` and `cancel_session()` live in
`0003_scheduling.sql` and the app calls them via `supabase.rpc()`.

**Options considered:** Computing the dates in the browser and bulk
inserting; cancelling with an `update` then a separate `insert` into
notifications from the client.

**Why:** Generation needs three checks per day (holiday, already exists,
coach overlap) against *current* data — done client-side that's several
round trips per batch and a race if two admins generate at once. In one
function it's a single transaction. Cancel-and-notify must be atomic: a
cancelled session with no notifications, or notifications for a session
that failed to cancel, are both worse than either failing outright. Both
functions are `SECURITY INVOKER`, so they add no new privilege — RLS on
the underlying tables still decides.

**Trade-offs:** Business logic in SQL is less visible to a JS-only
reader; both functions are short and documented in DATA-MODEL.md. The
return shape of `generate_sessions` (one row per day with an outcome)
exists precisely so the UI can explain what it skipped and why.

## 2026-09-14 — Sessions own their time; editing a batch is opt-in for future sessions

**Decision:** `schedule_sessions` stores `start_time`, `end_time` and
`coach_id` per row (copied from the batch at generation). Editing a
batch changes the rule only; a checkbox on the edit form optionally moves
future *scheduled* sessions to match. Completed/cancelled sessions are
never touched.

**Options considered:** (a) Sessions reference the batch's time at read
time (no per-session copy); (b) always rewrite future sessions on edit.

**Why:** (a) rewrites history — a session that happened at 5 PM would
retroactively display as 6 PM after a batch change, and attendance
records would look wrong. (b) surprises admins who changed a batch for
next term but had already told parents this week's times. Explicit
opt-in with a clear label is the boring, safe option.

**Trade-offs:** Removing a day from `days_of_week` leaves sessions on
that day in place; the admin cancels them. Documented in the feature doc.

## 2026-09-14 — Holidays affect generation only, never existing sessions

**Decision:** Adding a holiday doesn't cancel sessions already on that
date; extra (one-off) sessions may be placed on a holiday.

**Why:** Cancelling notifies parents with a reason — that should be a
deliberate act per session, not a side effect of a calendar entry. And
a holiday is exactly when an academy might run a special extra session.

## 2026-09-14 — Dates are local `YYYY-MM-DD` strings, never `toISOString()`

**Decision:** `shared/lib/format.ts` (`todayIso`, `addDays`, `toIsoDate`)
builds dates from local `getFullYear/getMonth/getDate`; the first pass at
this feature used `new Date().toISOString().slice(0, 10)` and was fixed.

**Why:** `toISOString()` is UTC. In IST (UTC+5:30), from 18:30 local
onward it returns *tomorrow's* date — "today's sessions" would be wrong
every evening, exactly when evening batches run.

## 2026-09-14 — Batch colour on the calendar is hashed from the batch id

**Decision:** `schedule/hooks/batchColor.ts` picks one of six design-
system ramps by hashing the batch id, rather than storing a colour column.

**Why:** No schema change, stable across reloads and weeks, no UI to
manage. Six batches → six colours; a seventh wraps. Acceptable until an
academy has enough batches that collisions bother someone — then add a
`color` column and keep this as the fallback.

## 2026-09-14 — Account creation goes through an Edge Function, never the browser

**Decision:** New parent and coach accounts are created by
`supabase/functions/invite-user`, which runs with the service-role key
server-side. The frontend only ever calls it via
`supabase.functions.invoke` (wrapped in `shared/lib/invokeFunction`).

**Options considered:** (a) Ship the service-role key to the browser and
call `auth.admin.inviteUserByEmail` from the app; (b) Have the admin
create the login manually in the Supabase dashboard and only link it in
the app; (c) An Edge Function.

**Why:** (a) is a hard no — the service-role key bypasses every RLS policy
in the database; anyone who opens DevTools would own every academy's
data. (b) doesn't meet the "creates their account and sends an invite"
requirement and is a bad admin experience. (c) is the only option that is
both secure and one-click: the function verifies the *caller's* JWT is an
`academy_admin` before doing anything privileged, so the endpoint can't be
abused even though it's publicly reachable.

**Trade-offs:** One more thing to deploy (`supabase functions deploy`),
documented in RUNBOOK.md. It runs on Deno, so it lives outside the app's
tsconfig/ESLint (excluded in `eslint.config.js`). One function handles
both roles rather than two near-identical ones — simpler to deploy and
reason about.

## 2026-09-14 — Student photos in a private bucket, path stored, signed URL at display time

**Decision:** `student-photos` is a private Storage bucket;
`students.photo_url` holds the object path (`<academy>/<student>/photo.ext`),
and the app resolves it to a 1-hour signed URL when rendering.

**Options considered:** A public bucket storing the permanent public URL
(simpler — one field, no signing step).

**Why:** These are photos of children. A public bucket means anyone with
the URL can view them forever, and URLs leak (screenshots, shared links,
browser history). A private bucket with folder-per-academy RLS means the
same tenancy rules as the tables apply to photos.

**Trade-offs:** One extra call per displayed photo (cheap, cacheable). The
avatar currently shows initials and the signed-URL resolver isn't wired
in yet — noted in the students feature doc.

## 2026-09-14 — Flat parent-link schema instead of a Zod discriminated union

**Decision:** `ParentLinkSchema` in `features/students/types.ts` is one
flat object with a `mode` field and all other fields optional; which ones
are required per mode is enforced in `.superRefine`, not the type system.

**Options considered:** `z.discriminatedUnion('mode', [Existing, New])` —
the "correct" modelling, and what I wrote first.

**Why:** react-hook-form's `Path<T>` type helper is recursive, and a
discriminated union nested inside a larger form type made TypeScript's
memory use explode during `tsc` (a known RHF + Zod interaction). The flat
shape type-checks in a fraction of the time and the runtime validation is
identical for the user.

**Trade-offs:** The API layer (`linkParent`) has to re-check the fields
it needs rather than getting narrowing for free — two explicit `if
(!x) throw` guards. Worth it for a build that finishes.

## 2026-09-14 — Students list merges four lookups client-side rather than a bespoke view

**Decision:** `api/listStudents.ts` runs one paginated query for the
student rows (with batch and level embedded via foreign keys), then four
small `.in('student_id', ids)` lookups for attendance %, latest fee,
last-active and parent name, and merges them in the query function.

**Options considered:** (a) A new Postgres view `student_roster` joining
everything, then one query; (b) One giant PostgREST embed.

**Why:** (b) isn't possible — attendance % comes from a view, and
PostgREST can't embed a view without a foreign-key relationship it can
see. (a) is cleaner long-term but means another migration and view to
maintain right now for a list of 10 rows per page; the four lookups are
each a single indexed `IN (...)` on the visible ids and run in parallel.
It still honours the real rule ("charts never aggregate raw tables"):
attendance % is read from `student_attendance_summary`, not recomputed.

**Trade-offs:** Five requests per page instead of one. If the roster page
ever feels slow, promote this to a view — the merge logic is in one
function, so the swap is local. Revisit when the dashboard (Phase 3)
adds its own roster-shaped queries anyway.

## 2026-09-14 — Design tokens applied globally; component variants left as shadcn defaults

**Decision:** The design system's palette, Archivo font and radius scale
are wired into `index.css`/`tailwind.config.js` so every shadcn component
picks them up; the raw ramps (`brand-*`, `success-*`, `warning-*`,
`info-*`) are available for spot colours. Status pills are a small
wrapper (`shared/ui/StatusBadge`) rather than edits to `badge.tsx`. Button
variants (e.g. the design's outline-style "destructive") stay as shadcn
ships them.

**Options considered:** Hand-tuning every shadcn component's variant
classes to match each hover/focus/disabled state in the mockup.

**Why:** The tokens carry ~90% of the look (ink primary, red focus ring,
12px cards, the type ramp) for zero per-component work, and CLAUDE.md
says not to hand-edit generated variant boilerplate. Coaches had no
design mockup at all, so they reuse the students screens' patterns.

**Trade-offs:** A few states are visibly "shadcn default" rather than
pixel-matched (solid red destructive button vs the design's outline
style; badge weight). Flag them if they matter and they become a
wrapper each, not a rewrite.

## 2026-09-14 — `npm run lint` runs Node with a 4 GB heap

**Decision:** The `lint` script is `node --max-old-space-size=4096
node_modules/eslint/bin/eslint.js .` rather than plain `eslint .`.

**Why:** typescript-eslint's type-aware rules load the whole program into
memory; once the students/coaches features landed, `eslint .` ran out of
heap on the development machine (which had <500 MB free at the time).
Baking the flag into the script means it works the same locally and in
CI without anyone remembering an env var. Invoking eslint's entry file
directly is what makes the flag cross-platform (a `NODE_OPTIONS=` prefix
doesn't work in Windows `cmd`).

## 2026-09-14 — react-router data router (`createBrowserRouter`) over declarative `<Routes>`

**Decision:** Route the app with `createBrowserRouter([...]) `+ `<RouterProvider>`
instead of nesting `<Routes>`/`<Route>` JSX in `App.tsx`.

**Options considered:** The classic declarative `<BrowserRouter><Routes>`
API, which is simpler for a handful of static routes.

**Why:** The data router gives every route an `errorElement` for free —
a render error in one route shows a friendly fallback there instead of
crashing routes that have nothing to do with it. Role-based route
protection also reads more clearly as its own layout route
(`<ProtectedRoute allowedRoles={[...]}>` wrapping a layout's children)
than as a wrapper component repeated in JSX at every branch.

**Trade-offs:** Slightly more indirection to read the route tree (it's a
plain array of objects in `app/routes/router.tsx`, not JSX) — acceptable
since it's one file and rarely touched once a role's routes exist.

## 2026-09-14 — Auth session state lives in a hand-written context, not TanStack Query

**Decision:** `useAuthSession` (backing `<AuthProvider>`) manages
`{ session, profile, status }` with plain `useState` + a
`supabase.auth.onAuthStateChange` subscription, not a `useQuery`.

**Options considered:** Modeling the session as a TanStack Query query
(e.g. `useQuery(['session'], ...)`), which the rest of the app's data
fetching uses.

**Why:** TanStack Query's model is "fetch on demand, refetch on
triggers"; auth session changes are **pushed** by Supabase's own
`onAuthStateChange` listener (sign-in, sign-out, token auto-refresh) —
there's nothing to poll or refetch. Forcing that through `useQuery` would
mean manually calling `queryClient.setQueryData` from inside the
subscription anyway, which is no simpler than just holding the state
directly. Profile *fetching* still goes through a plain async function
(`fetchProfile`) in `features/auth/api/`, matching the "data access
lives in `api/`" rule even though it isn't itself a `useQuery` hook.

**Trade-offs:** Auth state isn't visible in TanStack Query's devtools
alongside other server state. Acceptable — it's a single provider at the
app root, not data a feature screen fetches.

## 2026-09-14 — Distinguishing "signed out" from "session expired"

**Decision:** `useAuthSession` sets a ref flag immediately before calling
`supabase.auth.signOut()`; the `onAuthStateChange` listener only shows
the "your session expired" toast for a `SIGNED_OUT` event when that flag
is *not* set, then always clears it.

**Options considered:** Showing the expiry toast on every `SIGNED_OUT`
event.

**Why:** Supabase fires the identical `SIGNED_OUT` event whether the user
clicked "sign out" or a background token refresh failed — the SDK gives
no other way to tell them apart. Toasting "your session expired" right
after someone deliberately signs out would be confusing and wrong.

**Trade-offs:** A ref (not state) is the right tool here since setting it
must happen synchronously *before* the `signOut()` call that triggers the
listener — a state update wouldn't be committed in time. None otherwise.

## 2026-09-14 — RLS via SECURITY DEFINER helper functions, called as `(select fn())`

**Decision:** All role/tenancy checks in RLS policies go through six
`STABLE SECURITY DEFINER` helper functions (`current_user_role()`,
`current_academy_id()`, `is_super_admin()`, `is_academy_admin()`,
`is_coach()`, `is_parent()`, plus `parent_student_ids()` /
`parent_batch_ids()` for the parent role) instead of inlining a subquery
against `profiles` in every policy. Every call site wraps them as
`(select fn())` rather than calling them bare.

**Options considered:** Inlining `(select academy_id from profiles where
id = auth.uid())` directly in each policy — works, but duplicated across
~60 policies and error-prone to keep consistent. A JWT custom claim for
role/academy_id — avoids the extra table read entirely, but needs a
Postgres trigger or Edge Function to keep the claim in sync whenever a
profile's role or academy changes, which is more moving parts than this
project needs yet.

**Why:** `SECURITY DEFINER` lets the function read `profiles` without
tripping that same table's RLS (it runs as the function owner, who owns
the table and is therefore exempt from RLS on it) — this is the pattern
Supabase's own RLS performance docs recommend. Wrapping every call as
`(select fn())` turns it into an `InitPlan` that Postgres evaluates once
per statement instead of once per row; without the `select` wrapper, a
`STABLE` function can still get re-invoked per row on some query plans.

**Trade-offs:** An extra function call (cached per-statement) on every
RLS-checked query. If this ever needs to scale past caching it well,
revisit the JWT-claim approach — but don't do it preemptively.

## 2026-09-14 — Composite foreign keys `(id, academy_id)` for tenant integrity

**Decision:** Every child table's foreign key back to its parent includes
`academy_id`, e.g. `foreign key (batch_id, academy_id) references batches
(id, academy_id)`, which requires a `unique (id, academy_id)` constraint
on every parent table.

**Options considered:** A single-column FK on just the parent's `id`,
relying on RLS and application code to keep `academy_id` consistent
between a row and its parent.

**Why:** With a single-column FK, a bug in application code (or a
mistake in a future migration/seed script) could insert, say, an
`attendance` row with the wrong `academy_id` pointing at a session that
belongs to a different academy — RLS would still mostly hide the mess
from other tenants, but the data itself would be silently corrupt. The
composite FK makes that combination physically impossible to insert:
Postgres rejects it at the constraint level, before RLS is ever
evaluated. This is the standard defense-in-depth pattern for multi-tenant
Postgres schemas.

**Trade-offs:** One extra unique index per parent table, and every insert
into a child table must carry the correct `academy_id` explicitly (it
can't be inferred from the parent alone) — acceptable since the API layer
always has the current user's `academy_id` in context.

## 2026-09-14 — `ON DELETE SET NULL (column)` for single-column nulling on composite FKs

**Decision:** Where a child row should survive its optional parent being
deleted (e.g. `students.current_level_id` when a level is deleted,
`batches.coach_id` when a coach is deleted), the composite FK uses
Postgres 15's column-list form: `on delete set null (current_level_id)`
— nulling only that column, not the whole FK tuple.

**Options considered:** Plain `on delete set null` on the composite FK.

**Why:** A composite FK is `(current_level_id, academy_id)`. Plain `on
delete set null` nulls **every** column in the FK, which would try to
null `academy_id` too — but `academy_id` is `not null` on `students`, so
deleting a level would raise a constraint violation instead of quietly
detaching the student from it. The column-list form (added in Postgres
15) nulls only `current_level_id` and leaves `academy_id` untouched.

**Trade-offs:** Requires Postgres 15+ — confirmed fine, since
`supabase/config.toml` (from `supabase init`) targets major version 17
and Supabase Cloud runs 15+ on every current project.

## 2026-09-14 — `nullif()` around every attendance-percentage division

**Decision:** Every place attendance percentage is computed
(`student_attendance_summary`, `batch_attendance_summary`,
`at_risk_students`, `attendance_summary_for_range()`,
`at_risk_students_for()`) divides by `nullif(counted_sessions, 0)`, never
by the bare column — even in `at_risk_students`, where the `WHERE` clause
already has `counted_sessions >= 3` as a separate condition.

**Why:** Postgres does not guarantee that `AND` evaluates its operands
left-to-right, so `counted_sessions >= 3 AND pct < 60` does not
reliably short-circuit before the division runs — a student with 0
counted sessions in the window (all attendance rows `excused`, which
don't count either way) could hit a division-by-zero error depending on
how the planner orders the check. `nullif` removes the possibility
entirely: it returns `NULL` instead of dividing by zero, and `NULL`
compared to anything is `NULL` (not an error), which `AND` correctly
treats as excluding the row.

**Trade-offs:** None — this is strictly safer with no behavior change
for the normal case.

## 2026-09-13 — Project foundation scaffolded

**Decision:** Vite + React 18 + TypeScript (strict) + Tailwind + shadcn/ui,
with the feature-folder architecture described in CLAUDE.md, TanStack
Query for server state, Zustand for local UI state, React Hook Form +
Zod for forms, React Router for routing, Recharts for charts, Supabase
for backend, Vitest + Playwright for testing, Sentry for error tracking.

**Options considered:** Next.js was not considered — this is a
client-rendered SPA today (no SSR requirement), and Vite's dev
experience is simpler for a non-coder-led workflow. Redux/Context were
not chosen for server state — TanStack Query is a better fit since
almost all state here is Supabase data.

**Why:** Matches the stack specified for this project; each library has
one clear job so a future session (or an AI tool with no memory of past
sessions) can guess correctly which tool handles what.

**Trade-offs:** No SSR/SEO — acceptable since this is an authenticated
app, not a public marketing site. Revisit only if a public-facing
marketing/booking page (Phase 6 "Trial bookings") needs SEO.

## 2026-09-13 — React pinned to v18, not v19

**Decision:** Pin `react` and `react-dom` to `^18` even though `npm create
vite` scaffolds React 19 by default.

**Options considered:** Staying on the scaffolded React 19.

**Why:** The stack was specified as React 18; some libraries in this
ecosystem (Capacitor community plugins in particular, needed in Phase 4)
have historically lagged behind major React versions.

**Trade-offs:** Will need a deliberate upgrade decision later if a
library ends up requiring React 19.

## 2026-09-13 — jsdom pinned to v25, not the latest v26/v30

**Decision:** Use `jsdom@25` for Vitest's test environment instead of the
version npm installs by default.

**Options considered:** Latest jsdom (v30 at time of writing).

**Why:** The dev machine runs Node 20.10, and jsdom's newer versions pull
in `html-encoding-sniffer` → `@exodus/bytes`, which throws
`ERR_REQUIRE_ESM` under Node < ~20.19 due to a CJS/ESM interop bug in
that dependency chain. jsdom 25 predates that dependency and runs cleanly.

**Trade-offs:** Revisit once the dev machine's Node version is upgraded
(see the Node version note below) — newer jsdom may be preferable then.
