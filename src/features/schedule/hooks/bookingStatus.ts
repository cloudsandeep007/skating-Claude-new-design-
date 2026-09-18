import type { StatusTone } from '@/shared/ui/StatusBadge'

import type { BookingRequest } from '../api/bookingRequests'

export type AnyBookingStatus = 'pending' | 'booked' | 'rejected' | 'cancelled'

/** What a parent, coach or admin reads on the badge. */
export function bookingStatusLabel(status: AnyBookingStatus): string {
  switch (status) {
    case 'pending':
      return 'Requested'
    case 'booked':
      return 'Confirmed'
    case 'rejected':
      return 'Declined'
    case 'cancelled':
      return 'Cancelled'
  }
}

export function bookingStatusTone(status: AnyBookingStatus): StatusTone {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'booked':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'cancelled':
      return 'neutral'
  }
}

export interface RequestGroup {
  sessionId: string
  sessionDate: string
  startTime: string
  batchName: string
  venue: string | null
  coachName: string | null
  requests: BookingRequest[]
}

/** The queue is decided a session at a time, so rows are grouped by session
 * in the order the RPC returned them (date, then time). */
export function groupRequestsBySession(rows: BookingRequest[]): RequestGroup[] {
  const groups: RequestGroup[] = []
  const byId = new Map<string, RequestGroup>()
  for (const r of rows) {
    let g = byId.get(r.sessionId)
    if (!g) {
      g = {
        sessionId: r.sessionId,
        sessionDate: r.sessionDate,
        startTime: r.startTime,
        batchName: r.batchName,
        venue: r.venue,
        coachName: r.coachName,
        requests: [],
      }
      byId.set(r.sessionId, g)
      groups.push(g)
    }
    g.requests.push(r)
  }
  return groups
}

/** Counts for the parent's "your bookings" strip. */
export function countBookings(statuses: Iterable<AnyBookingStatus>) {
  const out = { pending: 0, booked: 0, rejected: 0 }
  for (const s of statuses) {
    if (s === 'pending') out.pending += 1
    else if (s === 'booked') out.booked += 1
    else if (s === 'rejected') out.rejected += 1
  }
  return out
}
