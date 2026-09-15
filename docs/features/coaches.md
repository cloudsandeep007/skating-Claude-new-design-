# Coaches

> Restyled to the "Kinetic Obsidian" dark theme 2026-09-15 — visual only,
> nothing below changed. See docs/DECISIONS.md.

## Purpose

The academy admin's coaching staff: who they are, what they specialise
in, which batches they run and how many skaters that covers, plus the
ability to invite a new coach, deactivate one who leaves, or permanently
remove one entered by mistake.

## Screens (academy admin only)

- **List** (`/admin/coaches`) — table with photo (or initials fallback)
  avatar, name, email, specialization, batch count, student count,
  Active/Inactive pill. Not paginated (an academy has a handful of
  coaches). Skeleton while loading; empty state if none.
- **Add** (`/admin/coaches/new`) — name, email, phone, specialization,
  optional photo. Submitting invites them: an account is created and an
  email sent so they set their own password; the photo (if any) uploads
  right after, once the new coach's id exists.
- **Detail** (`/admin/coaches/:id`) — header with photo, name, status,
  specialization, join date, contact; Edit, Deactivate/Reactivate, and
  Remove (permanent delete, behind a confirmation dialog); then a card
  per assigned batch with its active student count.
- **Edit** (`/admin/coaches/:id/edit`) — name, phone, specialization,
  photo (replace). Email isn't editable here (it's their login identity).

## Data touched

| Table / object                | Read | Write | Notes                                        |
| ------------------------------ | ---- | ----- | --------------------------------------------- |
| `coaches`                      | ✓    | ✓     | specialization/photo_url update; status flip  |
| `profiles`                     | ✓    | ✓     | name/phone/email display; name/phone update   |
| `batches`                      | ✓    |       | assigned batches (via `batches.coach_id`)     |
| `student_batches`              | ✓    |       | active enrollment counts per batch            |
| Storage bucket `coach-photos`  | ✓    | ✓     | private; one signed URL fetch per unique photo|
| Edge Function `invite-user`    |      | ✓     | "Add coach" — creates account, sends invite   |
| Edge Function `delete-user`    |      | ✓     | "Remove coach" — deletes the auth account     |

## Business rules

- **Deactivate is a status flip, not a delete.** `coaches.status` becomes
  `'inactive'`; their past sessions and the attendance they marked are
  untouched. Reactivate from the detail page.
- **Remove is a real delete**, for a coach added by mistake or who never
  actually worked here. It goes through the `delete-user` Edge Function
  (service-role only), which deletes the underlying `auth.users` row —
  that cascades to `profiles` and then `coaches` automatically
  (`ON DELETE CASCADE` both steps). Deleting just the `coaches` row
  directly would leave a working login with no coach record behind it,
  which is why this needs the Edge Function rather than a plain
  `.delete()` call. Any batch or session the coach was assigned to keeps
  running — `coach_id` there is `ON DELETE SET NULL`, so it just becomes
  unassigned; their own past attendance-marked-by history is untouched.
- Deactivating (or removing) a coach does **not** unassign their batches
  proactively — that's the batches feature's job, which should warn when
  assigning an inactive coach.
- Student count = active enrollments across all of the coach's batches
  (a skater in two of their batches counts twice; acceptable for now).
- Only an `academy_admin` can add/edit/deactivate/remove.
- Photos live in a private `coach-photos` bucket, one per coach at
  `<academy_id>/<coach_id>/photo.<ext>`, same shape and RLS pattern as
  the existing `student-photos` bucket. Display resolves a 1-hour signed
  URL via the shared `useSignedPhotoUrls` hook; a missing/failed photo
  just falls back to initials, it never blocks the page.

## Edge cases

- Adding a coach whose email already exists in this academy reuses that
  account (e.g. a parent who also coaches) and adds the `coaches` row.
- Invite email failure surfaces the Edge Function's message in the toast;
  no coach row is created in that case.
- `delete-user` refuses to remove an account outside the caller's own
  academy, or a non-coach account, or the caller's own account.

## Known limitations

- Coach batch assignment happens on the batch, not here — there's no
  "assign batch" control on the coach screens yet.
- No design mockup existed for these screens; they reuse the students
  screens' visual language (see DECISIONS.md).
- Deactivated coaches still appear in the list (with an Inactive pill);
  there's no filter to hide them yet.
