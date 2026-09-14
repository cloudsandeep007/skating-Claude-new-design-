import { useAuth } from '@/features/auth'

import { useNotificationsRealtime } from '../api/notifications'

/** Mount once inside any signed-in layout: keeps the realtime subscription
 * to this user's notifications alive for the life of the layout. */
export function NotificationsLive() {
  const { profile } = useAuth()
  useNotificationsRealtime(profile?.id)
  return null
}
