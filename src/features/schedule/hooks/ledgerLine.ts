import { formatDate } from '@/shared/lib/format'

import type { CreditLedgerEntry } from '../api/classBookings'

/** The one-line label for a credit statement entry, in the family's words:
 * what class it was about and what happened to it. Falls back to the raw
 * reason for lines that aren't about a booking (top-ups, expiry, edits). */
export function ledgerLineLabel(e: CreditLedgerEntry): string {
  const when = e.sessionDate ? formatDate(e.sessionDate) : null
  const cls = when ? `${when}${e.batchName ? ` · ${e.batchName}` : ''}` : null

  if (e.kind === 'spend' && cls) {
    if (e.bookingSource === 'attendance') return `Attended ${cls} (walk-in, not booked)`
    if (e.reason === 'Marked present') return `Attended ${cls}`
    return `Reserved for ${cls}`
  }
  if (e.kind === 'refund' && cls) {
    if (e.reason?.startsWith('Marked absent')) return `Returned — absent on ${cls}`
    if (e.reason?.startsWith('Not marked')) return `Returned — ${cls} not marked`
    if (e.reason === 'Request declined') return `Returned — ${cls} declined`
    return `Returned — ${cls} cancelled`
  }
  const kindLabel: Record<CreditLedgerEntry['kind'], string> = {
    grant: 'Added',
    clawback: 'Taken back',
    spend: 'Spent',
    refund: 'Returned',
    expire: 'Expired',
    adjust: 'Adjusted',
  }
  return e.reason ? `${kindLabel[e.kind]} — ${e.reason}` : kindLabel[e.kind]
}

/** "bought · attended · booked ahead · left" for the credits cards. */
export function creditBreakdown(s: {
  granted: number
  attended: number
  reserved: number
  available: number | null
}): { bought: number; attended: number; booked: number; left: number } {
  return {
    bought: s.granted,
    attended: s.attended,
    booked: s.reserved,
    left: Math.max(s.available ?? 0, 0),
  }
}
