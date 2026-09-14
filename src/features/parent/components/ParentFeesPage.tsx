import { PaymentHistoryList } from '@/features/fees'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'

import { useCurrentChild } from '../hooks/useSelectedChild'
import { ChildSelector } from './ChildSelector'

/** Current dues and a receipt-style payment history — PaymentHistoryList
 * (from the fees feature) already covers both; this screen just adds the
 * child switcher on top, same as the other parent screens. */
export function ParentFeesPage() {
  const { child, isLoading } = useCurrentChild()

  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />
  if (!child) {
    return (
      <EmptyState
        title="No skater linked to your account"
        description="Ask the academy to link your child to this login."
      />
    )
  }

  return (
    <div className="space-y-4">
      <ChildSelector subtitle="Fees" />
      <PaymentHistoryList studentId={child.id} />
    </div>
  )
}
