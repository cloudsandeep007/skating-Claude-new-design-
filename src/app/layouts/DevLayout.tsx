import { LogOut } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/features/auth'
import { cn } from '@/shared/lib/utils'

// Screens from the Developer Console mockup. Only Overview exists yet; the
// others are placeholders so the rail matches the spec and links resolve.
const NAV_ITEMS = [
  { to: '/dev', label: 'Overview', meta: 'stats · api health', end: true },
  { to: '/dev/academies', label: 'Academies', meta: 'tenants', end: false },
  { to: '/dev/errors', label: 'Error log', meta: 'sentry-compatible', end: false },
  { to: '/dev/flags', label: 'Feature flags', meta: 'overrides beat global', end: false },
  { to: '/dev/audit', label: 'Jobs and audit', meta: 'audit retained 400 days', end: false },
]

const APP_ENV = import.meta.env.VITE_APP_ENV
const HOST = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL).host
  } catch {
    return 'unknown host'
  }
})()

const ENV_STYLE: Record<string, { bar: string; rule: string; label: string }> = {
  production: {
    bar: 'bg-brand-600 text-white',
    rule: 'bg-white/55 border-white/55',
    label: '● PRODUCTION',
  },
  staging: {
    bar: 'bg-warning-300 text-warning-900',
    rule: 'bg-warning-900/45 border-warning-900/45',
    label: '● STAGING',
  },
  development: {
    bar: 'bg-info-400 text-white',
    rule: 'bg-white/55 border-white/55',
    label: '● DEVELOPMENT',
  },
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Super-admin console: the academy admin's type and spacing inverted onto an
 * ink ground, denser rows, monospace for ids/hosts, and a full-width
 * environment banner so it's never mistaken for an academy screen. */
export function DevLayout() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const env = ENV_STYLE[APP_ENV] ?? ENV_STYLE.development
  const screen =
    [...NAV_ITEMS]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to))) ??
    NAV_ITEMS[0]

  return (
    <div className="dark flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <div
        className={cn('flex h-10 flex-wrap items-center gap-3.5 px-4 font-mono text-xs', env.bar)}
      >
        <span className="font-extrabold tracking-[.22em]">{env.label}</span>
        <span className={cn('h-[18px] w-px', env.rule)} />
        <span className="font-semibold tracking-wide">{HOST}</span>
        <span className="font-semibold tracking-wide opacity-80">build {import.meta.env.MODE}</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[212px] shrink-0 flex-col gap-0.5 border-r border-white/10 bg-ink-rail px-2.5 py-3.5 md:flex">
          <div className="px-2 pb-3.5">
            <div className="text-sm font-extrabold tracking-tight">
              Skating<span className="text-brand-500">/</span>dev
            </div>
            <div className="mt-1 font-mono text-[10px] tracking-[.14em] text-neutral-600">
              SUPER ADMIN
            </div>
          </div>
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex h-[38px] items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-100',
                    isActive && 'bg-white/[.14] font-bold text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-[2px]',
                        isActive ? 'bg-brand-500' : 'bg-neutral-600',
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto border-t border-white/10 px-2 pt-3 font-mono text-[10px] leading-[1.7] text-neutral-600">
            {HOST}
            <br />
            {APP_ENV} · vite {import.meta.env.MODE}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 flex-wrap items-center gap-3.5 border-b border-white/10 bg-ink-surface px-4 py-2">
            <span className="text-[15px] font-bold tracking-tight">{screen.label}</span>
            <span className="font-mono text-[11px] text-neutral-500">{screen.meta}</span>
            <div className="ml-auto flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-mono text-[11px] font-bold text-white">
                {profile ? initials(profile.full_name) : 'DV'}
              </span>
              <button
                type="button"
                aria-label="Sign out"
                onClick={() => {
                  void signOut()
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 text-sm">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
