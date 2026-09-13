# Skating Academy

A web app for managing a skating academy: students, coaches, batches,
attendance, skill progression, fees, and parent communication.
Multi-tenant from day one.

No features are built yet — this repo currently contains the project
foundation only (tooling, folder structure, conventions).

## Stack

React 18 + TypeScript (strict) + Vite, Tailwind CSS + shadcn/ui,
TanStack Query, Zustand, React Hook Form + Zod, React Router, Recharts,
Supabase, Vitest + Playwright, Sentry.

See [CLAUDE.md](./CLAUDE.md) for the full architecture and conventions,
and [docs/](./docs/) for living documentation.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy the environment template and fill in real values (see the
   comments in the file for where to find each one):
   ```
   cp .env.example .env
   ```
3. Start the dev server:
   ```
   npm run dev
   ```

## Scripts

| Command                | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the dev server                    |
| `npm run build`        | Type-check and build for production     |
| `npm run typecheck`    | Type-check only, no build               |
| `npm run lint`         | Lint the codebase                       |
| `npm run format`       | Format the codebase with Prettier       |
| `npm run format:check` | Check formatting without changing files |
| `npm test`             | Run unit tests once                     |
| `npm run test:watch`   | Run unit tests in watch mode            |
| `npm run test:e2e`     | Run Playwright end-to-end tests         |

## Before committing

Run `npm run typecheck && npm run lint && npm test` and make sure they
pass. See [CLAUDE.md](./CLAUDE.md)'s "Documentation rules" section —
most sessions that change the system also need a docs update, checked
off in the PR template at
[.github/PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md).

Optionally, use the local commit message template as a reminder:

```
git config commit.template .gitmessage.txt
```

## Known environment note

This machine runs Node v20.10.0. A few dependencies (Vitest 5, the
Supabase JS client, some ESLint tooling) declare a minimum of Node
20.19+/22+ and print `EBADENGINE` warnings on install — everything has
been verified to still work (typecheck, lint, unit tests, and the dev
server all pass), but if something behaves oddly, upgrading Node is the
first thing to try.
