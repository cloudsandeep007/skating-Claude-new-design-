import { CalendarDays, ChevronRight, ClipboardCheck, IndianRupee, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAnnouncementFeed } from '@/features/announcements'
import { computeTotals, pctColorClass, useStudentHistory } from '@/features/attendance'
import { useAuth } from '@/features/auth'
import { formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge, type StatusTone } from '@/shared/ui/StatusBadge'

import { useChildFeeStatus, useChildUpcomingSessions } from '../api/childData'
import { useCurrentChild } from '../hooks/useSelectedChild'
import { ChildSelector } from './ChildSelector'

const FEE_TONE: Record<string, StatusTone> = {
  paid: 'success',
  pending: 'warning',
  overdue: 'danger',
  waived: 'outline',
}

const FEE_LABEL: Record<string, string> = {
  paid: 'Paid',
  pending: 'Due',
  overdue: 'Overdue',
  waived: 'Waived',
}

function rupees(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function ParentHomePage() {
  const { profile } = useAuth()
  const { child, isLoading } = useCurrentChild()
  const today = todayIso()
  const monthStart = `${today.slice(0, 7)}-01`

  const { data: upcoming } = useChildUpcomingSessions(child?.id ?? null, 5)
  const { data: monthRows } = useStudentHistory(child?.id ?? null, monthStart, today)
  const { data: fee } = useChildFeeStatus(child?.id ?? null)
  const { data: feed } = useAnnouncementFeed(profile?.id)

  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />
  if (!child) {
    return (
      <EmptyState
        title="No skater linked to your account"
        description="Ask the academy to link your child to this login."
      />
    )
  }

  const next = upcoming?.find((s) => s.status !== 'cancelled') ?? null
  const month = computeTotals((monthRows ?? []).map((r) => r.status))
  const latest = feed?.[0] ?? null
  const monthName = new Date(`${monthStart}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
  })

  return (
    <div className="space-y-4">
      <ChildSelector subtitle="Skater" />

      <Link
        to="/parent/schedule"
        className="block rounded-lg border border-primary/20 bg-card p-4 text-foreground shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Next session
          <ChevronRight className="ml-auto h-4 w-4" />
        </div>
        {next ? (
          <>
            <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight">
              {next.sessionDate === today ? 'Today' : formatDate(next.sessionDate)}
              <span className="text-muted-foreground"> · </span>
              {formatTime(next.startTime)}
            </div>
            <div className="mt-1 text-sm font-semibold text-muted-foreground">
              {next.batchName}
              {next.venue && ` · ${next.venue}`}
              {next.coachName && ` · Coach ${next.coachName}`}
            </div>
          </>
        ) : (
          <div className="mt-1.5 text-lg font-bold text-muted-foreground">Nothing scheduled yet</div>
        )}
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/parent/attendance" className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardCheck className="h-3.5 w-3.5" />
            {monthName}
          </div>
          <div
            className={cn(
              'mt-1.5 text-3xl font-extrabold tracking-tight',
              pctColorClass(month.pct),
            )}
          >
            {month.pct === null ? '—' : `${month.pct}%`}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {month.counted === 0
              ? 'no sessions marked yet'
              : `${month.attended} of ${month.counted} sessions`}
          </div>
        </Link>

        <Link to="/parent/fees" className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <IndianRupee className="h-3.5 w-3.5" />
            Fees
          </div>
          {fee ? (
            <>
              <div className="mt-1.5">
                <StatusBadge tone={FEE_TONE[fee.status] ?? 'neutral'}>
                  {FEE_LABEL[fee.status] ?? fee.status}
                </StatusBadge>
              </div>
              <div className="mt-1.5 text-sm font-bold">{rupees(fee.amount)}</div>
              <div className="text-xs text-muted-foreground">
                {fee.status === 'paid' ? 'for' : 'due'} {formatDate(fee.dueDate)}
              </div>
            </>
          ) : (
            <div className="mt-1.5 text-sm text-muted-foreground">No fees yet</div>
          )}
        </Link>
      </div>

      <section>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5" />
          Latest announcement
          <Link
            to="/parent/announcements"
            className="ml-auto font-bold text-brand-400 normal-case tracking-normal"
          >
            See all
          </Link>
        </div>
        {latest ? (
          <Link
            to="/parent/announcements"
            className={cn(
              'block rounded-lg border bg-card p-4 shadow-sm',
              latest.notificationId && !latest.readAt && 'border-primary/40',
            )}
          >
            <div className="flex items-start gap-2">
              {latest.notificationId && !latest.readAt && (
                <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" />
              )}
              <div className="min-w-0">
                <div className="font-bold leading-tight">{latest.title}</div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{latest.body}</p>
              </div>
            </div>
          </Link>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Nothing from the academy yet.
          </div>
        )}
      </section>
    </div>
  )
}
