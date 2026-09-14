import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'

interface ChartCardProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  isLoading: boolean
  isEmpty: boolean
  emptyDescription?: string
  height?: number
  children: React.ReactNode
}

/** One chart card's chrome — title, optional filter control, loading
 * skeleton, and an empty state when the academy has no data yet for it.
 * Every chart on the dashboard is wrapped in this, so none of them can
 * render a blank card. */
export function ChartCard({
  title,
  subtitle,
  action,
  isLoading,
  isEmpty,
  emptyDescription = "There's nothing to show here yet.",
  height = 220,
  children,
}: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle && <CardDescription className="mt-0.5">{subtitle}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="w-full rounded-lg" style={{ height }} />
        ) : isEmpty ? (
          <div style={{ height }} className="flex items-center">
            <EmptyState
              className="w-full border-0 shadow-none"
              title="No data yet"
              description={emptyDescription}
            />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
