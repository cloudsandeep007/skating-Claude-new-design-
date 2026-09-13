import { Button } from '@/shared/ui/button'

/** Top-level fallback for errors that happen outside the router (e.g. during
 * provider setup) — passed to Sentry's <ErrorBoundary> in App.tsx. */
export function AppErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-lg font-semibold">Something went wrong.</p>
      <p className="text-muted-foreground">Reloading the page usually fixes this.</p>
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
