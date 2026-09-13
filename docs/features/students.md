# Students

## Purpose

The academy admin's roster: every skater, who their parent is, which batch
and level they're in, how their attendance and fees are doing, and the
ability to add, edit and archive them.

## Screens (academy admin only)

- **List** (`/admin/students`) — table with photo/initials, name, parent,
  batch, level, attendance % (with bar), fee status pill, last active.
  Server-side pagination (10/page), search by name (debounced 300ms),
  filter by batch and status, sort by name or join date. Shows a 5-row
  skeleton while loading and a different empty state for "no students yet"
  vs "no students match these filters".
- **Add** (`/admin/students/new`) — three cards: skater details (name,
  DOB, gender, batch, starting level, photo), emergency contact, and
  parent. The parent section toggles between "New parent (send invite)"
  and "Existing parent" (a dropdown of the academy's parent accounts).
- **Detail** (`/admin/students/:id`) — header with avatar, name, batch /
  level / archived / attendance pills, join date, coach, parent contact
  card; Edit and Archive/Restore buttons; tabs. **Only Overview is built**
  (DOB, gender, emergency contact, medical notes). Attendance, Progress,
  Fees and Notes tabs are stubs that say so.
- **Edit** (`/admin/students/:id/edit`) — same fields as Add minus the
  parent section (parent links are managed separately later).

## Data touched

| Table / object               | Read | Write | Notes                                                        |
| ---------------------------- | ---- | ----- | ------------------------------------------------------------ |
| `students`                   | ✓    | ✓     | insert, update, status flip (archive/restore)                |
| `student_batches`            | ✓    | ✓     | one active enrollment created with the student; batch change on edit |
| `parents_students`           | ✓    | ✓     | inserted directly for an existing parent                     |
| `profiles`                   | ✓    |       | parent names for the list and detail; existing-parent picker |
| `batches`, `levels`          | ✓    |       | dropdown options and display names                           |
| `student_attendance_summary` | ✓    |       | attendance % per student (the view, not raw attendance)      |
| `student_fees`               | ✓    |       | most recent fee row per student → fee status pill            |
| `attendance`                 | ✓    |       | most recent `marked_at` per student → "last active"          |
| Storage `student-photos`     |      | ✓     | photo upload; path saved to `students.photo_url`             |
| Edge Function `invite-user`  |      | ✓     | "new parent" — creates account, sends invite, links them     |

The list page makes one paginated query for the student rows, then four
small lookups keyed by the visible page's ids (attendance, fee, last
active, parent name) and merges them in `api/listStudents.ts`. That's
deliberate — see DECISIONS.md.

## Business rules

- **Archive is a soft delete.** `students.status` becomes `'archived'`;
  nothing is ever deleted. Archived students drop out of the default list
  (which filters to `active`) but are reachable via the status filter, and
  can be restored from their detail page.
- A student must be enrolled in a batch when created (the list and detail
  queries assume at least one active enrollment).
- Attendance % colours: ≥80 green, 60–79 amber, <60 red — the same
  threshold the dashboard's at-risk view uses.
- Fee status shown is the **most recent fee by due date**, so a student
  whose current month is unpaid past the 5th shows Overdue even if last
  month was paid.
- Adding a student with a **new** parent whose email already exists in
  this academy reuses that account instead of creating a duplicate (so a
  sibling gets linked to the same parent). An email belonging to another
  academy is rejected.
- Only an `academy_admin` can add/edit/archive (enforced by RLS on the
  tables and by the Edge Function checking the caller's role).

## Edge cases

- **Blank optional fields** (DOB, level, medical notes) are stored as
  `null`, not empty strings (`emptyToNull` in `shared/lib`).
- **Photo upload fails after the student was created:** the student
  exists without a photo and an error toast shows — re-upload from Edit.
- **Invite email fails to send:** the Edge Function returns the error; the
  student and enrollment already exist, so the admin can retry the parent
  link later (that UI is not built yet — see limitations).
- A student with no attendance rows yet shows "—" instead of a percentage.

## Known limitations

- No bulk select / bulk actions (the design has them; not asked for yet).
- Parent links can't be edited after creation (add a second parent, change
  relationship) — only set at creation. Coming with a later phase.
- The list's "last active" is the most recent attendance mark, so a
  brand-new student shows "—" until their first session is marked.
- Photos are displayed as initials for now; the signed-URL resolver
  (`getStudentPhotoUrl`) exists but isn't wired into the avatar yet.
- Pagination is Prev/Next only, not numbered pages.
- No CSV export.
