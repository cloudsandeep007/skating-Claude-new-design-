import { describe, expect, it } from 'vitest'

import {
  canWaive,
  isFullyPaid,
  isOverdue,
  isPeriodDue,
  nextPeriod,
  remainingBalance,
} from './feeMath'

describe('nextPeriod — fee generation', () => {
  it('starts a first invoice on the join date when there is no prior period', () => {
    expect(nextPeriod('monthly', null, '2026-03-10')).toEqual({
      periodStart: '2026-03-10',
      periodEnd: '2026-04-09',
    })
  })

  it('starts the next period the day after the last one ended', () => {
    expect(nextPeriod('monthly', '2026-06-30', '2026-01-01')).toEqual({
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    })
  })

  it('runs a full quarter for a quarterly plan', () => {
    expect(nextPeriod('quarterly', '2026-06-30', '2026-01-01')).toEqual({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
    })
  })

  it('runs a full year for an annual plan', () => {
    expect(nextPeriod('annual', '2025-12-31', '2020-01-01')).toEqual({
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    })
  })

  it('clamps a period starting on the 31st into a short month, matching Postgres (Jan 31 + 1mo = Feb 28, then -1 day = Feb 27)', () => {
    expect(nextPeriod('monthly', null, '2026-01-31')).toEqual({
      periodStart: '2026-01-31',
      periodEnd: '2026-02-27',
    })
  })
})

describe('isPeriodDue — generation eligibility', () => {
  it('is due when there is no period yet', () => {
    expect(isPeriodDue(null, '2026-09-14')).toBe(true)
  })

  it('is due once the last period has ended', () => {
    expect(isPeriodDue('2026-09-13', '2026-09-14')).toBe(true)
  })

  it('is not due while the current period is still ongoing', () => {
    expect(isPeriodDue('2026-09-30', '2026-09-14')).toBe(false)
  })

  it('is not due on the last day of the current period', () => {
    expect(isPeriodDue('2026-09-14', '2026-09-14')).toBe(false)
  })
})

describe('isOverdue — overdue transitions', () => {
  it('flips a pending fee overdue once the due date has passed', () => {
    expect(isOverdue('pending', '2026-09-01', '2026-09-02')).toBe(true)
  })

  it('is not overdue on the due date itself', () => {
    expect(isOverdue('pending', '2026-09-14', '2026-09-14')).toBe(false)
  })

  it('is not overdue before the due date', () => {
    expect(isOverdue('pending', '2026-09-20', '2026-09-14')).toBe(false)
  })

  it('a paid fee never becomes overdue, even past its due date', () => {
    expect(isOverdue('paid', '2026-01-01', '2026-09-14')).toBe(false)
  })

  it('a waived fee never becomes overdue', () => {
    expect(isOverdue('waived', '2026-01-01', '2026-09-14')).toBe(false)
  })

  it('an already-overdue fee is not re-flagged by this rule (it only flips pending -> overdue)', () => {
    expect(isOverdue('overdue', '2026-01-01', '2026-09-14')).toBe(false)
  })
})

describe('remainingBalance and isFullyPaid — partial payments', () => {
  it('a partial payment leaves a positive balance and does not count as fully paid', () => {
    expect(remainingBalance(2500, 1000)).toBe(1500)
    expect(isFullyPaid(2500, 1000)).toBe(false)
  })

  it('paying the exact amount clears the balance and counts as fully paid', () => {
    expect(remainingBalance(2500, 2500)).toBe(0)
    expect(isFullyPaid(2500, 2500)).toBe(true)
  })

  it('several partial payments summed together clear the balance', () => {
    const paid = 1000 + 1500
    expect(remainingBalance(2500, paid)).toBe(0)
    expect(isFullyPaid(2500, paid)).toBe(true)
  })

  it('an overpayment never produces a negative balance', () => {
    expect(remainingBalance(2500, 3000)).toBe(0)
    expect(isFullyPaid(2500, 3000)).toBe(true)
  })

  it('no payment yet means the full amount is still owed', () => {
    expect(remainingBalance(2500, 0)).toBe(2500)
    expect(isFullyPaid(2500, 0)).toBe(false)
  })

  it('rounds to the nearest cent', () => {
    expect(remainingBalance(100, 33.33)).toBe(66.67)
  })
})

describe('canWaive — waivers', () => {
  it('a pending fee can be waived', () => {
    expect(canWaive('pending')).toBe(true)
  })

  it('an overdue fee can be waived', () => {
    expect(canWaive('overdue')).toBe(true)
  })

  it('an already-paid fee cannot be waived', () => {
    expect(canWaive('paid')).toBe(false)
  })

  it('an already-waived fee cannot be waived again', () => {
    expect(canWaive('waived')).toBe(false)
  })
})
