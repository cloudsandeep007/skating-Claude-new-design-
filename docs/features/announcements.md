# Announcements and notifications

> Restyled to the "Kinetic Obsidian" dark theme 2026-09-15 — visual only,
> nothing below changed. See docs/DECISIONS.md.

## Purpose

The academy's one-to-many channel: an admin posts something, the right
people see it in the app with an unread indicator, and it shows up live
without a refresh. Notifications are in-app only for now.

## Screens

- **Admin** (`/admin/announcements`) — list with state pill (draft /
  scheduled / live / expired) and audience; **New announcement** dialog:
  title, message, who sees it (everyone / parents / coaches / one batch),
  publish now or schedule for a date-time, optional expiry. Delete with
  confirmation.
- **Parent** (`/parent/announcements`, also the "latest" card on Home)
  and **Coach** (`/coach/inbox`) — the same `AnnouncementFeed`: cards
  newest first, a red dot and heavier border while unread; tapping marks
  it read. The bottom-nav tab carries the unread count badge.

## Data touched

| Table / object                 | Read | Write | Notes                                                        |
| ------------------------------ | ---- | ----- | ------------------------------------------------------------ |
| `announcements`                | ✓    | ✓     | admin insert/delete; `notified_at` set by the RPC            |
| `notifications`                | ✓    | ✓     | fan-out rows via RPC; readers update their own `read_at`     |
| `batches`                      | ✓    |       | batch picker / batch name on cards                            |
| RPC `publish_due_announcements`|      | ✓     | fan-out; called after publishing and on every feed load       |
| Realtime `notifications`       | ✓    |       | INSERT events filtered to the signed-in profile               |

## Business rules

- **Who gets a notification** (the RPC, per announcement, once):
  `all` → everyone active in the academy; `parents` → parents;
  `coaches` → coaches; `batch` → parents of that batch's active students
  plus the batch's coach. The author never gets their own. One row per
  person even if two of their children are in the batch.
- **Scheduling** is just a future `published_at`. Fan-out happens the
  first time anyone in the academy loads a feed (or an admin opens the
  list) after that moment — `notified_at` guarantees exactly once.
  There's no cron job; see limitations.
- **What a reader sees** is decided by RLS, not the feed code: published,
  not expired, and aimed at them (parents see `all`/`parents`/their
  batches; coaches see `all`/`coaches`/`batch`). A reader can therefore
  see a post they weren't notified about (e.g. published before they
  joined) — it just has no unread dot.
- **Unread badge** counts every unread notification of any type
  (announcements, cancelled sessions, …), not only announcements.
- **Realtime**: each signed-in coach/parent layout holds one channel on
  `notifications` filtered to their `profile_id`. A new row refreshes the
  badge and feed and shows a toast with the title.
- **Delete** cascades to the notifications it created.

## Edge cases

- **Expired** posts vanish from feeds (RLS) but stay in the admin list
  marked expired.
- **Editing** isn't supported — delete and re-post (recipients get a new
  notification). Deliberate: a silent edit after people have read it is
  confusing.
- **Feed loads with 0005 not applied**: posts still show (the read-state
  join is tolerant); the admin list errors because it selects
  `notified_at`.
- **Offline**: queries run in `networkMode: 'always'`, so a failed load
  shows an error state rather than an endless empty list.

## Known limitations

- No server-side scheduler: a scheduled post goes out when someone next
  opens the app, not at the exact minute. Enable `pg_cron` and schedule
  `select public.publish_due_announcements()` if that ever matters
  (RUNBOOK.md).
- No push notifications, email or WhatsApp — in-app only.
- No edit; no rich text or attachments; no per-student targeting.
- Admins don't get an inbox of their own yet.
