import type { StatusTone } from '@/shared/ui/StatusBadge'

import type { CreditPlanStatus, TermStatus } from '../api/classBookings'

const CYCLE_MONTHS = { monthly: 1, quarterly: 3, annual: 12 } as const

/** Mirrors credit_plan_status()'s term_status rule: no term, lapsed,
 * ending within a week, or active. Kept in TS so the parent and admin
 * screens can label a term without another round trip. */
export function termStatus(termEnd: string | null, today: string): TermStatus {
  if (!termEnd) return 'none'
  if (termEnd < today) return 'expired'
  const days = daysBetween(today, termEnd)
  return days <= 7 ? 'expiring' : 'active'
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime()
  const b = new Date(`${toIso}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

export type TopupKind = 'extra' | 'renewal' | 'new'

export interface TopupPlan {
  kind: TopupKind
  termStart: string
  termEnd: string
  amount: number
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toIso(d)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Mirrors record_credit_topup()'s term rule so the Top-up dialog can show
 * exactly what a given number of classes will do before it's recorded:
 *  - below the minimum inside an active/expiring term → extra classes,
 *    same term dates;
 *  - at/above the minimum inside an active/expiring term → renewal, the
 *    next term follows straight on from the current end;
 *  - no term or lapsed → a new term from the payment date, and the
 *    minimum applies (returns null when it's not met). */
export function planTopup(
  status: Pick<
    CreditPlanStatus,
    'billingCycle' | 'rate' | 'minTopup' | 'termStart' | 'termEnd' | 'termStatus'
  >,
  classes: number,
  paidDate: string,
): TopupPlan | null {
  if (!status.billingCycle || status.rate == null || status.minTopup == null) return null
  if (classes < 1) return null
  const months = CYCLE_MONTHS[status.billingCycle]
  const amount = classes * status.rate
  const live = status.termStatus === 'active' || status.termStatus === 'expiring'

  if (live && status.termStart && status.termEnd) {
    if (classes < status.minTopup) {
      return { kind: 'extra', termStart: status.termStart, termEnd: status.termEnd, amount }
    }
    const start = addDays(status.termEnd, 1)
    return { kind: 'renewal', termStart: start, termEnd: addDays(addMonths(start, months), -1), amount }
  }
  if (classes < status.minTopup) return null
  return { kind: 'new', termStart: paidDate, termEnd: addDays(addMonths(paidDate, months), -1), amount }
}

export function termTone(status: TermStatus): StatusTone {
  switch (status) {
    case 'active':
      return 'success'
    case 'expiring':
      return 'warning'
    case 'expired':
      return 'danger'
    default:
      return 'outline'
  }
}

export function termLabel(plan: Pick<CreditPlanStatus, 'termStatus' | 'billingCycle'>): string {
  const cycle = plan.billingCycle ? ` · ${plan.billingCycle}` : ''
  switch (plan.termStatus) {
    case 'active':
      return `Active${cycle}`
    case 'expiring':
      return `Ending soon${cycle}`
    case 'expired':
      return `Lapsed${cycle}`
    default:
      return 'No plan yet'
  }
}
