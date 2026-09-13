import * as Sentry from '@sentry/react'

/** Called once from main.tsx before the app renders. No-ops when no DSN is
 * configured (local dev without Sentry set up) instead of warning on every load. */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.VITE_APP_ENV === 'production' ? 0.2 : 1.0,
  })
}
