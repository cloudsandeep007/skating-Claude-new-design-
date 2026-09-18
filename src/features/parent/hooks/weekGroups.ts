import { addDays, toIsoDate } from '@/shared/lib/format'

/** Monday of the week containing the given date. */
export function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return toIsoDate(d)
}

export interface WeekGroup<T> {
  /** 0 = this week, 1 = next week, 2+ = later. */
  index: number
  monday: string
  label: string
  items: T[]
}

function shortRange(monday: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(addDays(monday, 6))}`
}

/** Splits dated rows into "This week / Next week / Week of …" buckets, in
 * date order, so a long schedule reads as a handful of sections instead of
 * one endless list. */
export function groupByWeek<T extends { sessionDate: string }>(
  rows: T[],
  today: string,
): WeekGroup<T>[] {
  const thisMonday = mondayOf(today)
  const groups = new Map<string, WeekGroup<T>>()
  for (const r of [...rows].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))) {
    const monday = mondayOf(r.sessionDate)
    let g = groups.get(monday)
    if (!g) {
      const index = Math.round(
        (new Date(`${monday}T00:00:00`).getTime() - new Date(`${thisMonday}T00:00:00`).getTime()) /
          (7 * 86_400_000),
      )
      g = {
        index,
        monday,
        label:
          index === 0
            ? 'This week'
            : index === 1
              ? 'Next week'
              : index < 0
                ? `Week of ${shortRange(monday)}`
                : shortRange(monday),
        items: [],
      }
      groups.set(monday, g)
    }
    g.items.push(r)
  }
  return [...groups.values()].sort((a, b) => a.monday.localeCompare(b.monday))
}
