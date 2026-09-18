/** Helpers for the parent's month-at-a-glance attendance calendar. */

/** "2026-09" → the six month keys ending at that month, oldest first. */
export function lastMonths(endMonth: string, count: number): string[] {
  const [y, m] = endMonth.split('-').map(Number)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export interface GridCell {
  /** ISO date, or null for a leading/trailing blank so weeks start on Monday. */
  date: string | null
  day: number | null
}

/** A Monday-first 6×7 grid of the month, padded with blanks. */
export function monthGrid(month: string): GridCell[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const daysInMonth = new Date(y, m, 0).getDate()
  const lead = (first.getDay() + 6) % 7 // Monday = 0
  const cells: GridCell[] = []
  for (let i = 0; i < lead; i++) cells.push({ date: null, day: null })
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${month}-${String(d).padStart(2, '0')}`, day: d })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null })
  return cells
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function shortMonthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' })
}
