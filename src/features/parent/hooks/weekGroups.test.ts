import { describe, expect, it } from 'vitest'

import { groupByWeek, mondayOf } from './weekGroups'

describe('mondayOf', () => {
  it('returns the Monday for any day of the week', () => {
    expect(mondayOf('2026-09-19')).toBe('2026-09-14') // Saturday
    expect(mondayOf('2026-09-20')).toBe('2026-09-14') // Sunday
    expect(mondayOf('2026-09-21')).toBe('2026-09-21') // Monday
  })
})

describe('groupByWeek', () => {
  const rows = [
    { sessionDate: '2026-09-28', id: 'c' },
    { sessionDate: '2026-09-19', id: 'a' },
    { sessionDate: '2026-09-22', id: 'b' },
    { sessionDate: '2026-10-06', id: 'd' },
  ]
  it('buckets by Monday and labels this / next / later weeks', () => {
    const g = groupByWeek(rows, '2026-09-19')
    expect(g.map((x) => x.items.map((i) => i.id))).toEqual([['a'], ['b'], ['c'], ['d']])
    expect(g.map((x) => x.index)).toEqual([0, 1, 2, 3])
    expect(g.map((x) => x.monday)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'])
    expect(g[0].label).toBe('This week')
    expect(g[1].label).toBe('Next week')
    // Later weeks read as a date range (month names follow the locale).
    expect(g[2].label).toMatch(/^28 \w+ – 4 \w+$/)
    expect(g[3].label).toMatch(/^5 \w+ – 11 \w+$/)
  })
  it('is empty for no rows', () => {
    expect(groupByWeek([], '2026-09-19')).toEqual([])
  })
})
