import type { AttendanceStatus, AttendanceTotals } from '../types'

/** The one attendance rule, matching the SQL views in 0001_initial_schema.sql:
 *   attended = present + late
 *   counted  = present + absent + late
 *   pct      = attended / counted, rounded to 1 decimal
 * Excused never helps or hurts. No counted sessions → null (not 0%). */
export function computeTotals(
  statuses: Iterable<AttendanceStatus | null | undefined>,
): AttendanceTotals {
  const totals: AttendanceTotals = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    counted: 0,
    attended: 0,
    pct: null,
  }

  for (const status of statuses) {
    if (!status) continue
    totals[status] += 1
  }

  totals.attended = totals.present + totals.late
  totals.counted = totals.present + totals.absent + totals.late
  totals.pct =
    totals.counted === 0 ? null : Math.round((1000 * totals.attended) / totals.counted) / 10

  return totals
}

export function attendancePct(
  statuses: Iterable<AttendanceStatus | null | undefined>,
): number | null {
  return computeTotals(statuses).pct
}

/** Groups history rows by "YYYY-MM" for the parent's monthly summary. */
export function totalsByMonth(
  rows: { sessionDate: string; status: AttendanceStatus | null }[],
): { month: string; totals: AttendanceTotals }[] {
  const byMonth = new Map<string, (AttendanceStatus | null)[]>()
  for (const row of rows) {
    const month = row.sessionDate.slice(0, 7)
    const list = byMonth.get(month) ?? []
    list.push(row.status)
    byMonth.set(month, list)
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, statuses]) => ({ month, totals: computeTotals(statuses) }))
}
