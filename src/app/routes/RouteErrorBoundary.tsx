import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'

import { Button } from '@/shared/ui/button'

/** react-router's `errorElement` — catches render/loader errors for a route
 * without taking down the rest of the app. */
export function RouteErrorBoundary() {
  const error = useRouteError()

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-lg font-semibold">Something went wrong.</p>
      <p className="text-muted-foreground">
        This page hit an unexpected error. Reloading usually fixes it.
      </p>
      <Button
        onClick={() => {
          window.location.reload()
        }}
      >
        Reload page
      </Button>
    </div>
  )
}
