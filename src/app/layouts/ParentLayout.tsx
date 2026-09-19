import { CalendarDays, ClipboardCheck, Home, Megaphone, Trophy, UserCircle } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import prsaLogo from '@/assets/prsa-logo.png'
import { NotificationsLive, UnreadBadge } from '@/features/announcements'
import { useAuth } from '@/features/auth'
import { useLiveSync } from '@/shared/hooks/useLiveSync'
import { cn } from '@/shared/lib/utils'

const NAV_ITEMS = [
  { to: '/parent', label: 'Home', icon: Home, end: true, badge: false },
  { to: '/parent/progress', label: 'Progress', icon: Trophy, end: false, badge: false },
  { to: '/parent/schedule', label: 'Schedule', icon: CalendarDays, end: false, badge: false },
  { to: '/parent/attendance', label: 'Attendance', icon: ClipboardCheck, end: false, badge: false },
  { to: '/parent/announcements', label: 'News', icon: Megaphone, end: false, badge: true },
]

export function ParentLayout() {
  const { profile } = useAuth()
  useLiveSync(!!profile)

  return (
    <div className="flex min-h-screen flex-col">
      <NotificationsLive />

      <header className="flex h-14 items-center gap-2.5 border-b bg-card px-4">
        <img src={prsaLogo} alt="" className="h-7 w-auto shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{profile?.full_name}</span>
        <NavLink
          to="/parent/profile"
          aria-label="Profile and settings"
          className={({ isActive }) =>
            cn(
              'flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted',
              isActive && 'text-foreground',
            )
          }
        >
          <UserCircle className="h-6 w-6" />
        </NavLink>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 grid h-16 grid-cols-5 border-t border-white/10 bg-card shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
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
            {badge && (
              <span className="absolute right-[calc(50%-22px)] top-2">
                <UnreadBadge />
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
