import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'

export interface StatCardTrend {
  direction: 'up' | 'down' | 'flat'
  /** Absolute change, already rounded for display. */
  delta: number
}

interface StatCardProps {
  label: string
  value: string
  trend: StatCardTrend
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

/** A KPI tile: label, big value, a trend arrow ± color, and a caption.
 * Used across the admin dashboard and any other screen that needs a
 * glanceable metric (fees hub, progression analytics). */
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
    <div className={cn('rounded-xl border border-border bg-card p-4 shadow-sm', emphasize && 'border-brand-500/40')}>
      <div
        className={cn(
          'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
          emphasize && 'text-brand-300',
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
              'mt-2 font-display text-[34px] font-extrabold leading-none tracking-tight text-primary',
              emphasize && 'text-brand-400',
            )}
          >
            {value}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {trend.direction !== 'flat' && (
              <span
                className={cn(
                  'flex items-center gap-1 text-sm font-bold',
                  goodDirection ? 'text-success-400' : 'text-brand-400',
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
