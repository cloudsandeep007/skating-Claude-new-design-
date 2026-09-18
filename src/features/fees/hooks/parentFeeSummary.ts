import type { PaymentRecord, StudentFeeWithPayments } from '../types'
import { paidTotal, remainingBalance } from './feeMath'

export interface ParentFeeSummary {
  /** What the family owes right now across every open fee. */
  dueNow: number
  /** Earliest due date among the open fees, or null when nothing is owed. */
  dueBy: string | null
  overdue: boolean
  /** The billing period that covers today (or the latest one, if none does). */
  current: StudentFeeWithPayments | null
  /** Top-ups whose classes are still valid today. */
  activeTopups: StudentFeeWithPayments[]
  /** Everything else, newest first. */
  older: StudentFeeWithPayments[]
  /** The last live receipt — what most families look for. */
  lastReceipt: (PaymentRecord & { feeLabel: string }) | null
}

export function feeBalance(fee: StudentFeeWithPayments): number {
  return remainingBalance(fee.amount, paidTotal(fee.payments))
}

function isOpen(fee: StudentFeeWithPayments) {
  return fee.status === 'pending' || fee.status === 'overdue'
}

/** Turns the flat, ever-growing fee list into what a parent actually asks:
 * do I owe anything, what is my current period, and where is my last
 * receipt. Older periods are set aside so the screen does not grow month
 * on month. */
export function summarizeParentFees(
  fees: StudentFeeWithPayments[],
  today: string,
): ParentFeeSummary {
  const open = fees.filter(isOpen)
  const dueNow = Math.round(open.reduce((sum, f) => sum + feeBalance(f), 0) * 100) / 100
  const dueBy = open.length === 0 ? null : open.map((f) => f.dueDate).sort()[0]

  const periods = fees.filter((f) => f.kind === 'period')
  const covering = periods.find((f) => f.periodStart <= today && today <= f.periodEnd)
  const sorted = [...periods].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
  const current: StudentFeeWithPayments | null = covering ?? (sorted.length > 0 ? sorted[0] : null)

  const activeTopups = fees
    .filter(
      (f) => f.kind === 'topup' && f.periodEnd >= today && f.status !== 'waived' && f.amount > 0,
    )
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))

  const keep = new Set<string>(activeTopups.map((f) => f.id))
  if (current !== null) keep.add(current.id)
  const older = fees
    .filter((f) => !keep.has(f.id))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.dueDate.localeCompare(a.dueDate))

  let lastReceipt: ParentFeeSummary['lastReceipt'] = null
  for (const f of fees) {
    for (const p of f.payments) {
      if (p.voidedAt) continue
      if (!lastReceipt || p.paidDate > lastReceipt.paidDate) {
        lastReceipt = { ...p, feeLabel: f.kind === 'topup' ? 'Top-up' : (f.feePlanName ?? 'Fee') }
      }
    }
  }

  return {
    dueNow,
    dueBy,
    overdue: open.some((f) => f.status === 'overdue'),
    current,
    activeTopups,
    older,
    lastReceipt,
  }
}
