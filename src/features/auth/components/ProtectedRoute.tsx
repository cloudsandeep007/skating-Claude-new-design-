import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import type { AppRole } from '../types'

interface ProtectedRouteProps {
  allowedRoles: AppRole[]
}

/** Route guard: redirects to /login when signed out, to /403 when signed in
 * with the wrong role, and renders the nested route otherwise. */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { status, profile } = useAuth()

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}
