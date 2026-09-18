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

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Mirrors record_payment()'s advance rule: how much of a payment covers
 * the fee and how much is kept ahead for the next one. */
export function splitAdvance(amount: number, balance: number): { toFee: number; toAdvance: number } {
  const toFee = round2(Math.min(amount, Math.max(balance, 0)))
  return { toFee, toAdvance: round2(Math.max(amount - toFee, 0)) }
}

export interface Period {
  periodStart: string
  periodEnd: string
}

/** Defaults for the two per-academy billing settings
 * (`academies.settings.fee_generate_lead_days` / `.fee_grace_days`). */
export const DEFAULT_LEAD_DAYS = 7
export const DEFAULT_GRACE_DAYS = 5

function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10))
}

function daysInMonth(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function endOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 8)}${String(daysInMonth(isoDate)).padStart(2, '0')}`
}

/** A period that doesn't start on the 1st is a short "stub" that runs to
 * the end of its month, so every period after it lines up with the
 * calendar. Happens for a first invoice after a mid-month join, and once
 * for any student whose previous period was on the old join-date
 * anniversary scheme. */
export function isStubPeriod(periodStart: string): boolean {
  return dayOfMonth(periodStart) !== 1
}

/** Mirrors generate_upcoming_fees()'s period math in the database exactly.
 * `lastPeriodEnd` is the student's latest period on ANY plan — switching
 * plans continues from where the old one stopped, never restarts. The next
 * period starts the day after it (or on the join date for a first
 * invoice); a start on the 1st runs one full billing cycle, anything else
 * is a stub to month end. Under a unit test because fee math is where
 * quiet bugs cost money. */
export function nextPeriod(
  billingCycle: BillingCycle,
  lastPeriodEnd: string | null,
  joinedDate: string,
): Period {
  const periodStart = lastPeriodEnd ? addDays(lastPeriodEnd, 1) : joinedDate
  const periodEnd = isStubPeriod(periodStart)
    ? endOfMonth(periodStart)
    : addDays(addMonths(periodStart, CYCLE_MONTHS[billingCycle]), -1)
  return { periodStart, periodEnd }
}

/** Mirrors generate_upcoming_fees()'s "due" rule: the coming period is
 * generated `leadDays` before the current one ends (or right away when
 * none exists yet), so a bill exists before it's due — and never further
 * ahead than that one period. */
export function isPeriodDue(
  lastPeriodEnd: string | null,
  today: string,
  leadDays = DEFAULT_LEAD_DAYS,
): boolean {
  return lastPeriodEnd === null || lastPeriodEnd < addDays(today, leadDays)
}

/** Mirrors generate_upcoming_fees()'s due-date rule: `graceDays` after the
 * period starts, or after today if the period already started (a late
 * run) — a fee is never overdue on the day it's created. */
export function dueDate(periodStart: string, today: string, graceDays = DEFAULT_GRACE_DAYS): string {
  return addDays(periodStart > today ? periodStart : today, graceDays)
}

/** Mirrors generate_upcoming_fees()'s cycle-plan pricing: a full period is
 * the plan amount; a stub is the monthly-equivalent amount pro-rated by
 * the days it covers. (Per-class plans don't need this — their class
 * count only ever covers the period's own days.) */
export function prorateCycleAmount(
  amount: number,
  billingCycle: BillingCycle,
  period: Period,
): number {
  if (!isStubPeriod(period.periodStart)) return amount
  const monthly = amount / CYCLE_MONTHS[billingCycle]
  const start = new Date(`${period.periodStart}T00:00:00`)
  const end = new Date(`${period.periodEnd}T00:00:00`)
  const daysCovered = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  return round2((monthly * daysCovered) / daysInMonth(period.periodStart))
}

/** Mirrors mark_fees_overdue(): only a still-pending fee whose due date
 * has passed is overdue. Paid and waived fees never flip, and a fee due
 * today is not yet overdue — it becomes overdue starting the next day. */
export function isOverdue(status: FeeStatus, dueDate: string, today: string): boolean {
  return status === 'pending' && dueDate < today
}

/** Mirrors fee_paid_total() in the database: what's been paid on a fee is
 * the sum of its payments that haven't been voided. A voided payment stays
 * in the list (it's history) but counts for nothing. */
export function paidTotal(payments: { amount: number; voidedAt: string | null }[]): number {
  return round2(payments.reduce((sum, p) => (p.voidedAt ? sum : sum + p.amount), 0))
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
