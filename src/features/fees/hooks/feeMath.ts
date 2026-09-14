import { addDays, toIsoDate } from '@/shared/lib/format'

import type { BillingCycle, FeeStatus } from '../types'

const CYCLE_MONTHS: Record<BillingCycle, number> = { monthly: 1, quarterly: 3, annual: 12 }

/** Adds calendar months the way Postgres's `date + interval 'N months'`
 * does: if the day-of-month overflows the target month (e.g. Jan 31 + 1
 * month), it clamps to that month's last day rather than rolling into the
 * month after — plain JS `setMonth` does the latter, which would silently
 * disagree with what the database actually generates. */
function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, daysInTargetMonth))
  return toIsoDate(d)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface Period {
  periodStart: string
  periodEnd: string
}

/** Mirrors generate_upcoming_fees()'s period math in the database exactly:
 * the next period starts the day after the last one ended (or on the
 * student's join date, for a first invoice) and runs one full billing
 * cycle, inclusive. Used both to preview "next fee" in the UI and to keep
 * this rule under a unit test — fee math is where quiet bugs cost money. */
export function nextPeriod(
  billingCycle: BillingCycle,
  lastPeriodEnd: string | null,
  joinedDate: string,
): Period {
  const periodStart = lastPeriodEnd ? addDays(lastPeriodEnd, 1) : joinedDate
  const periodEnd = addDays(addMonths(periodStart, CYCLE_MONTHS[billingCycle]), -1)
  return { periodStart, periodEnd }
}

/** Mirrors generate_upcoming_fees()'s "due" rule: generate a new period
 * only once the current one has ended (or none exists yet) — never
 * further ahead than the coming period. */
export function isPeriodDue(lastPeriodEnd: string | null, today: string): boolean {
  return lastPeriodEnd === null || lastPeriodEnd < today
}

/** Mirrors mark_fees_overdue(): only a still-pending fee whose due date
 * has passed is overdue. Paid and waived fees never flip, and a fee due
 * today is not yet overdue — it becomes overdue starting the next day. */
export function isOverdue(status: FeeStatus, dueDate: string, today: string): boolean {
  return status === 'pending' && dueDate < today
}

/** How much is still owed after whatever's been paid so far — never
 * negative (an overpayment doesn't produce a negative balance). */
export function remainingBalance(amount: number, paidSoFar: number): number {
  return Math.max(0, round2(amount - paidSoFar))
}

/** Mirrors record_payment()'s flip-to-paid rule: a fee becomes "paid" once
 * payments cover the full amount. A partial payment changes nothing about
 * status — pending stays pending, overdue stays overdue — which is the
 * whole point of supporting partial payments without a separate status. */
export function isFullyPaid(amount: number, paidSoFar: number): boolean {
  return paidSoFar >= amount
}

/** A fee can be waived while money is still owed on it — not once it's
 * already fully paid (nothing left to waive) or already waived. */
export function canWaive(status: FeeStatus): boolean {
  return status === 'pending' || status === 'overdue'
}
