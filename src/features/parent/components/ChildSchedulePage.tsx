import { CalendarX2 } from 'lucide-react'

import { formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useChildUpcomingSessions } from '../api/childData'
import { useCurrentChild } from '../hooks/useSelectedChild'
import { ChildSelector } from './ChildSelector'

export function ChildSchedulePage() {
  const { child, isLoading: loadingChild } = useCurrentChild()
  const { data: sessions, isLoading } = useChildUpcomingSessions(child?.id ?? null, 30)
  const today = todayIso()

  if (loadingChild) return <Skeleton className="h-40 w-full rounded-lg" />
  if (!child) return <EmptyState title="No skater linked to your account" />

  return (
    <div className="space-y-4">
      <ChildSelector subtitle="Upcoming sessions" />

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : !sessions || sessions.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="Nothing scheduled yet"
          description="The academy publishes the schedule a few weeks at a time."
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const cancelled = s.status === 'cancelled'
            const isToday = s.sessionDate === today
            return (
              <li
                key={s.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm',
                  cancelled && 'opacity-70',
                  isToday && !cancelled && 'border-primary/40',
                )}
              >
                <div className="w-20 shrink-0">
                  <div className={cn('text-sm font-bold', isToday && 'text-primary')}>
                    {isToday ? 'Today' : formatDate(s.sessionDate)}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatTime(s.startTime)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn('font-bold', cancelled && 'line-through')}>{s.batchName}</div>
                  <div className="text-xs text-muted-foreground">
                    {cancelled
                      ? `Cancelled — ${s.cancellationReason}`
                      : [s.venue, s.coachName && `Coach ${s.coachName}`]
                          .filter(Boolean)
                          .join(' · ')}
                  </div>
                </div>
                {cancelled && <StatusBadge tone="danger">Cancelled</StatusBadge>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
