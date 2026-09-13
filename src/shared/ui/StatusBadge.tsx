import { cn } from '@/shared/lib/utils'

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'dark' | 'outline'

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-success-100 text-success-800',
  warning: 'bg-warning-100 text-warning-900',
  danger: 'bg-brand-100 text-brand-800',
  neutral: 'bg-neutral-200 text-neutral-900',
  dark: 'bg-neutral-950 text-white',
  outline: 'bg-white text-neutral-900 border border-neutral-400',
}

/** Pill status label matching the design system's Badge component — not
 * interactive (no hover/focus state). If a status can be changed by the
 * user, use a Button or Select instead of this. */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
