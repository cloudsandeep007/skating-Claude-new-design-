/** Stable colour per batch for the calendar — hashed from the id so a batch
 * keeps its colour across reloads and across weeks. Six ramps from the
 * design system; the 7th+ batch wraps around. */
const PALETTE = [
  'border-info-500 bg-info-500/10 text-info-300',
  'border-success-500 bg-success-500/10 text-success-300',
  'border-warning-500 bg-warning-500/10 text-warning-300',
  'border-brand-500 bg-brand-500/10 text-brand-300',
  'border-border bg-muted text-foreground',
  'border-info-600 bg-info-500/15 text-info-200',
] as const

export function batchColorClass(batchId: string): string {
  let hash = 0
  for (let i = 0; i < batchId.length; i++) hash = (hash * 31 + batchId.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
