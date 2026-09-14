# Feature docs

One file per feature (`docs/features/<feature>.md`), created or updated
in the same session the feature is built or changed. Each file covers:

- **Purpose** — what this feature is for, in plain language
- **Screens** — what a user sees, per role if it differs
- **Data touched** — which tables/views this feature reads and writes
- **Business rules** — the rules encoded in `api/`/`hooks/`, restated in plain language
- **Edge cases** — what happens in the unusual situations
- **Known limitations** — what this deliberately doesn't handle yet

- [auth.md](./auth.md) — login, roles, and route protection (Phase 0.4)
- [students.md](./students.md) — roster list, add/edit/archive, detail (Phase 1.1)
- [coaches.md](./coaches.md) — coaching staff list, invite, deactivate (Phase 1.1)
- [batches.md](./batches.md) — recurring classes, enrollment, capacity (Phase 1.2)
- [schedule.md](./schedule.md) — session generation, weekly calendar, cancellations, coach today view (Phase 1.2)
- [attendance.md](./attendance.md) — coach marking (offline-safe), admin views/override/CSV, parent history (Phase 1.3)
