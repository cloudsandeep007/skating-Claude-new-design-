import { describe, expect, it } from 'vitest'

import { capacityTone, isFull } from './capacity'

describe('capacity', () => {
  it('is full at or over capacity', () => {
    expect(isFull(10, 10)).toBe(true)
    expect(isFull(11, 10)).toBe(true)
    expect(isFull(9, 10)).toBe(false)
  })

  it('warns on the last two places and goes red when full', () => {
    expect(capacityTone(3, 10)).toBe('success')
    expect(capacityTone(8, 10)).toBe('warning')
    expect(capacityTone(9, 10)).toBe('warning')
    expect(capacityTone(10, 10)).toBe('danger')
  })
})
