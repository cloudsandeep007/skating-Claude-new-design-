import { cn } from '@/shared/lib/utils'

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'dark' | 'outline'

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-success-500/15 text-success-300',
  warning: 'bg-warning-500/15 text-warning-300',
  danger: 'bg-brand-500/15 text-brand-300',
  neutral: 'bg-secondary text-secondary-foreground',
  dark: 'bg-background text-foreground border border-white/10',
  outline: 'bg-transparent text-foreground border border-border',
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
