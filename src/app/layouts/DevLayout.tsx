import { Gauge, LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/features/auth'
import { cn } from '@/shared/lib/utils'

const NAV_ITEMS = [{ to: '/dev', label: 'Overview', icon: Gauge, end: true }]

const APP_ENV = import.meta.env.VITE_APP_ENV
const IS_PRODUCTION = APP_ENV === 'production'

/** Super-admin-only console. Deliberately dark and dense so it never looks
 * like the academy admin UI — and always shows which environment it's hitting. */
export function DevLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="dark flex min-h-screen bg-neutral-950 font-mono text-neutral-100">
      <aside className="hidden w-52 shrink-0 border-r border-neutral-800 md:block">
        <div className="p-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Dev Console
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-neutral-900',
                  isActive && 'bg-neutral-900 text-white',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className={cn(
            'flex h-8 items-center justify-center text-xs font-bold uppercase tracking-widest',
            IS_PRODUCTION ? 'bg-red-600 text-white' : 'bg-yellow-500 text-black',
          )}
        >
          {APP_ENV}
        </div>

        <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-4 text-sm">
          <span className="text-neutral-400">{profile?.full_name}</span>
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => {
              void signOut()
            }}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="flex-1 p-6 text-sm">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
