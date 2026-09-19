import { describe, expect, it } from 'vitest'

import { buildWelcomeLink, inviteMessage, whatsappNumber, whatsappShareUrl } from './inviteLink'

describe('buildWelcomeLink', () => {
  it('points at /welcome on the given origin with the token and type', () => {
    expect(
      buildWelcomeLink('https://app.example.com/', { tokenHash: 'abc', tokenType: 'invite' }),
    ).toBe('https://app.example.com/welcome?t=abc&type=invite')
  })
})

describe('whatsappNumber', () => {
  it('assumes India for a bare 10-digit number and strips formatting', () => {
    expect(whatsappNumber('98450 00011')).toBe('919845000011')
    expect(whatsappNumber('+91 98450-00011')).toBe('919845000011')
    expect(whatsappNumber('09845000011')).toBe('919845000011')
  })
  it('keeps other country codes and rejects junk', () => {
    expect(whatsappNumber('+44 7700 900123')).toBe('447700900123')
    expect(whatsappNumber('abc')).toBeNull()
    expect(whatsappNumber(null)).toBeNull()
  })
})

describe('whatsappShareUrl / inviteMessage', () => {
  it('addresses the number when there is one, else opens the chooser', () => {
    const text = inviteMessage('PRSA', 'Sandeep Soni', 'https://x/welcome?t=1&type=invite')
    expect(text.startsWith('Hi Sandeep, here is your sign-in link for the PRSA app.')).toBe(true)
    expect(whatsappShareUrl('9845000011', text)).toMatch(
      /^https:\/\/wa\.me\/919845000011\?text=Hi%20Sandeep/,
    )
    expect(whatsappShareUrl(null, text)).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
})
