# Data model

Every table in the Supabase database, its columns, relationships, and
row-level security (RLS) policies. Update this file in the same session
as any migration that changes the schema.

_No tables exist yet — the schema is built in Phase 0.3. This file has
its structure in place so that session has somewhere to write._

## Relationship diagram

_To be added once tables exist. Format: a text diagram, e.g._

```
academies 1---* profiles
academies 1---* students 1---* parents_students *---1 profiles (parents)
students  1---* student_batches *---1 batches 1---1 coaches
```

## Tables

_One subsection per table, in the format below, added as migrations land._

### `<table_name>`

| Column | Type | Nullable | Default | Notes |
| ------ | ---- | -------- | ------- | ----- |
|        |      |          |         |       |

**Relationships:**

**RLS policies:**

| Policy | Role | Applies to | Rule |
| ------ | ---- | ---------- | ---- |
