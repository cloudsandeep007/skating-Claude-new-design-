import type { LucideIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  /** 'empty' = nothing yet, no problem (dashed neutral box) · 'error' = say what happened
   * (red box) · 'dark' = the developer console's ink surfaces. */
  tone?: 'empty' | 'error' | 'dark'
  className?: string
}

/** The design system's empty/error state: left-aligned, a 56px icon box,
 * a 19px title, one line of plain-language help, then the way forward. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'empty',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-lg border px-5 py-8',
        tone === 'dark' ? 'border-white/10 bg-ink-surface text-neutral-100' : 'bg-card',
        className,
      )}
    >
      <div
        className={cn(
          'mb-4 flex h-14 w-14 items-center justify-center rounded-xl',
          tone === 'error' && 'border-[1.5px] border-brand-200 bg-brand-50 text-brand-700',
          tone === 'empty' &&
            'border-[1.5px] border-dashed border-neutral-400 bg-neutral-100 text-neutral-600',
          tone === 'dark' &&
            'border-[1.5px] border-dashed border-white/25 bg-ink-surface2 text-neutral-400',
        )}
      >
        {Icon && <Icon className="h-6 w-6" aria-hidden="true" />}
      </div>
      <div className="text-[19px] font-bold leading-tight">{title}</div>
      {description && (
        <p
          className={cn(
            'mt-1.5 max-w-[42ch] text-[15px] leading-relaxed',
            tone === 'dark' ? 'text-neutral-400' : 'text-neutral-700',
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex flex-wrap gap-2.5">{action}</div>}
    </div>
  )
}
