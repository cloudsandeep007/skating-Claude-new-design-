import { useState } from 'react'

import {
  attendanceLabel,
  attendanceTone,
  computeTotals,
  pctColorClass,
  useMakeupCredits,
  useStudentHistory,
  type AttendanceHistoryRow,
} from '@/features/attendance'
import { addDays, formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useCurrentChild } from '../hooks/useSelectedChild'
import { lastMonths, monthGrid, monthLabel, shortMonthLabel } from '../hooks/monthGrid'
import { ChildSelector } from './ChildSelector'

const MONTHS = 6
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const DOT: Record<string, string> = {
  present: 'bg-success-500',
  late: 'bg-warning-500',
  absent: 'bg-brand-500',
  excused: 'bg-muted-foreground',
  unmarked: 'border border-muted-foreground/60',
}

/** The child's attendance as a month calendar: pick a month, see every
 * class as a coloured dot, tap a day for the detail. Six months of history
 * without six months of scrolling. */
export function AttendanceHistoryPage() {
  const { child, isLoading: loadingChild } = useCurrentChild()
  const today = todayIso()
  const thisMonth = today.slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const { data: rows, isLoading } = useStudentHistory(
    child?.id ?? null,
    `${lastMonths(thisMonth, MONTHS)[0]}-01`,
    addDays(today, 0),
  )
  const { data: makeupCredits } = useMakeupCredits(child?.id ?? null)

  if (loadingChild) return <Skeleton className="h-40 w-full rounded-lg" />
  if (!child) return <EmptyState title="No skater linked to your account" />

  const all = rows ?? []
  const overall = computeTotals(all.map((r) => r.status))
  const pendingCredits = (makeupCredits ?? []).filter((c) => c.status === 'pending').length
  const months = lastMonths(thisMonth, MONTHS)
  const monthRows = all.filter((r) => r.sessionDate.startsWith(month))
  const monthTotals = computeTotals(monthRows.map((r) => r.status))
  const byDay = new Map<string, AttendanceHistoryRow[]>()
  for (const r of monthRows) byDay.set(r.sessionDate, [...(byDay.get(r.sessionDate) ?? []), r])
  const listed = selectedDay ? (byDay.get(selectedDay) ?? []) : monthRows

  return (
    <div className="space-y-4">
      <ChildSelector subtitle="Attendance" />

      <div className="rounded-lg border border-primary/20 bg-card p-4 text-foreground shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Last {MONTHS} months
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span
            className={cn(
              'font-display text-4xl font-extrabold tracking-tight',
              pctColorClass(overall.pct),
            )}
          >
            {overall.pct === null ? '—' : `${overall.pct}%`}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            {overall.attended} of {overall.counted} classes
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${overall.pct ?? 0}%` }}
          />
        </div>
        {pendingCredits > 0 && (
          <div className="mt-3 rounded-md bg-warning-500/10 px-3 py-1.5 text-xs font-semibold text-warning-300">
            {pendingCredits} missed class{pendingCredits === 1 ? '' : 'es'} carried forward as
            make-up
            {pendingCredits === 1 ? '' : 's'}.
          </div>
        )}
      </div>

      {/* Month chips */}
      <div className="scroll-shadow-x -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {months.map((m) => {
          const t = computeTotals(
            all.filter((r) => r.sessionDate.startsWith(m)).map((r) => r.status),
          )
          const active = m === month
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMonth(m)
                setSelectedDay(null)
              }}
              className={cn(
                'flex shrink-0 flex-col items-center rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
                active
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground',
              )}
            >
              <span>{shortMonthLabel(m)}</span>
              <span
                className={cn(
                  'text-[10px] font-bold',
                  active ? 'text-primary' : pctColorClass(t.pct),
                )}
              >
                {t.pct === null ? '·' : `${t.pct}%`}
              </span>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="flex items-baseline gap-3 border-b px-4 py-3">
            <h2 className="font-bold">{monthLabel(month)}</h2>
            <span className="text-xs text-muted-foreground">
              {monthTotals.counted === 0
                ? 'no classes marked'
                : `${monthTotals.present + monthTotals.late} of ${monthTotals.counted} attended`}
            </span>
            <span className={cn('ml-auto text-lg font-extrabold', pctColorClass(monthTotals.pct))}>
              {monthTotals.pct === null ? '—' : `${monthTotals.pct}%`}
            </span>
          </div>

          <div className="px-3 pb-3 pt-2">
            <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase text-muted-foreground">
              {DOW.map((d, i) => (
                <div key={i} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid(month).map((cell, i) => {
                if (!cell.date) return <div key={i} />
                const dayRows = byDay.get(cell.date) ?? []
                const isToday = cell.date === today
                const selected = cell.date === selectedDay
                const future = cell.date > today
                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={dayRows.length === 0}
                    onClick={() => {
                      setSelectedDay(selected ? null : cell.date)
                    }}
                    className={cn(
                      'flex aspect-square flex-col items-center justify-center rounded-md text-sm',
                      dayRows.length > 0 ? 'bg-background font-bold' : 'text-muted-foreground/60',
                      selected && 'ring-2 ring-primary',
                      isToday && 'text-primary',
                      future && 'opacity-50',
                    )}
                  >
                    <span>{cell.day}</span>
                    {dayRows.length > 0 && (
                      <span className="mt-0.5 flex gap-0.5">
                        {dayRows.map((r) => (
                          <span
                            key={r.sessionId}
                            className={cn('h-1.5 w-1.5 rounded-full', DOT[r.status ?? 'unmarked'])}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-muted-foreground">
              <Legend cls={DOT.present} label="Present" />
              <Legend cls={DOT.late} label="Late" />
              <Legend cls={DOT.absent} label="Absent" />
              <Legend cls={DOT.excused} label="Excused" />
              <Legend cls={DOT.unmarked} label="Not marked" />
            </div>
          </div>

          <div className="border-t">
            <div className="flex items-center px-4 py-2 text-xs font-semibold text-muted-foreground">
              {selectedDay ? formatDate(selectedDay) : 'All classes this month'}
              {selectedDay && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDay(null)
                  }}
                  className="ml-auto font-bold underline-offset-2 hover:underline"
                >
                  Show whole month
                </button>
              )}
            </div>
            {listed.length === 0 ? (
              <div className="px-4 pb-4 text-sm text-muted-foreground">No classes this month.</div>
            ) : (
              <ul className="divide-y">
                {[...listed]
                  .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
                  .map((r) => (
                    <li
                      key={r.sessionId}
                      className="flex min-h-[48px] items-center gap-3 px-4 py-2 text-sm"
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
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('h-2 w-2 rounded-full', cls)} />
      {label}
    </span>
  )
}
