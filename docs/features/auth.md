# Auth

## Purpose

Signs people in, keeps them signed in, and sends each of the four roles
to its own part of the app. Nothing else in the app is reachable without
this.

## Screens

- **Login** (`/login`) — email + password.
- **Forgot password** (`/forgot-password`) — sends a reset link by email.
- **Reset password** (`/reset-password`) — reached from that emailed
  link; sets a new password.
- **403** (`/403`) — shown when a signed-in user opens a URL that belongs
  to a different role.
- **404** (`*`) — shown for any URL that doesn't exist.

No sign-up screen — accounts are created by an academy admin (built in
Phase 1) or manually in the Supabase dashboard for now.

## Data touched

- `profiles` — read on every session change (to get the user's role and
  academy); a user may update their own row, but never their own `role`
  or `academy_id` (enforced by both the RLS policy and this feature's own
  `updatePassword` flow never touching those columns).
- Supabase's built-in `auth.users` / `auth.sessions` — never read or
  written directly; always through `supabase.auth.*` methods.

## Business rules

- After sign-in, the user's `profiles.role` decides where they land:
  `super_admin → /dev`, `academy_admin → /admin`, `coach → /coach`,
  `parent → /parent` (`ROLE_HOME_PATH` in `types.ts`).
- A signed-in user who opens a URL for a different role is sent to
  `/403`, not silently redirected to their own home — they should notice
  something's wrong rather than assume the link they followed was correct.
- A `SIGNED_OUT` auth event only shows the "your session expired" toast
  when it wasn't caused by the user's own "sign out" click.

## Edge cases

- **No profile row for a valid Supabase user** (shouldn't happen for a
  real account, but possible for a stray `auth.users` row): treated as
  signed-out rather than crashing the app.
- **Expired or already-used password reset link:** `updateUser` fails;
  the page shows an error asking the person to request a new link, rather
  than a raw Supabase error message.
- **Tab left open past token expiry:** Supabase auto-refreshes silently;
  only a genuine refresh failure (e.g. the refresh token itself was
  revoked) triggers the expired-session flow.

## Known limitations

- Email/password only — no OAuth/social login, no magic links, no MFA.
- No "remember this device" / long-lived session option beyond Supabase's
  default token lifetimes.
- No self-service sign-up; every account is provisioned by someone else.
- The `/login` → role-home redirect briefly shows nothing while the
  profile row loads after a successful sign-in — acceptable for now,
  revisit if it ever feels slow once real hosting latency is measured.
