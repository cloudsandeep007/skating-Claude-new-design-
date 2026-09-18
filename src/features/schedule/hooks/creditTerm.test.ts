import { describe, expect, it } from 'vitest'

import { daysBetween, planTopup, termStatus } from './creditTerm'

const monthly = {
  billingCycle: 'monthly' as const,
  rate: 500,
  minTopup: 8,
  termStart: '2026-10-01',
  termEnd: '2026-10-31',
  termStatus: 'active' as const,
}

describe('termStatus — mirrors credit_plan_status()', () => {
  it('is none without a term', () => {
    expect(termStatus(null, '2026-09-16')).toBe('none')
  })
  it('is expired the day after the term ends', () => {
    expect(termStatus('2026-09-15', '2026-09-16')).toBe('expired')
  })
  it('is active on the last day of the term', () => {
    expect(termStatus('2026-09-16', '2026-09-16')).toBe('expiring')
  })
  it('is expiring within 7 days, active beyond', () => {
    expect(termStatus('2026-09-23', '2026-09-16')).toBe('expiring')
    expect(termStatus('2026-09-24', '2026-09-16')).toBe('active')
  })
  it('daysBetween counts whole days', () => {
    expect(daysBetween('2026-09-16', '2026-09-30')).toBe(14)
  })
})

describe('planTopup — mirrors record_credit_topup()', () => {
  it('below the minimum inside an active term adds classes to the same term', () => {
    expect(planTopup(monthly, 2, '2026-09-16')).toEqual({
      kind: 'extra',
      termStart: '2026-10-01',
      termEnd: '2026-10-31',
      amount: 1000,
    })
  })

  it('at the minimum inside an active term renews: the next term follows straight on', () => {
    expect(planTopup(monthly, 8, '2026-09-16')).toEqual({
      kind: 'renewal',
      termStart: '2026-11-01',
      termEnd: '2026-11-30',
      amount: 4000,
    })
  })

  it('an expiring term renews the same way', () => {
    expect(planTopup({ ...monthly, termStatus: 'expiring' }, 10, '2026-10-28')).toMatchObject({
      kind: 'renewal',
      termStart: '2026-11-01',
      termEnd: '2026-11-30',
      amount: 5000,
    })
  })

  it('with no plan, the minimum applies and the term starts on the payment date', () => {
    const fresh = { ...monthly, termStart: null, termEnd: null, termStatus: 'none' as const }
    expect(planTopup(fresh, 3, '2026-09-16')).toBeNull()
    expect(planTopup(fresh, 8, '2026-09-16')).toEqual({
      kind: 'new',
      termStart: '2026-09-16',
      termEnd: '2026-10-15',
      amount: 4000,
    })
  })

  it('a lapsed plan is treated like no plan', () => {
    const lapsed = {
      ...monthly,
      termStart: '2026-07-01',
      termEnd: '2026-07-31',
      termStatus: 'expired' as const,
    }
    expect(planTopup(lapsed, 7, '2026-09-16')).toBeNull()
    expect(planTopup(lapsed, 8, '2026-09-16')).toMatchObject({
      kind: 'new',
      termStart: '2026-09-16',
    })
  })

  it('quarterly and annual minimums and lengths', () => {
    const quarterly = {
      ...monthly,
      billingCycle: 'quarterly' as const,
      minTopup: 24,
      termStatus: 'none' as const,
      termStart: null,
      termEnd: null,
    }
    expect(planTopup(quarterly, 23, '2026-09-16')).toBeNull()
    expect(planTopup(quarterly, 24, '2026-09-16')).toMatchObject({
      kind: 'new',
      termEnd: '2026-12-15',
      amount: 12000,
    })
    const annual = { ...quarterly, billingCycle: 'annual' as const, minTopup: 96 }
    expect(planTopup(annual, 96, '2026-09-16')).toMatchObject({
      kind: 'new',
      termEnd: '2027-09-15',
      amount: 48000,
    })
  })

  it('a renewal from a month-end term clamps like Postgres (Jan 31 + 1 month)', () => {
    const jan = { ...monthly, termStart: '2026-01-01', termEnd: '2026-01-31' }
    expect(planTopup(jan, 8, '2026-01-20')).toMatchObject({
      termStart: '2026-02-01',
      termEnd: '2026-02-28',
    })
  })

  it('rejects nonsense', () => {
    expect(planTopup(monthly, 0, '2026-09-16')).toBeNull()
    expect(planTopup({ ...monthly, rate: null }, 8, '2026-09-16')).toBeNull()
  })
})
