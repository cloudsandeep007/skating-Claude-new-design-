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

import prsaLogo from '@/assets/prsa-logo.png'
import { UnreadBadge } from '@/features/announcements'
import { useAcademy, useAuth } from '@/features/auth'
import { useActiveStudentCount } from '@/features/students'
import { useLiveSync } from '@/shared/hooks/useLiveSync'
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
  return (
    <div className="px-2.5 pb-4">
      <img src={prsaLogo} alt="PRSA" className="h-auto w-[168px]" />
      <div className="mt-1.5 truncate text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">
        {name}
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
              'flex h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground',
              isActive &&
                'bg-primary/15 font-bold text-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] hover:bg-primary/15 hover:text-primary',
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
    <div className="mt-auto border-t border-white/10 px-2.5 pt-4 text-xs leading-relaxed text-muted-foreground">
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
  useLiveSync(!!profile)
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
      <aside className="hidden w-[216px] shrink-0 flex-col gap-0.5 border-r border-white/10 bg-background pb-4 pt-[18px] md:flex">
        <Sidebar academyName={academyName} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-4 border-b border-white/10 bg-background/80 px-5 py-3 backdrop-blur-xl">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[216px] flex-col gap-0.5 bg-background p-0 pb-4 pt-[18px]"
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
            <div className="text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">
              {screenLabel(pathname)}
            </div>
          </div>

          <form onSubmit={submitSearch} className="relative min-w-[160px] max-w-[420px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
              }}
              placeholder="Search skaters"
              aria-label="Search skaters"
              className="h-11 w-full rounded-lg border-[1.5px] border-border bg-card pl-10 pr-3.5 text-[15px] placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </form>

          <div className="ml-auto flex items-center gap-2.5">
            <Button
              variant="outline"
              size="icon"
              className="relative"
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
                  className="flex h-11 items-center gap-2.5 rounded-lg pl-1 pr-2.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-[13px] font-bold text-primary-foreground">
                      {profile ? initials(profile.full_name) : ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 text-left lg:block">
                    <div className="truncate text-[13px] font-bold">{profile?.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">Academy admin</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-bold">{profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground">{profile?.email}</div>
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
