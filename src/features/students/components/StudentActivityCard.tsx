import { formatDate } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'

import { useStudentActivity } from '../api/studentActivity'
import { describeActivity } from '../hooks/activityText'

/** Who changed what, when — the skater's audit trail in plain language.
 * Every row here is written automatically by the database's audit
 * triggers; nothing can be edited or removed from it. */
export function StudentActivityCard({ studentId }: { studentId: string }) {
  const { data, isLoading, isError, refetch } = useStudentActivity(studentId)

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />
  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load activity"
        description="Check your connection and try again."
        action={
          <button
            type="button"
            onClick={() => {
              void refetch()
            }}
            className="text-sm font-bold underline"
          >
            Try again
          </button>
        }
      />
    )
  }
  if (!data || data.length === 0) {
    return <EmptyState title="No activity yet" description="Changes to this skater's fees, payments, bookings and attendance will show up here." />
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Activity</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Every change to this skater's fees, payments, bookings and attendance, recorded automatically.
        Newest first.
      </p>
      <ul className="mt-3 divide-y">
        {data.map((e) => {
          const { headline, details } = describeActivity(e)
          return (
            <li key={e.id} className="py-2.5 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{headline}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(e.createdAt.slice(0, 10))}
                  {' · '}
                  {new Date(e.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  {e.actorName ? ` · ${e.actorName}` : ' · system'}
                </span>
              </div>
              {details.length > 0 && (
                <ul className="mt-0.5 text-xs text-muted-foreground">
                  {details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
