import { describe, expect, it } from 'vitest'

import type { CreditLedgerEntry } from '../api/classBookings'
import { creditBreakdown, ledgerLineLabel } from './ledgerLine'

function line(over: Partial<CreditLedgerEntry>): CreditLedgerEntry {
  return {
    id: 'l',
    delta: -1,
    kind: 'spend',
    reason: 'Class requested',
    createdAt: '2026-09-19T10:00:00Z',
    actorName: null,
    sessionDate: '2026-09-21',
    batchName: 'Beginner',
    bookingSource: 'parent',
    ...over,
  }
}

describe('ledgerLineLabel', () => {
  it('names the class a reservation is for', () => {
    expect(ledgerLineLabel(line({}))).toMatch(/^Reserved for .*21 Sep.* · Beginner$/)
  })
  it('says attended once the coach marks present, and flags walk-ins', () => {
    expect(ledgerLineLabel(line({ reason: 'Marked present' }))).toMatch(/^Attended .*21 Sep/)
    expect(
      ledgerLineLabel(line({ reason: 'Attended without booking', bookingSource: 'attendance' })),
    ).toMatch(/walk-in, not booked/)
  })
  it('explains every kind of return', () => {
    expect(
      ledgerLineLabel(line({ kind: 'refund', delta: 1, reason: 'Marked absent — class returned' })),
    ).toMatch(/absent on/)
    expect(ledgerLineLabel(line({ kind: 'refund', delta: 1, reason: 'Request declined' }))).toMatch(
      /declined$/,
    )
    expect(
      ledgerLineLabel(line({ kind: 'refund', delta: 1, reason: 'Booking cancelled' })),
    ).toMatch(/cancelled$/)
  })
  it('falls back to kind + reason for non-booking lines', () => {
    expect(
      ledgerLineLabel(
        line({
          kind: 'grant',
          delta: 8,
          reason: 'Top-up',
          sessionDate: null,
          batchName: null,
          bookingSource: null,
        }),
      ),
    ).toBe('Added — Top-up')
  })
})

describe('creditBreakdown', () => {
  it('splits bought into attended, booked ahead and left', () => {
    expect(creditBreakdown({ granted: 8, attended: 2, reserved: 3, available: 3 })).toEqual({
      bought: 8,
      attended: 2,
      booked: 3,
      left: 3,
    })
  })
  it('never shows a negative "left"', () => {
    expect(creditBreakdown({ granted: 0, attended: 1, reserved: 0, available: -1 }).left).toBe(0)
  })
})
