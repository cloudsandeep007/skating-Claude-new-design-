import * as Sentry from '@sentry/react'
import { RouterProvider } from 'react-router-dom'

import { AuthProvider, SessionExpiredToast } from '@/features/auth'
import { AppErrorFallback, QueryProvider } from '@/app/providers'
import { router } from '@/app/routes'
import { Toaster } from '@/shared/ui/sonner'

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />}>
      <QueryProvider>
        <AuthProvider>
          <SessionExpiredToast />
          <RouterProvider router={router} />
          <Toaster />
        </AuthProvider>
      </QueryProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
