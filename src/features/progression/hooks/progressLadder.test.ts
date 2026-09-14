import { describe, expect, it } from 'vitest'

import { ladderPct } from './progressLadder'

describe('ladderPct', () => {
  it('is 0% at the first level', () => {
    expect(ladderPct(1, 9)).toBe(0)
  })

  it('is 100% at the last level', () => {
    expect(ladderPct(9, 9)).toBe(100)
  })

  it('is proportional in between', () => {
    expect(ladderPct(5, 9)).toBe(50)
  })

  it('is 100% when there is only one level', () => {
    expect(ladderPct(1, 1)).toBe(100)
  })
})
