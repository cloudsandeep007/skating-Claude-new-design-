import { Link } from 'react-router-dom'

import { Button } from '@/shared/ui/button'

export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold">403</p>
      <p className="text-muted-foreground">You don't have access to this page.</p>
      <Button asChild>
        <Link to="/">Go home</Link>
      </Button>
    </div>
  )
}
