import { describe, expect, it } from 'vitest'

import { announcementState } from './announcementState'

const now = new Date('2026-09-14T10:00:00Z')

describe('announcementState', () => {
  it('is a draft with no publish date', () => {
    expect(announcementState(null, null, now)).toBe('draft')
  })

  it('is scheduled when the publish date is in the future', () => {
    expect(announcementState('2026-09-15T08:00:00Z', null, now)).toBe('scheduled')
  })

  it('is live once published and not expired', () => {
    expect(announcementState('2026-09-14T09:00:00Z', null, now)).toBe('live')
    expect(announcementState('2026-09-14T09:00:00Z', '2026-09-20T00:00:00Z', now)).toBe('live')
  })

  it('is expired once past the expiry', () => {
    expect(announcementState('2026-09-01T09:00:00Z', '2026-09-14T10:00:00Z', now)).toBe('expired')
  })
})
