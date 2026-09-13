import { useEffect } from 'react'
import { toast } from 'sonner'

import { useAuth } from '../hooks/useAuth'

/** Mounted once near the app root. Fires the "your session expired" toast
 * exactly once when a token auto-refresh fails and signs the user out. */
export function SessionExpiredToast() {
  const { sessionExpired, clearSessionExpired } = useAuth()

  useEffect(() => {
    if (sessionExpired) {
      toast.error('Your session has expired. Please log in again.')
      clearSessionExpired()
    }
  }, [sessionExpired, clearSessionExpired])

  return null
}
