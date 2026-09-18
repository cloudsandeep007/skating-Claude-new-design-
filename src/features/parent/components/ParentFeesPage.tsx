import { ParentFeesOverview } from '@/features/fees'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'

import { useCurrentChild } from '../hooks/useSelectedChild'
import { ChildSelector } from './ChildSelector'

/** What is owed now, the current period, live top-ups and the last receipt
 * — ParentFeesOverview (from the fees feature) does the work; this screen
 * just adds the child switcher on top, same as the other parent screens. */
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
      <ParentFeesOverview studentId={child.id} />
    </div>
  )
}
