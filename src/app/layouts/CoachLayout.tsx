import { CalendarCheck, Home, LogOut, Megaphone } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import prsaLogo from '@/assets/prsa-logo.png'
import { NotificationsLive, UnreadBadge } from '@/features/announcements'
import { PendingSavesIndicator } from '@/features/attendance'
import { useAuth } from '@/features/auth'
import { usePendingBookingCount } from '@/features/schedule'
import { useLiveSync } from '@/shared/hooks/useLiveSync'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

const NAV_ITEMS = [
  { to: '/coach', label: 'Today', icon: Home, end: true, badge: 'none' },
  { to: '/coach/bookings', label: 'Bookings', icon: CalendarCheck, end: false, badge: 'requests' },
  { to: '/coach/inbox', label: 'Inbox', icon: Megaphone, end: false, badge: 'unread' },
] as const

export function CoachLayout() {
  const { profile, signOut } = useAuth()
  useLiveSync(!!profile)
  const { data: pendingRequests } = usePendingBookingCount()

  return (
    <div className="flex min-h-screen flex-col">
      <NotificationsLive />

      <header className="flex h-14 items-center gap-2.5 border-b bg-card px-4">
        <img src={prsaLogo} alt="" className="h-7 w-auto shrink-0" />
        <span className="min-w-0 truncate text-sm font-semibold">{profile?.full_name}</span>
        <div className="ml-auto mr-2">
          <PendingSavesIndicator />
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={() => {
            void signOut()
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 grid h-16 grid-cols-3 border-t border-white/10 bg-card shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground',
                isActive && 'font-bold text-primary shadow-[inset_0_3px_0_hsl(var(--primary))]',
              )
            }
          >
            <Icon className="h-[22px] w-[22px]" />
            {label}
            {badge === 'unread' && (
              <span className="absolute right-[calc(50%-22px)] top-2">
                <UnreadBadge />
              </span>
            )}
            {badge === 'requests' && (pendingRequests ?? 0) > 0 && (
              <span className="absolute right-[calc(50%-26px)] top-1.5 min-w-[18px] rounded-full bg-warning-500 px-1 text-center text-[10px] font-extrabold leading-[18px] text-black">
                {pendingRequests}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
