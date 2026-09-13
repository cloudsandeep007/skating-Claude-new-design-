# Runbook

Operational procedures — step by step, written for a non-coder. Update
this whenever a procedure changes.

## Local development

```
npm install
cp .env.example .env   # then fill in the values, see .env.example for where to find them
npm run dev
```

## Running checks before committing

```
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

## Environment variables

See [.env.example](../.env.example) for the full documented list.

## Database migrations

_To be filled in once Supabase is connected (Phase 0.3)._

## Deploying

_To be filled in once a hosting target is chosen._

## Backups and restore

_To be filled in before going to production — see the "production
ready" checklist in the build plan._

## Releasing the mobile apps

_To be filled in during Phase 4 (Capacitor)._

## Incident response

_To be filled in as real operational needs come up. At minimum this
should eventually cover: what to do when payments fail, how to roll
back a bad deploy, how to restore from a backup._
