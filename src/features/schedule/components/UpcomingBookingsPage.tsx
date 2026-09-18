import { ArrowLeft, CalendarCheck, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { useSignedPhotoUrls } from '@/shared/lib/signedPhotoUrls'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PersonAvatar } from '@/shared/ui/PersonAvatar'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useUpcomingBookings, type UpcomingBooking } from '../api/classBookings'
import { cn } from '@/shared/lib/utils'

const DAYS = 7

interface SessionGroup {
  sessionId: string
  sessionDate: string
  startTime: string
  endTime: string
  batchName: string
  venue: string | null
  coachName: string | null
  skaters: UpcomingBooking[]
}

/** "Who's coming": every booked skater on every session in the next week,
 * grouped by day → session, so the admin and coach can plan the rink
 * around who has actually reserved a place. */
export function UpcomingBookingsPage() {
  const { data, isLoading, isError, refetch } = useUpcomingBookings(DAYS)
  const { data: photoUrls } = useSignedPhotoUrls(
    'student-photos',
    (data ?? []).map((b) => b.photoUrl),
  )
  const today = todayIso()

  const byDay = new Map<string, SessionGroup[]>()
  for (const b of data ?? []) {
    const sessions = byDay.get(b.sessionDate) ?? []
    let group = sessions.find((s) => s.sessionId === b.sessionId)
    if (!group) {
      group = {
        sessionId: b.sessionId,
        sessionDate: b.sessionDate,
        startTime: b.startTime,
        endTime: b.endTime,
        batchName: b.batchName,
        venue: b.venue,
        coachName: b.coachName,
        skaters: [],
      }
      sessions.push(group)
    }
    group.skaters.push(b)
    byDay.set(b.sessionDate, sessions)
  }
  const confirmed = (data ?? []).filter((b) => b.status === 'booked').length
  const requested = (data ?? []).filter((b) => b.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/admin/schedule"
            className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Schedule
          </Link>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Coming up</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Who has booked a place in the next {DAYS} days
            {!isLoading &&
              ` · ${confirmed} confirmed${requested > 0 ? ` · ${requested} awaiting approval` : ''}`}
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/schedule/bookings">
            <Inbox className="h-4 w-4" />
            Bookings queue
          </Link>
        </Button>
      </div>

      {isError ? (
        <EmptyState
          tone="error"
          title="Couldn't load bookings"
          description="Check your connection and try again."
          action={
            <Button
              variant="outline"
              onClick={() => {
                void refetch()
              }}
            >
              Try again
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : byDay.size === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No bookings yet"
          description={`Nobody has booked a class in the next ${DAYS} days. Parents book from their Schedule page up to a week ahead.`}
        />
      ) : (
        <div className="space-y-6">
          {[...byDay.entries()].map(([date, sessions]) => (
            <section key={date}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {date === today ? 'Today' : formatDate(date)}
              </h2>
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div key={s.sessionId} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-bold">{s.batchName}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                        {s.venue && ` · ${s.venue}`}
                        {s.coachName && ` · Coach ${s.coachName}`}
                      </span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <StatusBadge tone="success">
                          {s.skaters.filter((b) => b.status === 'booked').length} coming
                        </StatusBadge>
                        {s.skaters.some((b) => b.status === 'pending') && (
                          <StatusBadge tone="warning">
                            {s.skaters.filter((b) => b.status === 'pending').length} requested
                          </StatusBadge>
                        )}
                      </span>
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {s.skaters.map((b) => (
                        <li key={b.studentId}>
                          <Link
                            to={`/admin/students/${b.studentId}`}
                            className={cn(
                              'flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3 text-sm font-semibold hover:border-primary',
                              b.status === 'pending' && 'border-dashed border-warning-500/60 text-warning-300',
                            )}
                            title={b.status === 'pending' ? 'Awaiting approval' : 'Confirmed'}
                          >
                            <PersonAvatar
                              name={b.fullName}
                              photoUrl={b.photoUrl ? photoUrls?.[b.photoUrl] : undefined}
                              className="h-6 w-6"
                              fallbackClassName="bg-secondary text-[10px]"
                            />
                            {b.fullName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
