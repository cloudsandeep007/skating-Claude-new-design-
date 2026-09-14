import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'

import type { Trend } from '../hooks/trend'

interface StatCardProps {
  label: string
  value: string
  trend: Trend
  /** How to read the trend for this particular stat — "vs last month",
   * "21 students", etc. */
  trendCaption: string
  /** For a stat where "up" is bad (outstanding dues), flip the color rule. */
  invertColor?: boolean
  emphasize?: boolean
  isLoading: boolean
  /** How to render the delta number — plain for percentages/counts, ₹ for money. */
  formatDelta?: (n: number) => string
}

export function StatCard({
  label,
  value,
  trend,
  trendCaption,
  invertColor = false,
  emphasize = false,
  isLoading,
  formatDelta = (n) => String(n),
}: StatCardProps) {
  const goodDirection = invertColor ? trend.direction === 'down' : trend.direction === 'up'
  const Icon =
    trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus

  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', emphasize && 'border-brand-300')}>
      <div
        className={cn(
          'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
          emphasize && 'text-brand-800',
        )}
      >
        {label}
      </div>
      {isLoading ? (
        <Skeleton className="mt-2 h-9 w-28" />
      ) : (
        <>
          <div
            className={cn(
              'mt-2 text-[34px] font-extrabold leading-none tracking-tight',
              emphasize && 'text-brand-700',
            )}
          >
            {value}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {trend.direction !== 'flat' && (
              <span
                className={cn(
                  'flex items-center gap-1 text-sm font-bold',
                  goodDirection ? 'text-success-700' : 'text-brand-700',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {formatDelta(Math.abs(trend.delta))}
              </span>
            )}
            <span className="text-sm text-muted-foreground">{trendCaption}</span>
          </div>
        </>
      )}
    </div>
  )
}
