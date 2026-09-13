import { useEffect } from 'react'
import * as Sentry from '@sentry/react'

import { PageLoader } from '@/shared/ui/PageLoader'

import { AuthContext } from '../hooks/auth-context'
import { useAuthSession } from '../hooks/useAuthSession'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useAuthSession()

  useEffect(() => {
    if (value.profile) {
      Sentry.setUser({
        id: value.profile.id,
        email: value.profile.email ?? undefined,
        username: value.profile.full_name,
      })
    } else {
      Sentry.setUser(null)
    }
  }, [value.profile])

  if (value.status === 'loading') {
    return <PageLoader />
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
