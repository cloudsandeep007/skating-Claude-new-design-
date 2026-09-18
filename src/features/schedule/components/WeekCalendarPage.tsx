import { useState } from 'react'
import { CalendarCheck, CalendarX2, ChevronLeft, ChevronRight, Inbox, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { addDays, formatDate, formatTime, toIsoDate, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'

import { usePendingBookingCount } from '../api/bookingRequests'
import { useHolidays } from '../api/holidays'
import { useSessions } from '../api/listSessions'
import { batchColorClass } from '../hooks/batchColor'
import type { SessionItem } from '../types'
import { AddSessionDialog } from './AddSessionDialog'
import { CancelSessionDialog } from './CancelSessionDialog'
import { HolidaysCard } from './HolidaysCard'
import { ScheduleMakeupDialog } from './ScheduleMakeupDialog'

/** Monday of the week containing the given date. */
function startOfWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return toIsoDate(d)
}

function weekLabel(monday: string): string {
  const start = new Date(`${monday}T00:00:00`)
  const end = new Date(`${addDays(monday, 6)}T00:00:00`)
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function WeekCalendarPage() {
  const today = todayIso()
  const { data: pendingRequests } = usePendingBookingCount()
  const [monday, setMonday] = useState(() => startOfWeek(today))
  const [cancelling, setCancelling] = useState<SessionItem | null>(null)
  const [schedulingMakeup, setSchedulingMakeup] = useState<SessionItem | null>(null)

  const sunday = addDays(monday, 6)
  const { data: sessions, isLoading } = useSessions({ from: monday, to: sunday })
  const { data: holidays } = useHolidays()

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const holidayByDate = new Map((holidays ?? []).map((h) => [h.date, h.name]))
  const sessionsByDate = new Map<string, SessionItem[]>()
  for (const s of sessions ?? []) {
    const list = sessionsByDate.get(s.sessionDate) ?? []
    list.push(s)
    sessionsByDate.set(s.sessionDate, list)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Schedule</h1>
          <div className="mt-1 text-sm text-muted-foreground">{weekLabel(monday)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous week"
            onClick={() => {
              setMonday((m) => addDays(m, -7))
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setMonday(startOfWeek(today))
            }}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next week"
            onClick={() => {
              setMonday((m) => addDays(m, 7))
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/schedule/bookings">
              <Inbox className="h-4 w-4" />
              Bookings
              {(pendingRequests ?? 0) > 0 && (
                <span className="ml-1 rounded-full bg-warning-500 px-1.5 text-[11px] font-extrabold leading-5 text-black">
                  {pendingRequests}
                </span>
              )}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/schedule/coming-up">
              <CalendarCheck className="h-4 w-4" />
              Coming up
            </Link>
          </Button>
          <AddSessionDialog defaultDate={monday >= today ? monday : today} />
        </div>
      </div>

      <div className="scroll-shadow-x overflow-x-auto rounded-lg border bg-card shadow-sm">
        <div className="grid min-w-[980px] grid-cols-7 divide-x">
          {days.map((date) => {
            const isToday = date === today
            const holiday = holidayByDate.get(date)
            const daySessions = sessionsByDate.get(date) ?? []
            const d = new Date(`${date}T00:00:00`)
            return (
              <div key={date} className="min-h-[420px]">
                <div
                  className={cn(
                    'border-b-2 px-3 py-2.5',
                    isToday ? 'border-foreground bg-muted' : 'border-border bg-muted/60',
                  )}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <div className={cn('text-lg font-extrabold', isToday && 'text-primary')}>
                    {d.getDate()}
                  </div>
                </div>

                <div className="space-y-2 p-2">
                  {holiday && (
                    <div className="rounded-md border border-dashed border-warning-500 bg-warning-500/10 px-2.5 py-2 text-xs font-bold text-warning-300">
                      Holiday · {holiday}
                    </div>
                  )}

                  {isLoading
                    ? Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-md" />
                      ))
                    : daySessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          canCancel={session.status === 'scheduled' && session.sessionDate >= today}
                          onCancel={() => {
                            setCancelling(session)
                          }}
                          onScheduleMakeup={() => {
                            setSchedulingMakeup(session)
                          }}
                        />
                      ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!isLoading && sessions?.length === 0 && (
        <EmptyState
          icon={CalendarX2}
          title="Nothing scheduled this week"
          description="Generate a schedule from a batch's page, or add a one-off session."
        />
      )}

      <HolidaysCard />

      <CancelSessionDialog
        session={cancelling}
        onClose={() => {
          setCancelling(null)
        }}
      />

      <ScheduleMakeupDialog
        session={schedulingMakeup}
        onClose={() => {
          setSchedulingMakeup(null)
        }}
      />
    </div>
  )
}

function SessionCard({
  session,
  canCancel,
  onCancel,
  onScheduleMakeup,
}: {
  session: SessionItem
  canCancel: boolean
  onCancel: () => void
  onScheduleMakeup: () => void
}) {
  const cancelled = session.status === 'cancelled'
  return (
    <div
      className={cn(
        'rounded-md border-l-[3px] border px-2.5 py-2 text-xs',
        cancelled
          ? 'border-border bg-muted text-muted-foreground opacity-70'
          : batchColorClass(session.batchId),
      )}
    >
      <div className="font-mono text-[11px] font-semibold">
        {formatTime(session.startTime)} – {formatTime(session.endTime)}
      </div>
      <div className={cn('mt-0.5 text-sm font-bold leading-tight', cancelled && 'line-through')}>
        {session.batchName}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] opacity-80">
        {session.coachName && <span className="truncate">{session.coachName}</span>}
        <span className="ml-auto inline-flex items-center gap-0.5">
          <Users className="h-3 w-3" />
          {session.studentCount}
        </span>
      </div>
      {(session.bookedCount > 0 || session.requestedCount > 0) && (
        <div className="mt-1 text-[11px] font-semibold opacity-80">
          {session.bookedCount > 0 && `Booked: ${session.bookedCount}`}
          {session.bookedCount > 0 && session.requestedCount > 0 && ' · '}
          {session.requestedCount > 0 && (
            <span className="text-warning-300">Requested: {session.requestedCount}</span>
          )}
        </div>
      )}
      {session.makeupForDate && (
        <div className="mt-1 text-[11px] font-semibold">
          Make-up for {formatDate(session.makeupForDate)}
        </div>
      )}
      {cancelled ? (
        <>
          <div className="mt-1.5 text-[11px] italic">Cancelled: {session.cancellationReason}</div>
          {session.makeupScheduledDate ? (
            <div className="mt-1 text-[11px] font-bold">
              Make-up: {formatDate(session.makeupScheduledDate)}
            </div>
          ) : (
            <button
              type="button"
              onClick={onScheduleMakeup}
              className="mt-1.5 text-[11px] font-bold text-primary underline-offset-2 hover:underline"
            >
              Schedule make-up
            </button>
          )}
        </>
      ) : (
        canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-1.5 text-[11px] font-bold text-brand-400 underline-offset-2 hover:underline"
          >
            Cancel session
          </button>
        )
      )}
    </div>
  )
}
