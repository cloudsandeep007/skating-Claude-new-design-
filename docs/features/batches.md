# Batches

## Purpose

A batch is a recurring class: a name, a coach, a weekly time slot on
chosen days, a venue and a capacity. Students are enrolled into batches;
the schedule is generated from them. This is the academy admin's view.

## Screens (academy admin only)

- **List** (`/admin/batches`) — name (with level range and venue), coach,
  timing, days, enrolled/capacity pill (green → amber at the last two
  places → red when full), status.
- **New / Edit** (`/admin/batches/new`, `/admin/batches/:id/edit`) — name,
  level range, coach dropdown, start/end time, capacity, day toggles
  (Sun–Sat), venue. Edit adds the **"Also move upcoming scheduled
  sessions"** checkbox (see business rules).
- **Detail** (`/admin/batches/:id`) — header with capacity/level/status
  pills and the weekly rule; **Generate schedule**, Edit,
  Deactivate/Reactivate, and Remove (permanent delete, behind a
  confirmation dialog) buttons; roster (name, level, enrolled-since,
  remove ×) with an **Enroll skater** dialog; the next 20 upcoming
  sessions with cancelled/done markers.

## Data touched

| Table                       | Read | Write | Notes                                                  |
| --------------------------- | ---- | ----- | ------------------------------------------------------ |
| `batches`                   | ✓    | ✓     | create, update, status flip, delete                    |
| `student_batches`           | ✓    | ✓     | enroll = upsert to active; remove = set inactive       |
| `students`, `levels`        | ✓    |       | roster names/levels; enrollable-student picker         |
| `coaches` + `profiles`      | ✓    |       | coach dropdown (via `useCoachOptions` from coaches)    |
| `schedule_sessions`         | ✓    | ✓     | upcoming list; bulk time/coach update on opt-in edit   |

## Business rules

- **Enrolling past capacity is allowed but warned.** The dialog shows an
  amber warning and the button becomes red "Enroll anyway" — the admin
  decides, the app doesn't block. Capacity is a rink safety guide, not a
  hard database constraint.
- **Removing a student keeps the row** (`student_batches.status =
  'inactive'`) so enrollment history survives; re-enrolling upserts back
  to active with a fresh `enrolled_date`.
- **Editing a batch never silently changes existing sessions.** Each
  session stores its own time and coach. On edit the admin chooses:
  - unticked (default): only sessions generated *from now on* use the new
    time — already-generated sessions stay as they were;
  - ticked: future **scheduled** sessions (from today) are moved to the
    new time and coach too. Completed and cancelled sessions are never
    touched either way.
- Changing `days_of_week` doesn't delete sessions on days that were
  removed — they're already on the calendar; cancel them individually if
  needed.
- Days toggle stores 0 = Sunday … 6 = Saturday, matching Postgres `dow`.
- **Deactivate is a status flip** (`batches.status` active ↔ inactive),
  reversible, no data lost — same pattern as coaches.
- **Remove is a real delete**, and unlike coaches this one does destroy
  history: `schedule_sessions` (and the `attendance` rows against them)
  and `student_batches` enrollment records all cascade-delete with the
  batch (`ON DELETE CASCADE`, see 0001_initial_schema.sql). The
  confirmation dialog says so explicitly and names the enrolled-skater
  count; prefer Deactivate for a batch that's just paused or finished
  for the season.

## Edge cases

- A batch with no coach can still be created and scheduled; generation
  skips the coach-clash check for it, and the calendar shows no coach.
- Deactivating a coach (coaches feature) doesn't unassign their batches —
  the batch keeps pointing at them until edited here.
- "Enrollable" excludes archived/inactive students and anyone already
  active in this batch.

## Known limitations

- The `'archived'` status value exists in the database but nothing in
  the UI sets it yet — the status toggle only offers active/inactive.
- Enrolling is one student at a time.
- A student can be in several batches; the students list shows only the
  first active one.
