import { describe, expect, it } from 'vitest'

import { eligibleFeePlans, planNoLongerFits } from './eligiblePlans'

const plans = [
  { id: 'wide', batchId: null },
  { id: 'beg', batchId: 'batch-beginner' },
  { id: 'int', batchId: 'batch-intermediate' },
]

describe('eligibleFeePlans', () => {
  it('offers academy-wide plans and the batch’s own plans only', () => {
    expect(eligibleFeePlans(plans, 'batch-intermediate').map((p) => p.id)).toEqual(['wide', 'int'])
  })
  it('offers only academy-wide plans before a batch is chosen', () => {
    expect(eligibleFeePlans(plans, '').map((p) => p.id)).toEqual(['wide'])
  })
})

describe('planNoLongerFits', () => {
  it('flags a plan scoped to a different batch', () => {
    expect(planNoLongerFits(plans, 'beg', 'batch-intermediate')).toBe(true)
  })
  it('keeps academy-wide and matching plans', () => {
    expect(planNoLongerFits(plans, 'wide', 'batch-intermediate')).toBe(false)
    expect(planNoLongerFits(plans, 'int', 'batch-intermediate')).toBe(false)
  })
  it('ignores an empty or unknown selection', () => {
    expect(planNoLongerFits(plans, '', 'batch-intermediate')).toBe(false)
    expect(planNoLongerFits(plans, 'gone', 'batch-intermediate')).toBe(false)
  })
})
