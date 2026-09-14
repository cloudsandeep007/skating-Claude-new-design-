import { Home, LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { PendingSavesIndicator } from '@/features/attendance'
import { useAuth } from '@/features/auth'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

const NAV_ITEMS = [{ to: '/coach', label: 'Today', icon: Home, end: true }]

export function CoachLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
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

      <main className="flex-1 p-4 pb-20">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex h-16 border-t bg-background">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground',
                isActive && 'text-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
