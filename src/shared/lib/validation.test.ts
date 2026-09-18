import { describe, expect, it } from 'vitest'

import { optionalPhoneSchema, phoneSchema, requiredText } from './validation'

describe('requiredText', () => {
  it('refuses blank and whitespace-only input', () => {
    expect(requiredText('Name is required').safeParse('   ').success).toBe(false)
    expect(requiredText('Name is required').safeParse('').success).toBe(false)
  })
  it('trims what it accepts', () => {
    expect(requiredText('x').parse('  Asha  ')).toBe('Asha')
  })
})

describe('phoneSchema', () => {
  it('accepts common Indian formats', () => {
    for (const p of ['+91 98450 00011', '9845000011', '080-2345 6789', '(011) 2345-6789']) {
      expect(phoneSchema.safeParse(p).success, p).toBe(true)
    }
  })
  it('refuses letters, too short and too long', () => {
    for (const p of ['abc', '12345', '+91 98450 00011 22222', '98450x0011']) {
      expect(phoneSchema.safeParse(p).success, p).toBe(false)
    }
  })
  it('optional variant allows blank but still checks a value', () => {
    expect(optionalPhoneSchema.safeParse('').success).toBe(true)
    expect(optionalPhoneSchema.safeParse(undefined).success).toBe(true)
    expect(optionalPhoneSchema.safeParse('abc').success).toBe(false)
  })
})
