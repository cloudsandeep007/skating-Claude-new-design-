import { LoaderCircle } from 'lucide-react'

/** Full-viewport spinner shown while auth/session state is still resolving. */
export function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  )
}
