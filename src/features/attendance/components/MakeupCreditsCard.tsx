import { toast } from 'sonner'

import { formatDate } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useFulfillMakeupCredit, useMakeupCredits } from '../api/makeupCredits'

/** Classes this student personally missed (absence, or a session cancelled
 * and never made up as a batch) that the academy still owes them — granted
 * automatically when a coach marks them absent. An admin clears one once the
 * student has attended the make-up. */
export function MakeupCreditsCard({ studentId }: { studentId: string }) {
  const { data: credits, isLoading } = useMakeupCredits(studentId)
  const fulfill = useFulfillMakeupCredit()

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />

  const pending = (credits ?? []).filter((c) => c.status === 'pending')

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Make-up credits
      </h2>
      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No make-up classes owed — every missed session has been made up.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pending.map((credit) => (
            <li
              key={credit.id}
              className="flex items-center gap-3 rounded-md border border-warning-500/40 bg-warning-500/10 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold">{credit.batchName}</div>
                <div className="text-xs text-muted-foreground">
                  Missed {formatDate(credit.reasonDate)}
                </div>
              </div>
              <StatusBadge tone="warning">Owed</StatusBadge>
              <Button
                size="sm"
                variant="outline"
                disabled={fulfill.isPending}
                onClick={() => {
                  fulfill.mutate(
                    { creditId: credit.id },
                    {
                      onSuccess: () => {
                        toast.success('Make-up credit marked fulfilled.')
                      },
                      onError: () => {
                        toast.error('Could not update this credit.')
                      },
                    },
                  )
                }}
              >
                Mark fulfilled
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
