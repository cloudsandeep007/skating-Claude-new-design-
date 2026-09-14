import { describe, expect, it } from 'vitest'

import { computeTrend } from './trend'

describe('computeTrend', () => {
  it('is up when the current value is higher', () => {
    expect(computeTrend(120, 100)).toEqual({ direction: 'up', delta: 20, pctChange: 20 })
  })

  it('is down when the current value is lower', () => {
    expect(computeTrend(80, 100)).toEqual({ direction: 'down', delta: -20, pctChange: -20 })
  })

  it('is flat when nothing changed', () => {
    expect(computeTrend(100, 100)).toEqual({ direction: 'flat', delta: 0, pctChange: 0 })
  })

  it('is flat, not a false arrow, when either side has no data', () => {
    expect(computeTrend(null, 100)).toEqual({ direction: 'flat', delta: 0, pctChange: null })
    expect(computeTrend(100, null)).toEqual({ direction: 'flat', delta: 0, pctChange: null })
  })

  it('has no percent change when the previous value was zero', () => {
    expect(computeTrend(50, 0)).toEqual({ direction: 'up', delta: 50, pctChange: null })
  })
})
