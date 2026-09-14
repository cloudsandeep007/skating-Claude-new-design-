import { CalendarCheck } from 'lucide-react'

import { useAuth } from '@/features/auth'
import { formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'

import { useSessions } from '../api/listSessions'
import { useMyCoachId } from '../api/myCoach'

/** The coach's rink-side home: just today, biggest first thing on screen. */
export function CoachTodayPage() {
  const { profile } = useAuth()
  const { data: coachId, isLoading: loadingCoach } = useMyCoachId(profile?.id)
  const today = todayIso()
  const { data: sessions, isLoading } = useSessions({
    from: today,
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

  const live = sessions?.filter((s) => s.status !== 'cancelled') ?? []

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{heading}</h1>
        <div className="mt-1 text-sm text-muted-foreground">
          {live.length === 0
            ? 'No sessions'
            : `${live.length} session${live.length === 1 ? '' : 's'}`}
        </div>
      </div>

      {sessions?.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing on today"
          description="Enjoy the day off — your next session will show up here."
        />
      ) : (
        <div className="space-y-3">
          {sessions?.map((session) => {
            const cancelled = session.status === 'cancelled'
            return (
              <div
                key={session.id}
                className={cn(
                  'rounded-lg p-4 shadow-sm',
                  cancelled ? 'border bg-muted text-muted-foreground' : 'bg-neutral-950 text-white',
                )}
              >
                <div
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wide',
                    cancelled ? 'text-muted-foreground' : 'text-neutral-400',
                  )}
                >
                  {formatTime(session.startTime)} – {formatTime(session.endTime)}
                  {session.venue && ` · ${session.venue}`}
                </div>
                <div
                  className={cn(
                    'mt-1 text-xl font-extrabold tracking-tight',
                    cancelled && 'line-through',
                  )}
                >
                  {session.batchName}
                </div>
                <div
                  className={cn(
                    'mt-3 text-sm font-semibold',
                    cancelled ? 'text-muted-foreground' : 'text-neutral-300',
                  )}
                >
                  {cancelled
                    ? `Cancelled — ${session.cancellationReason}`
                    : `${session.studentCount} skater${session.studentCount === 1 ? '' : 's'}`}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
