import { formatDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'

import { useCreditLedger } from '../api/classBookings'
import { ledgerLineLabel } from '../hooks/ledgerLine'

/** Every credit movement, newest first, with the reason and who did it —
 * the answer to "why is my balance 3?". */
export function CreditStatementCard({ studentId }: { studentId: string }) {
  const { data: entries, isLoading } = useCreditLedger(studentId)

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />
  if (!entries || entries.length === 0) return null

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Credit statement
      </h2>
      <ul className="mt-2 divide-y">
        {entries.map((e) => (
          <li key={e.id} className="flex items-start gap-3 py-2 text-sm">
            <span
              className={cn(
                'w-10 shrink-0 text-right font-mono font-bold tabular-nums',
                e.delta > 0 ? 'text-success-300' : 'text-brand-400',
              )}
            >
              {e.delta > 0 ? `+${e.delta}` : e.delta}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{ledgerLineLabel(e)}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(e.createdAt.slice(0, 10))}
                {e.actorName && ` · by ${e.actorName}`}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
