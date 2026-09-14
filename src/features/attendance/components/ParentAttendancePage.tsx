import { useEffect, useState } from 'react'

import { useAuth } from '@/features/auth'
import { addDays, formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useStudentHistory } from '../api/adminQueries'
import { useMyChildren } from '../api/myChildren'
import { computeTotals, totalsByMonth } from '../hooks/attendancePct'
import { attendanceLabel, attendanceTone, pctColorClass } from '../hooks/attendanceTone'

function monthLabel(yyyyMm: string) {
  return new Date(`${yyyyMm}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/** Parent home: one child's attendance, last six months, month by month. */
export function ParentAttendancePage() {
  const { profile } = useAuth()
  const { data: children, isLoading: loadingChildren } = useMyChildren(profile?.id)
  const [childId, setChildId] = useState<string | null>(null)

  useEffect(() => {
    if (childId === null && children && children.length > 0) setChildId(children[0].id)
  }, [children, childId])

  const today = todayIso()
  const { data: rows, isLoading } = useStudentHistory(childId, addDays(today, -182), today)

  if (loadingChildren) return <Skeleton className="h-40 w-full rounded-lg" />
  if (!children || children.length === 0) {
    return (
      <EmptyState
        title="No skater linked to your account"
        description="Ask the academy to link your child to this login."
      />
    )
  }

  const overall = computeTotals((rows ?? []).map((r) => r.status))
  const months = totalsByMonth(rows ?? [])
  const child = children.find((c) => c.id === childId)

  return (
    <div className="space-y-4">
      {children.length > 1 ? (
        <Select value={childId ?? ''} onValueChange={setChildId}>
          <SelectTrigger className="h-12 text-base font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {children.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <h1 className="text-2xl font-extrabold tracking-tight">{child?.fullName}</h1>
      )}

      <div className="rounded-lg bg-neutral-950 p-4 text-white">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Attendance · last 6 months
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tracking-tight">
            {overall.pct === null ? '—' : `${overall.pct}%`}
          </span>
          <span className="text-sm font-semibold text-neutral-300">
            {overall.attended} of {overall.counted} sessions
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${overall.pct ?? 0}%` }} />
        </div>
      </div>

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
              <span className="text-success-700">{totals.present} present</span>
              <span className="text-warning-800">{totals.late} late</span>
              <span className="text-brand-700">{totals.absent} absent</span>
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
