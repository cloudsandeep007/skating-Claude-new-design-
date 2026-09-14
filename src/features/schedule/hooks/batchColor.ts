/** Stable colour per batch for the calendar — hashed from the id so a batch
 * keeps its colour across reloads and across weeks. Six ramps from the
 * design system; the 7th+ batch wraps around. */
const PALETTE = [
  'border-info-400 bg-info-50 text-info-900',
  'border-success-400 bg-success-50 text-success-900',
  'border-warning-400 bg-warning-50 text-warning-900',
  'border-brand-400 bg-brand-50 text-brand-900',
  'border-neutral-500 bg-neutral-100 text-neutral-900',
  'border-info-600 bg-info-100 text-info-900',
] as const

export function batchColorClass(batchId: string): string {
  let hash = 0
  for (let i = 0; i < batchId.length; i++) hash = (hash * 31 + batchId.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
