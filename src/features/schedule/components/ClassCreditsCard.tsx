import { formatDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useClassCreditSummary, useCreditPlanStatus } from '../api/classBookings'
import { termLabel, termTone } from '../hooks/creditTerm'

/** Admin-facing view of a skater's class credits: the balance (or what
 * they owe), the plan term and when it lapses, and the ledger totalled by
 * kind. Not shown at all for a skater outside the credit system. */
export function ClassCreditsCard({ studentId }: { studentId: string }) {
  const { data: summary, isLoading } = useClassCreditSummary(studentId)
  const { data: plan } = useCreditPlanStatus(studentId)

  if (isLoading) return <Skeleton className="h-28 w-full rounded-lg" />
  if (summary?.available == null || !plan) return null

  const owes = summary.available < 0
  const term = plan.termStatus

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Class credits
        </h2>
        <StatusBadge tone={termTone(term)} className="ml-auto">
          {termLabel(plan)}
        </StatusBadge>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            'font-display text-3xl font-extrabold tracking-tight',
            owes ? 'text-brand-400' : 'text-primary',
          )}
        >
          {Math.abs(summary.available)}
        </span>
        <span className="text-sm font-semibold text-muted-foreground">
          {owes
            ? `class${summary.available === -1 ? '' : 'es'} owed — attended without credits`
            : 'available to book'}
        </span>
      </div>
      {plan.termEnd && (
        <p className="mt-1 text-xs text-muted-foreground">
          {term === 'expired'
            ? `Plan ended ${formatDate(plan.termEnd)} — unused classes expired.`
            : `Plan valid till ${formatDate(plan.termEnd)}${
                plan.daysLeft != null && plan.daysLeft <= 7
                  ? ` (${plan.daysLeft} day${plan.daysLeft === 1 ? '' : 's'} left)`
                  : ''
              }. Unused classes carry forward if renewed before then.`}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div>
          <dt className="text-xs text-muted-foreground">Bought / granted</dt>
          <dd className="font-bold">{summary.granted}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Spent</dt>
          <dd className="font-bold">{summary.spent}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Returned</dt>
          <dd className="font-bold">{summary.refunded}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Expired</dt>
          <dd className="font-bold">{summary.expired}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Adjusted</dt>
          <dd className="font-bold">{summary.adjusted}</dd>
        </div>
      </dl>
      {plan.pricingMode === 'per_class' && plan.minTopup != null && plan.rate != null && (
        <p className="mt-3 text-xs text-muted-foreground">
          Pay-per-class at ₹{plan.rate}/class. A {plan.billingCycle} term is at least{' '}
          {plan.minTopup} classes (₹{(plan.minTopup * plan.rate).toLocaleString('en-IN')}); smaller
          top-ups add classes to the current term.
        </p>
      )}
      {summary.available <= 0 && summary.granted === 0 && plan.pricingMode !== 'per_class' && (
        <p className="mt-3 text-xs text-warning-300">
          No credits granted yet — a fee period must be paid (or waived) before it counts.
        </p>
      )}
    </div>
  )
}
