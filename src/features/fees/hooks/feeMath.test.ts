import { describe, expect, it } from 'vitest'

import {
  canWaive,
  dueDate,
  isFullyPaid,
  isOverdue,
  isPeriodDue,
  isStubPeriod,
  nextPeriod,
  paidTotal,
  prorateCycleAmount,
  remainingBalance,
} from './feeMath'

describe('paidTotal — voided payments count for nothing', () => {
  it('sums live payments only', () => {
    expect(
      paidTotal([
        { amount: 1000, voidedAt: null },
        { amount: 600, voidedAt: '2026-09-15T10:00:00Z' },
        { amount: 500, voidedAt: null },
      ]),
    ).toBe(1500)
  })

  it('is 0 when every payment is voided', () => {
    expect(paidTotal([{ amount: 1600, voidedAt: '2026-09-15T10:00:00Z' }])).toBe(0)
  })

  it('is 0 with no payments', () => {
    expect(paidTotal([])).toBe(0)
  })

  it('rounds to the nearest paisa', () => {
    expect(paidTotal([{ amount: 33.33, voidedAt: null }, { amount: 33.33, voidedAt: null }, { amount: 33.34, voidedAt: null }])).toBe(100)
  })
})

describe('nextPeriod — fee generation', () => {
  it('a first invoice after a mid-month join is a stub to the end of that month', () => {
    expect(nextPeriod('monthly', null, '2026-03-10')).toEqual({
      periodStart: '2026-03-10',
      periodEnd: '2026-03-31',
    })
  })

  it('a first invoice for a join on the 1st is a full calendar month', () => {
    expect(nextPeriod('monthly', null, '2026-03-01')).toEqual({
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    })
  })

  it('after a stub, the next period is a clean calendar month', () => {
    expect(nextPeriod('monthly', '2026-03-31', '2026-03-10')).toEqual({
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    })
  })

  it('F-04: a legacy anniversary period is followed by a stub, never snapped back over days already billed', () => {
    // Old scheme: Aug 15 – Sep 14. The next period must start Sep 15, not Sep 1.
    expect(nextPeriod('monthly', '2026-09-14', '2026-08-15')).toEqual({
      periodStart: '2026-09-15',
      periodEnd: '2026-09-30',
    })
  })

  it('F-01: continues from the latest period on any plan — a plan switch never restarts at the join month', () => {
    // Joined Mar 10; old plan billed through Sep 30; switched plans Oct 1.
    expect(nextPeriod('monthly', '2026-09-30', '2026-03-10')).toEqual({
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    })
  })

  it('runs a full quarter for a quarterly plan starting on the 1st', () => {
    expect(nextPeriod('quarterly', '2026-06-30', '2026-01-01')).toEqual({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
    })
  })

  it('a quarterly plan joined mid-month gets a stub first, then full quarters', () => {
    expect(nextPeriod('quarterly', null, '2026-07-20')).toEqual({
      periodStart: '2026-07-20',
      periodEnd: '2026-07-31',
    })
    expect(nextPeriod('quarterly', '2026-07-31', '2026-07-20')).toEqual({
      periodStart: '2026-08-01',
      periodEnd: '2026-10-31',
    })
  })

  it('runs a full year for an annual plan', () => {
    expect(nextPeriod('annual', '2025-12-31', '2020-01-01')).toEqual({
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    })
  })

  it('a join on the last day of a month is a one-day stub', () => {
    expect(nextPeriod('monthly', null, '2026-01-31')).toEqual({
      periodStart: '2026-01-31',
      periodEnd: '2026-01-31',
    })
  })

  it('isStubPeriod is true for anything not on the 1st', () => {
    expect(isStubPeriod('2026-09-01')).toBe(false)
    expect(isStubPeriod('2026-09-02')).toBe(true)
    expect(isStubPeriod('2026-09-30')).toBe(true)
  })
})

describe('isPeriodDue — generation eligibility (F-03: generate ahead)', () => {
  it('is due when there is no period yet', () => {
    expect(isPeriodDue(null, '2026-09-14')).toBe(true)
  })

  it('is due once the last period has ended', () => {
    expect(isPeriodDue('2026-09-13', '2026-09-14')).toBe(true)
  })

  it('is due within the lead window before the current period ends', () => {
    // Ends Sep 30; today Sep 24 → 6 days out, inside the 7-day lead.
    expect(isPeriodDue('2026-09-30', '2026-09-24')).toBe(true)
  })

  it('is not due while the current period still has more than the lead window left', () => {
    // Ends Sep 30; today Sep 23 → 7 days out, not yet inside the lead window.
    expect(isPeriodDue('2026-09-30', '2026-09-23')).toBe(false)
    expect(isPeriodDue('2026-09-30', '2026-09-14')).toBe(false)
  })

  it('honours a custom lead window', () => {
    expect(isPeriodDue('2026-09-30', '2026-09-14', 30)).toBe(true)
    expect(isPeriodDue('2026-09-30', '2026-09-29', 0)).toBe(false)
    expect(isPeriodDue('2026-09-30', '2026-10-01', 0)).toBe(true)
  })
})

describe('dueDate — never born overdue (F-03)', () => {
  it('is grace days after the period start when generated ahead of time', () => {
    expect(dueDate('2026-10-01', '2026-09-24')).toBe('2026-10-06')
  })

  it('is grace days after today when the period already started (late run, mid-month join)', () => {
    expect(dueDate('2026-09-01', '2026-09-15')).toBe('2026-09-20')
  })

  it('is grace days after today when generated on the start date itself', () => {
    expect(dueDate('2026-10-01', '2026-10-01')).toBe('2026-10-06')
  })

  it('honours a custom grace', () => {
    expect(dueDate('2026-10-01', '2026-09-24', 0)).toBe('2026-10-01')
    expect(dueDate('2026-10-01', '2026-09-24', 10)).toBe('2026-10-11')
  })
})

describe('prorateCycleAmount — stub periods pay for the days they cover (F-04)', () => {
  it('charges the full amount for a full period', () => {
    expect(
      prorateCycleAmount(3000, 'monthly', { periodStart: '2026-09-01', periodEnd: '2026-09-30' }),
    ).toBe(3000)
  })

  it('pro-rates a monthly plan by days in the stub / days in the month', () => {
    // Sep 15–30 = 16 of 30 days → 3000 × 16/30 = 1600
    expect(
      prorateCycleAmount(3000, 'monthly', { periodStart: '2026-09-15', periodEnd: '2026-09-30' }),
    ).toBe(1600)
  })

  it('uses the monthly-equivalent for a quarterly plan', () => {
    // 9000/quarter = 3000/month → same 16/30 → 1600
    expect(
      prorateCycleAmount(9000, 'quarterly', { periodStart: '2026-09-15', periodEnd: '2026-09-30' }),
    ).toBe(1600)
  })

  it('uses the monthly-equivalent for an annual plan', () => {
    // 36000/year = 3000/month → Feb 15–28 = 14 of 28 days → 1500
    expect(
      prorateCycleAmount(36000, 'annual', { periodStart: '2026-02-15', periodEnd: '2026-02-28' }),
    ).toBe(1500)
  })

  it('rounds to the nearest paisa', () => {
    // 1000 × 10/31 = 322.58…
    expect(
      prorateCycleAmount(1000, 'monthly', { periodStart: '2026-10-22', periodEnd: '2026-10-31' }),
    ).toBe(322.58)
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
