import {
  attendanceLabel,
  attendanceTone,
  computeTotals,
  pctColorClass,
  totalsByMonth,
  useMakeupCredits,
  useStudentHistory,
} from '@/features/attendance'
import { addDays, formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useCurrentChild } from '../hooks/useSelectedChild'
import { ChildSelector } from './ChildSelector'

function monthLabel(yyyyMm: string) {
  return new Date(`${yyyyMm}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/** The child's attendance, last six months, month by month. */
export function AttendanceHistoryPage() {
  const { child, isLoading: loadingChild } = useCurrentChild()
  const today = todayIso()
  const { data: rows, isLoading } = useStudentHistory(
    child?.id ?? null,
    addDays(today, -182),
    today,
  )
  const { data: makeupCredits } = useMakeupCredits(child?.id ?? null)

  if (loadingChild) return <Skeleton className="h-40 w-full rounded-lg" />
  if (!child) return <EmptyState title="No skater linked to your account" />

  const overall = computeTotals((rows ?? []).map((r) => r.status))
  const months = totalsByMonth(rows ?? [])
  const expected = rows?.length ?? 0
  const pendingCredits = (makeupCredits ?? []).filter((c) => c.status === 'pending').length

  return (
    <div className="space-y-4">
      <ChildSelector subtitle="Attendance" />

      <div className="rounded-lg border border-primary/20 bg-card p-4 text-foreground shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Last 6 months
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-4xl font-extrabold tracking-tight text-primary">
            {overall.pct === null ? '—' : `${overall.pct}%`}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            {overall.attended} of {overall.counted} sessions
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${overall.pct ?? 0}%` }} />
        </div>
        <div className="mt-3 text-xs font-semibold text-muted-foreground">
          Expected {expected} · Attended {overall.attended}
          {pendingCredits > 0 &&
            ` · ${pendingCredits} make-up class${pendingCredits === 1 ? '' : 'es'} owed`}
        </div>
      </div>

      {pendingCredits > 0 && (
        <div className="rounded-lg border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-sm font-semibold text-warning-300">
          {pendingCredits} missed class{pendingCredits === 1 ? '' : 'es'} carried forward — your
          academy owes {pendingCredits === 1 ? 'a make-up class' : 'make-up classes'}.
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : months.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Attendance will appear after the first class."
        />
      ) : (
        months.map(({ month, totals }) => (
          <section key={month} className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="flex items-baseline gap-3 border-b px-4 py-3">
              <h2 className="font-bold">{monthLabel(month)}</h2>
              <span className={cn('ml-auto text-lg font-extrabold', pctColorClass(totals.pct))}>
                {totals.pct === null ? '—' : `${totals.pct}%`}
              </span>
            </div>
            <div className="flex gap-4 border-b px-4 py-2 text-xs font-semibold text-muted-foreground">
              <span className="text-success-400">{totals.present} present</span>
              <span className="text-warning-300">{totals.late} late</span>
              <span className="text-brand-400">{totals.absent} absent</span>
              {totals.excused > 0 && <span>{totals.excused} excused</span>}
            </div>
            <ul className="divide-y">
              {(rows ?? [])
                .filter((r) => r.sessionDate.startsWith(month))
                .map((r) => (
                  <li
                    key={r.sessionId}
                    className="flex min-h-[52px] items-center gap-3 px-4 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{formatDate(r.sessionDate)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(r.startTime)} · {r.batchName}
                      </div>
                    </div>
                    <StatusBadge tone={attendanceTone(r.status)}>
                      {attendanceLabel(r.status)}
                    </StatusBadge>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
