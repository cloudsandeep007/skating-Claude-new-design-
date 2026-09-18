import { describe, expect, it } from 'vitest'

import { lastMonths, monthGrid } from './monthGrid'

describe('lastMonths', () => {
  it('walks back across a year boundary, oldest first', () => {
    expect(lastMonths('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('monthGrid', () => {
  it('starts on Monday and pads to whole weeks', () => {
    // 1 Sep 2026 is a Tuesday → one leading blank.
    const cells = monthGrid('2026-09')
    expect(cells.length % 7).toBe(0)
    expect(cells[0].date).toBeNull()
    expect(cells[1].date).toBe('2026-09-01')
    expect(cells.filter((c) => c.date).length).toBe(30)
    expect(cells[30].date).toBe('2026-09-30')
  })
  it('handles a month starting on Monday with no leading blanks', () => {
    // 1 Jun 2026 is a Monday.
    const cells = monthGrid('2026-06')
    expect(cells[0].date).toBe('2026-06-01')
  })
})
