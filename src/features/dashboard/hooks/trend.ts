export interface Trend {
  direction: 'up' | 'down' | 'flat'
  /** Absolute change, already rounded for display. */
  delta: number
  /** Percent change, when the previous value is meaningful as a base. */
  pctChange: number | null
}

/** Compares a current value to a prior one for a stat card's trend arrow.
 * `null` values (no data for one side) come back "flat" rather than a
 * misleading arrow. */
export function computeTrend(current: number | null, previous: number | null): Trend {
  if (current === null || previous === null) return { direction: 'flat', delta: 0, pctChange: null }
  const delta = Math.round((current - previous) * 10) / 10
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const pctChange =
    previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10
  return { direction, delta, pctChange }
}
