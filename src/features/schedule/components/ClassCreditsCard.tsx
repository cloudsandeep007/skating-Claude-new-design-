import { Skeleton } from '@/shared/ui/skeleton'

import { useClassCreditSummary } from '../api/classBookings'

/** Admin-facing breakdown of a student's class-credit balance — granted
 * (from paid/waived fees only), spent on bookings, bonus from pending
 * make-up credits, and the resulting available count. Null (not shown at
 * all) for a student not on a batch-scoped plan. */
export function ClassCreditsCard({ studentId }: { studentId: string }) {
  const { data: summary, isLoading } = useClassCreditSummary(studentId)

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />
  if (summary?.available == null) return null

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Class credits
      </h2>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-extrabold tracking-tight text-primary">
          {summary.available}
        </span>
        <span className="text-sm font-semibold text-muted-foreground">available to book</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Granted (paid)</dt>
          <dd className="font-bold">{summary.granted}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Booked</dt>
          <dd className="font-bold">{summary.booked}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Make-up bonus</dt>
          <dd className="font-bold">{summary.bonus}</dd>
        </div>
      </dl>
      {summary.available <= 0 && summary.granted === 0 && (
        <p className="mt-3 text-xs text-warning-300">
          No credits granted yet — a fee period must be paid (or waived) before it counts.
        </p>
      )}
    </div>
  )
}
