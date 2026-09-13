import { Navigate } from 'react-router-dom'

import { ROLE_HOME_PATH, useAuth } from '@/features/auth'

/** `/` itself isn't a page — it sends signed-in users to their role's home
 * and everyone else to /login. */
export function RootRedirect() {
  const { status, profile } = useAuth()

  if (status === 'authenticated' && profile) {
    return <Navigate to={ROLE_HOME_PATH[profile.role]} replace />
  }

  return <Navigate to="/login" replace />
}
