import { useState } from 'react'
import {
  Award,
  Bell,
  CalendarDays,
  ClipboardCheck,
  FileBarChart,
  IndianRupee,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Search,
  Trophy,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { UnreadBadge } from '@/features/announcements'
import { useAcademy, useAuth } from '@/features/auth'
import { useActiveStudentCount } from '@/features/students'
import { cn } from '@/shared/lib/utils'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/shared/ui/sheet'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/students', label: 'Skaters', icon: Users, end: false },
  { to: '/admin/coaches', label: 'Coaches', icon: Award, end: false },
  { to: '/admin/batches', label: 'Batches', icon: Layers, end: false },
  { to: '/admin/schedule', label: 'Schedule', icon: CalendarDays, end: false },
  { to: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck, end: false },
  { to: '/admin/progression', label: 'Progress', icon: Trophy, end: false },
  { to: '/admin/fees', label: 'Fees', icon: IndianRupee, end: false },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, end: false },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart, end: false },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** "Skaters", "Batches", … for the top bar caption — the deepest matching nav item. */
function screenLabel(pathname: string) {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
  return match?.label ?? 'Admin'
}

function Wordmark({ name }: { name: string }) {
  // The mockup: "Northgate." with a red full stop, then a small uppercase caption.
  const short = name.replace(/\s+skating academy$/i, '')
  return (
    <div className="px-2.5 pb-4">
      <div className="truncate text-base font-extrabold tracking-tight text-white">
        {short}
        <span className="text-brand-500">.</span>
      </div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[.1em] text-neutral-500">
        Skating Academy
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
              'flex h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white',
              isActive &&
                'bg-white font-bold text-neutral-950 hover:bg-white hover:text-neutral-950',
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

function SidebarFooter() {
  const { data: count } = useActiveStudentCount()
  return (
    <div className="mt-auto border-t border-white/15 px-2.5 pt-4 text-xs leading-relaxed text-neutral-500">
      {count === undefined ? '' : `${count} active skater${count === 1 ? '' : 's'}`}
    </div>
  )
}

function Sidebar({ academyName, onNavigate }: { academyName: string; onNavigate?: () => void }) {
  return (
    <>
      <Wordmark name={academyName} />
      <NavList onNavigate={onNavigate} />
      <SidebarFooter />
    </>
  )
}

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const { data: academy } = useAcademy(profile?.academy_id)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [query, setQuery] = useState('')

  const academyName = academy?.name ?? 'Skating Academy'

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const q = query.trim()
    void navigate(q ? `/admin/students?q=${encodeURIComponent(q)}` : '/admin/students')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[216px] shrink-0 flex-col gap-0.5 bg-neutral-950 pb-4 pt-[18px] md:flex">
        <Sidebar academyName={academyName} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-4 border-b-2 border-neutral-300 bg-card px-5 py-3">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[216px] flex-col gap-0.5 bg-neutral-950 p-0 pb-4 pt-[18px]"
            >
              <Sidebar
                academyName={academyName}
                onNavigate={() => {
                  setDrawerOpen(false)
                }}
              />
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <div className="truncate text-[17px] font-extrabold leading-tight tracking-tight">
              {academyName}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[.08em] text-neutral-600">
              {screenLabel(pathname)}
            </div>
          </div>

          <form onSubmit={submitSearch} className="relative min-w-[160px] max-w-[420px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
              }}
              placeholder="Search skaters"
              aria-label="Search skaters"
              className="h-11 w-full rounded-lg border-[1.5px] border-neutral-300 bg-neutral-100 pl-10 pr-3.5 text-[15px] placeholder:text-neutral-500 focus:border-neutral-950 focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </form>

          <div className="ml-auto flex items-center gap-2.5">
            <Button
              variant="outline"
              size="icon"
              className="relative border-neutral-300"
              aria-label="Notifications"
              onClick={() => {
                void navigate('/admin/announcements')
              }}
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -right-1 -top-1">
                <UnreadBadge />
              </span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-11 items-center gap-2.5 rounded-lg pl-1 pr-2.5 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-neutral-950 text-[13px] font-bold text-white">
                      {profile ? initials(profile.full_name) : ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 text-left lg:block">
                    <div className="truncate text-[13px] font-bold">{profile?.full_name}</div>
                    <div className="text-[11px] text-neutral-700">Academy admin</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-bold">{profile?.full_name}</div>
                  <div className="text-xs text-neutral-700">{profile?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void signOut()
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
