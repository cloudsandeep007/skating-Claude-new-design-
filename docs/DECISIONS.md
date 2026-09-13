# Architecture decision log

Newest first. One entry per real choice made — not every line of code,
but anything a future session (or future you) would otherwise have to
re-derive or might accidentally reverse.

Format:

```
## YYYY-MM-DD — <short decision title>

**Decision:** what was decided.
**Options considered:** the alternatives and why they were on the table.
**Why:** the reasoning that picked the option above.
**Trade-offs:** what this costs or risks, and when to revisit it.
```

---

## 2026-09-13 — Project foundation scaffolded

**Decision:** Vite + React 18 + TypeScript (strict) + Tailwind + shadcn/ui,
with the feature-folder architecture described in CLAUDE.md, TanStack
Query for server state, Zustand for local UI state, React Hook Form +
Zod for forms, React Router for routing, Recharts for charts, Supabase
for backend, Vitest + Playwright for testing, Sentry for error tracking.

**Options considered:** Next.js was not considered — this is a
client-rendered SPA today (no SSR requirement), and Vite's dev
experience is simpler for a non-coder-led workflow. Redux/Context were
not chosen for server state — TanStack Query is a better fit since
almost all state here is Supabase data.

**Why:** Matches the stack specified for this project; each library has
one clear job so a future session (or an AI tool with no memory of past
sessions) can guess correctly which tool handles what.

**Trade-offs:** No SSR/SEO — acceptable since this is an authenticated
app, not a public marketing site. Revisit only if a public-facing
marketing/booking page (Phase 6 "Trial bookings") needs SEO.

## 2026-09-13 — React pinned to v18, not v19

**Decision:** Pin `react` and `react-dom` to `^18` even though `npm create
vite` scaffolds React 19 by default.

**Options considered:** Staying on the scaffolded React 19.

**Why:** The stack was specified as React 18; some libraries in this
ecosystem (Capacitor community plugins in particular, needed in Phase 4)
have historically lagged behind major React versions.

**Trade-offs:** Will need a deliberate upgrade decision later if a
library ends up requiring React 19.

## 2026-09-13 — jsdom pinned to v25, not the latest v26/v30

**Decision:** Use `jsdom@25` for Vitest's test environment instead of the
version npm installs by default.

**Options considered:** Latest jsdom (v30 at time of writing).

**Why:** The dev machine runs Node 20.10, and jsdom's newer versions pull
in `html-encoding-sniffer` → `@exodus/bytes`, which throws
`ERR_REQUIRE_ESM` under Node < ~20.19 due to a CJS/ESM interop bug in
that dependency chain. jsdom 25 predates that dependency and runs cleanly.

**Trade-offs:** Revisit once the dev machine's Node version is upgraded
(see the Node version note below) — newer jsdom may be preferable then.
