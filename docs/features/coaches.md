# Coaches

## Purpose

The academy admin's coaching staff: who they are, what they specialise
in, which batches they run and how many skaters that covers, plus the
ability to invite a new coach and deactivate one who leaves.

## Screens (academy admin only)

- **List** (`/admin/coaches`) — table with initials avatar, name, email,
  specialization, batch count, student count, Active/Inactive pill. Not
  paginated (an academy has a handful of coaches). Skeleton while loading;
  empty state if none.
- **Add** (`/admin/coaches/new`) — name, email, phone, specialization.
  Submitting invites them: an account is created and an email sent so
  they set their own password.
- **Detail** (`/admin/coaches/:id`) — header with name, status,
  specialization, join date, contact; Edit and Deactivate/Reactivate;
  then a card per assigned batch with its active student count.
- **Edit** (`/admin/coaches/:id/edit`) — name, phone, specialization.
  Email isn't editable here (it's their login identity).

## Data touched

| Table / object              | Read | Write | Notes                                             |
| --------------------------- | ---- | ----- | ------------------------------------------------- |
| `coaches`                   | ✓    | ✓     | specialization update; status flip                |
| `profiles`                  | ✓    | ✓     | name/phone/email display; name/phone update       |
| `batches`                   | ✓    |       | assigned batches (via `batches.coach_id`)         |
| `student_batches`           | ✓    |       | active enrollment counts per batch                |
| Edge Function `invite-user` |      | ✓     | "Add coach" — creates account, sends invite       |

## Business rules

- **Deactivate is a status flip, not a delete.** `coaches.status` becomes
  `'inactive'`; their past sessions and the attendance they marked are
  untouched. Reactivate from the detail page.
- Deactivating a coach does **not** unassign their batches — that's the
  batches feature's job (Phase 1.2), which should warn when assigning an
  inactive coach.
- Student count = active enrollments across all of the coach's batches
  (a skater in two of their batches counts twice; acceptable for now).
- Only an `academy_admin` can add/edit/deactivate.

## Edge cases

- Adding a coach whose email already exists in this academy reuses that
  account (e.g. a parent who also coaches) and adds the `coaches` row.
- Invite email failure surfaces the Edge Function's message in the toast;
  no coach row is created in that case.

## Known limitations

- Coach batch assignment happens on the batch, not here — there's no
  "assign batch" control on the coach screens yet.
- No design mockup existed for these screens; they reuse the students
  screens' visual language (see DECISIONS.md).
- Deactivated coaches still appear in the list (with an Inactive pill);
  there's no filter to hide them yet.
