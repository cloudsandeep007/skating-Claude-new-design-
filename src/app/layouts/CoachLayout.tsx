import { Home, LogOut, Megaphone } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { NotificationsLive, UnreadBadge } from '@/features/announcements'
import { PendingSavesIndicator } from '@/features/attendance'
import { useAuth } from '@/features/auth'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

const NAV_ITEMS = [
  { to: '/coach', label: 'Today', icon: Home, end: true, badge: false },
  { to: '/coach/inbox', label: 'Inbox', icon: Megaphone, end: false, badge: true },
]

export function CoachLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <NotificationsLive />

      <header className="flex h-14 items-center justify-between border-b bg-card px-4">
        <span className="text-sm font-semibold">{profile?.full_name}</span>
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

      <nav className="fixed inset-x-0 bottom-0 grid h-16 grid-cols-2 border-t-2 bg-card shadow-[0_-3px_10px_rgba(45,43,43,.08)]">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground',
                isActive &&
                  'font-bold text-foreground shadow-[inset_0_3px_0_theme(colors.neutral.950)]',
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
