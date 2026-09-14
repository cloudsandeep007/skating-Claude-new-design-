import { describe, expect, it } from 'vitest'

import { toCsv } from './csv'

describe('toCsv', () => {
  it('quotes cells containing commas, quotes or newlines', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', 'x\ny']])).toBe('a,"b,c","say ""hi""","x\ny"')
  })

  it('renders null and undefined as empty cells', () => {
    expect(toCsv([[1, null, undefined, 'z']])).toBe('1,,,z')
  })
})
