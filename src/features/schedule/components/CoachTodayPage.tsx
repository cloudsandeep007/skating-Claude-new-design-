import { CalendarCheck, CheckCircle2, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth'
import { addDays, formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'

import { useSessions } from '../api/listSessions'
import { useMyCoachId } from '../api/myCoach'
import type { SessionItem } from '../types'

/** The coach's rink-side home: today first, then yesterday's sessions that
 * are still inside the 24-hour marking window. Tap a session to mark it. */
export function CoachTodayPage() {
  const { profile } = useAuth()
  const { data: coachId, isLoading: loadingCoach } = useMyCoachId(profile?.id)
  const today = todayIso()
  const yesterday = addDays(today, -1)
  const { data: sessions, isLoading } = useSessions({
    from: yesterday,
    to: today,
    coachId: coachId ?? undefined,
  })

  const heading = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  if (!loadingCoach && coachId === null) {
    return (
      <EmptyState
        title="No coach record for this login"
        description="Ask your academy admin to add you as a coach."
      />
    )
  }

  if (loadingCoach || isLoading || !coachId) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    )
  }

  const todays = sessions?.filter((s) => s.sessionDate === today) ?? []
  const yesterdays =
    sessions?.filter((s) => s.sessionDate === yesterday && s.status !== 'cancelled') ?? []
  const live = todays.filter((s) => s.status !== 'cancelled')

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{heading}</h1>
        <div className="mt-1 text-sm text-muted-foreground">
          {live.length === 0
            ? 'No sessions'
            : `${live.length} session${live.length === 1 ? '' : 's'}`}
        </div>
      </div>

      {todays.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing on today"
          description="Enjoy the day off — your next session will show up here."
        />
      ) : (
        <div className="space-y-3">
          {todays.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}

      {yesterdays.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Yesterday · still open for changes
          </div>
          <div className="space-y-3">
            {yesterdays.map((session) => (
              <SessionCard key={session.id} session={session} muted />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SessionCard({ session, muted = false }: { session: SessionItem; muted?: boolean }) {
  const cancelled = session.status === 'cancelled'
  const fullyMarked = session.markedCount >= session.studentCount && session.studentCount > 0

  const inner = (
    <>
      <div className={cn('text-xs font-semibold uppercase tracking-wide', 'text-muted-foreground')}>
        {muted && `${formatDate(session.sessionDate)} · `}
        {formatTime(session.startTime)} – {formatTime(session.endTime)}
        {session.venue && ` · ${session.venue}`}
      </div>
      <div
        className={cn('mt-1 text-xl font-extrabold tracking-tight', cancelled && 'line-through')}
      >
        {session.batchName}
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
        <span className={cancelled ? 'text-muted-foreground' : 'text-foreground'}>
          {cancelled
            ? `Cancelled — ${session.cancellationReason}`
            : `${session.studentCount} skater${session.studentCount === 1 ? '' : 's'}`}
        </span>
        {!cancelled && session.markedCount > 0 && (
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 text-xs font-bold',
              fullyMarked ? 'text-success-400' : 'text-warning-300',
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {fullyMarked ? 'Marked' : `${session.markedCount}/${session.studentCount} marked`}
          </span>
        )}
        {!cancelled && (
          <ChevronRight className={cn('h-5 w-5', session.markedCount === 0 && 'ml-auto')} />
        )}
      </div>
    </>
  )

  const className = cn(
    'block rounded-lg p-4 shadow-sm',
    cancelled || muted
      ? 'border bg-card text-foreground'
      : 'border border-primary/20 bg-card text-foreground shadow-[0_0_20px_-8px_hsl(var(--primary)/0.3)]',
    !cancelled && 'active:opacity-90',
  )

  if (cancelled) return <div className={className}>{inner}</div>
  return (
    <Link to={`/coach/attendance/${session.id}`} className={className}>
      {inner}
    </Link>
  )
}
