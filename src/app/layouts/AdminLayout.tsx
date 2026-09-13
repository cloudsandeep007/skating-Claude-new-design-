import { useState } from 'react'
import { Award, LayoutDashboard, LogOut, Menu, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/features/auth'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { Sheet, SheetContent, SheetTrigger } from '@/shared/ui/sheet'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/students', label: 'Skaters', icon: Users, end: false },
  { to: '/admin/coaches', label: 'Coaches', icon: Award, end: false },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function Logo() {
  return (
    <div className="px-2.5 pb-4">
      <div className="text-base font-extrabold tracking-tight text-white">
        Skating Academy<span className="text-brand-500">.</span>
      </div>
    </div>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10',
              isActive && 'bg-white text-neutral-950 hover:bg-white',
            )
          }
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function IdentityFooter() {
  const { profile } = useAuth()
  if (!profile) return null

  return (
    <div className="mt-auto flex items-center gap-2.5 border-t border-white/15 px-2.5 pt-4">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-neutral-700 text-xs text-white">
          {initials(profile.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-white">{profile.full_name}</div>
        <div className="text-xs text-neutral-400">Academy admin</div>
      </div>
    </div>
  )
}

export function AdminLayout() {
  const { signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col gap-0.5 bg-neutral-950 py-4 md:flex">
        <Logo />
        <NavList />
        <IdentityFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-56 flex-col gap-0.5 bg-neutral-950 p-0 py-4"
            >
              <Logo />
              <NavList
                onNavigate={() => {
                  setDrawerOpen(false)
                }}
              />
              <IdentityFooter />
            </SheetContent>
          </Sheet>

          <div className="hidden md:block" />

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

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
