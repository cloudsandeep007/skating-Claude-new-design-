import { useAuth } from '@/features/auth'

import { useUnreadCount } from '../api/notifications'

/** Red count pill for nav items. Renders nothing at zero. */
export function UnreadBadge({ className }: { className?: string }) {
  const { profile } = useAuth()
  const { data: count } = useUnreadCount(profile?.id)

  if (!count) return null

  return (
    <span
      className={
        className ??
        'inline-flex min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-[18px] text-white'
      }
      aria-label={`${count} unread`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
