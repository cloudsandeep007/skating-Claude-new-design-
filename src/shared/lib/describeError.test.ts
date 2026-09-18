import { describe, expect, it } from 'vitest'

import { describeError } from './describeError'

describe('describeError', () => {
  it('reads a unique-violation as a duplicate name', () => {
    expect(describeError({ code: '23505', message: 'duplicate key value' }, 'x')).toMatch(
      /already exists/,
    )
  })
  it('reads a numeric overflow as too large', () => {
    expect(describeError({ code: '22003', message: 'numeric field overflow' }, 'x')).toMatch(
      /too large/,
    )
  })
  it('explains the email rate limit', () => {
    expect(describeError(new Error('email rate limit exceeded'), 'x')).toMatch(
      /email service limit/,
    )
  })
  it('falls back to the server message, then the default', () => {
    expect(describeError(new Error('Session not found'), 'x')).toBe('Session not found')
    expect(describeError({}, 'Could not save.')).toBe('Could not save.')
    expect(describeError(null, 'Could not save.')).toBe('Could not save.')
  })
})
