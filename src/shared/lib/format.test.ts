import { describe, expect, it } from 'vitest'

import { addDays, formatDays, formatTime, formatTimeRange, toIsoDate } from './format'

describe('formatTime', () => {
  it('converts Postgres time to 12-hour', () => {
    expect(formatTime('06:30:00')).toBe('6:30 AM')
    expect(formatTime('17:00:00')).toBe('5:00 PM')
    expect(formatTime('00:05:00')).toBe('12:05 AM')
    expect(formatTime('12:00:00')).toBe('12:00 PM')
  })

  it('accepts HH:MM without seconds', () => {
    expect(formatTimeRange('18:00', '19:30')).toBe('6:00 PM – 7:30 PM')
  })
})

describe('formatDays', () => {
  it('sorts and labels days of week', () => {
    expect(formatDays([5, 1, 3])).toBe('Mon, Wed, Fri')
    expect(formatDays([0, 6])).toBe('Sun, Sat')
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('round-trips through toIsoDate in local time', () => {
    expect(toIsoDate(new Date(2026, 8, 14))).toBe('2026-09-14')
  })
})
