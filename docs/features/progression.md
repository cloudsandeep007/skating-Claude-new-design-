# Skill progression

> Restyled to the "Kinetic Obsidian" dark theme 2026-09-15 — visual only,
> except one bug fix: the "Promote to next level" button no longer
> renders red on a successful promotion. See docs/DECISIONS.md.

## Purpose

The feature that differentiates this app from a generic attendance
tracker: a real progression ladder (levels → skills) that coaches assess
in two taps, that parents see as something worth celebrating rather than
a checklist, and that admins can set up and monitor. Built entirely on
the `levels` / `skills` / `student_skills` tables and RLS that already
existed from `0001_initial_schema.sql` — this feature adds the RPCs for
promotion and the two admin reports (`0006_skill_progression.sql`), and
every screen.

## Screens

**Admin** (`/admin/levels`, `/admin/progression`)
- **Levels & skills** — every level as a draggable card (grip handle,
  sequence number, name, description, skill count); expand to see its
  skills, also drag-reorderable. Add/edit/delete both, with a confirm
  dialog on delete warning that it removes recorded history.
- **Progress** — a Recharts bar chart of active skaters per level, and a
  "haven't progressed" list (30/60/90-day window) with days-since-last-
  achievement and a link to the skater's profile.

**Coach** — two entry points, both from `/coach` (today's sessions) or a
session's roster, never a standalone nav tab:
- **Assess skills** (session header, `/coach/skills/session/:sessionId`)
  — **bulk assess**: pick a level present in the roster, then a skill,
  then check skaters and apply one status to all of them at once, with
  an optional shared note. Shows each skater's current status for that
  skill before you touch anything.
- **Skills** icon per roster row (`/coach/skills/:studentId`) — one
  skater's current level, every skill in it with three status chips
  (not started / learning / achieved — one tap sets it exactly) and a
  note button, a **Promote** button once every skill is achieved (with
  confirmation), and their achievement history.

**Parent** (`/parent/progress`, bottom nav "Progress")
- A ladder position bar ("Level 3 of 9"), the current level's skills as
  colored, iconed tiles (not a table), a locked preview of the next
  level's skill names, and the achievement history with coach and date.

**Admin — skater profile** (`/admin/students/:id`, "Progress" tab)
- The same assessment panel and history the coach sees, so an admin can
  assess or promote directly from a skater's profile too.

## Data touched

| Table / object              | Read | Write | Notes                                                          |
| ---------------------------- | ---- | ----- | ---------------------------------------------------------------- |
| `levels`, `skills`           | ✓    | ✓     | admin CRUD is plain RLS-guarded table writes                     |
| `student_skills`             | ✓    | ✓     | coach/admin upsert (single or bulk in one request); parent reads |
| `students.current_level_id`  | ✓    | ✓     | only via `promote_student()` — coaches can't write `students` directly |
| RPC `promote_student`        |      | ✓     | validates every current-level skill is achieved, moves to next level by `sequence` |
| RPC `reorder_levels` / `reorder_skills` |  | ✓ | sets `sequence` from a dragged order, admin-only via RLS         |
| RPC `level_distribution`     | ✓    |       | admin report                                                     |
| RPC `stale_students`         | ✓    |       | admin report                                                     |
| `profiles`                   | ✓    |       | resolves "Coach ___" on notes and history                        |
| `audit_logs`                 |      | (auto)| existing `audit_students` trigger logs the level change, but the app deliberately doesn't read it back (see Business rules) |

## Business rules

- **Promotion gate.** `promote_student()` (`0006_skill_progression.sql`)
  is `SECURITY DEFINER` because coaches have no RLS write on `students`;
  it re-checks the caller is a coach or admin in the student's academy,
  requires every skill in the current level to be `achieved`, and moves
  to the level with `sequence + 1` in the same academy. No next level →
  a clear error ("already at the highest level"); no skills in the level
  → a clear error, rather than a vacuous promotion.
- **Two taps, one write.** Setting a skill's status is a single
  `student_skills` upsert (`onConflict: student_id,skill_id`) — the same
  call handles one student or a whole batch at once, so bulk assess is
  one request, not N.
- **History is read from `student_skills`, not `audit_logs`.**
  `audit_logs` is admin-only by RLS; scoping "what was achieved, when,
  by whom" to `student_skills` (already readable by coach and parent)
  keeps it available everywhere it's shown without widening RLS. The
  trade-off: if a skill is un-achieved later, that specific achievement
  drops out of history — accepted as a rare edge case.
- **Deleting a level or skill** cascades to its skills / recorded
  `student_skills` (existing FK `on delete cascade`); a skater on a
  deleted level falls back to no level (`on delete set null`). The UI
  confirms before either.
- **Reordering** writes the whole new sequence in one RPC call
  (`reorder_levels` / `reorder_skills`) so a drag never leaves the list
  half-renumbered on a flaky connection.
- **Stale window** default is 60 days per the spec, with a 30/90-day
  toggle; "last achieved" falls back to `joined_date` for a skater with
  nothing achieved yet, so new-but-stalled skaters are never hidden.

## Edge cases

- **A skater with no level assigned** — the assessment panel shows "No
  level assigned" instead of an empty skill list; the parent screen
  shows the equivalent empty state.
- **A batch with mixed levels** (bulk assess) — the level picker only
  offers levels actually present in that session's roster; picking one
  filters the roster to just those skaters.
- **Two coaches assess the same skill for the same skater** — last write
  wins (upsert), same as attendance overrides.
- **A skater already at the top level** — the promote button and section
  are replaced with a "Highest level" indicator; the admin stale report
  still lists them (with an `is_top_level` flag) rather than hiding them,
  since "hasn't progressed" is still a true fact about them.

## Known limitations

- No demotion — only forward promotion by one level at a time.
- Bulk assess's optional note replaces each selected skater's existing
  note for that skill (there's no per-student note in bulk mode); the UI
  says so.
- No skill-level photo/video attachment — notes are text only.
- The stale-students window options are fixed (30/60/90); no custom
  value.
