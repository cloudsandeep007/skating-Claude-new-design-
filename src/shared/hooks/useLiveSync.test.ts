import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { invalidateForTable, TABLE_QUERY_KEYS } from './useLiveSync'

describe('invalidateForTable', () => {
  it('a booking change refreshes the parent schedule, the roster and the queue', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue()
    invalidateForTable(qc, 'class_bookings')
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(keys).toContain(JSON.stringify(['bookings']))
    expect(keys).toContain(JSON.stringify(['parent', 'upcoming']))
    expect(keys).toContain(JSON.stringify(['attendance', 'session']))
  })
  it('ignores tables it does not know', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue()
    invalidateForTable(qc, 'audit_logs')
    expect(spy).not.toHaveBeenCalled()
  })
  it('every published table has a mapping', () => {
    for (const t of [
      'students',
      'student_fees',
      'payments',
      'attendance',
      'fee_plans',
      'batches',
      'schedule_sessions',
    ]) {
      expect(TABLE_QUERY_KEYS[t].length).toBeGreaterThan(0)
    }
  })
})
