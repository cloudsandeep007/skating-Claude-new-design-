import { describe, expect, it } from 'vitest'

import { attendancePct, computeTotals, totalsByMonth } from './attendancePct'

describe('attendancePct', () => {
  it('counts present and late as attended', () => {
    expect(attendancePct(['present', 'present', 'late', 'absent'])).toBe(75)
  })

  it('excludes excused from both numerator and denominator', () => {
    expect(attendancePct(['present', 'excused', 'excused'])).toBe(100)
    expect(attendancePct(['absent', 'excused'])).toBe(0)
  })

  it('returns null, not 0, when nothing counts', () => {
    expect(attendancePct([])).toBeNull()
    expect(attendancePct(['excused'])).toBeNull()
    expect(attendancePct([null, undefined])).toBeNull()
  })

  it('ignores unmarked sessions', () => {
    expect(attendancePct(['present', null, 'absent'])).toBe(50)
  })

  it('rounds to one decimal place', () => {
    expect(attendancePct(['present', 'present', 'absent'])).toBe(66.7)
    expect(attendancePct(['present', 'absent', 'absent'])).toBe(33.3)
  })

  it('matches the SQL view definition on a realistic mix', () => {
    // 11 present, 1 absent, 2 late, 3 excused → (11+2)/(11+1+2) = 92.9
    const statuses = [
      ...Array<'present'>(11).fill('present'),
      'absent',
      'late',
      'late',
      'excused',
      'excused',
      'excused',
    ] as const
    const totals = computeTotals(statuses)
    expect(totals).toEqual({
      present: 11,
      absent: 1,
      late: 2,
      excused: 3,
      counted: 14,
      attended: 13,
      pct: 92.9,
    })
  })
})

describe('totalsByMonth', () => {
  it('groups by month, newest first, with per-month percentages', () => {
    const rows = [
      { sessionDate: '2026-08-03', status: 'present' as const },
      { sessionDate: '2026-08-05', status: 'absent' as const },
      { sessionDate: '2026-09-01', status: 'present' as const },
      { sessionDate: '2026-09-03', status: 'late' as const },
      { sessionDate: '2026-09-08', status: null },
    ]
    const result = totalsByMonth(rows)
    expect(result.map((r) => r.month)).toEqual(['2026-09', '2026-08'])
    expect(result[0].totals.pct).toBe(100)
    expect(result[0].totals.counted).toBe(2)
    expect(result[1].totals.pct).toBe(50)
  })
})
