import { describe, expect, it } from 'vitest'

import type { BookingRequest } from '../api/bookingRequests'
import {
  bookingStatusLabel,
  bookingStatusTone,
  countBookings,
  groupRequestsBySession,
} from './bookingStatus'

function req(over: Partial<BookingRequest>): BookingRequest {
  return {
    bookingId: 'b1',
    status: 'pending',
    source: 'parent',
    requestedAt: '2026-09-19T05:00:00Z',
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    sessionId: 's1',
    sessionDate: '2026-09-21',
    startTime: '06:30',
    endTime: '07:30',
    batchId: 'bt1',
    batchName: 'Beginner',
    venue: 'Rink A',
    coachName: 'Karthik',
    studentId: 'st1',
    fullName: 'S1',
    photoUrl: null,
    creditsLeft: 3,
    ...over,
  }
}

describe('booking status copy', () => {
  it('reads as a plain word for every status', () => {
    expect(bookingStatusLabel('pending')).toBe('Requested')
    expect(bookingStatusLabel('booked')).toBe('Confirmed')
    expect(bookingStatusLabel('rejected')).toBe('Declined')
    expect(bookingStatusLabel('cancelled')).toBe('Cancelled')
  })
  it('warns while waiting, greens once confirmed, reds when declined', () => {
    expect(bookingStatusTone('pending')).toBe('warning')
    expect(bookingStatusTone('booked')).toBe('success')
    expect(bookingStatusTone('rejected')).toBe('danger')
  })
})

describe('groupRequestsBySession', () => {
  it('keeps one group per session in arrival order', () => {
    const groups = groupRequestsBySession([
      req({ bookingId: 'a', sessionId: 's1', fullName: 'A' }),
      req({ bookingId: 'b', sessionId: 's2', sessionDate: '2026-09-22', fullName: 'B' }),
      req({ bookingId: 'c', sessionId: 's1', fullName: 'C' }),
    ])
    expect(groups.map((g) => g.sessionId)).toEqual(['s1', 's2'])
    expect(groups[0].requests.map((r) => r.fullName)).toEqual(['A', 'C'])
  })
  it('is empty for no rows', () => {
    expect(groupRequestsBySession([])).toEqual([])
  })
})

describe('countBookings', () => {
  it('tallies pending, confirmed and declined; ignores cancelled', () => {
    expect(countBookings(['pending', 'booked', 'booked', 'rejected', 'cancelled'])).toEqual({
      pending: 1,
      booked: 2,
      rejected: 1,
    })
  })
})
