import type { StatusTone } from '@/shared/ui/StatusBadge'

import type { FeePlanOption, FeeStatus } from '../types'

const LABEL: Record<FeeStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  overdue: 'Overdue',
  waived: 'Waived',
}

const TONE: Record<FeeStatus, StatusTone> = {
  pending: 'warning',
  paid: 'success',
  overdue: 'danger',
  waived: 'outline',
}

export function feeStatusLabel(status: FeeStatus): string {
  return LABEL[status]
}

export function feeStatusTone(status: FeeStatus): StatusTone {
  return TONE[status]
}

export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/** e.g. "₹2,500" for a cycle plan, "₹300/class" for a per-class one — used
 * wherever a fee plan is picked (the fee plan list, the student form). */
export function feePlanPriceLabel(
  plan: Pick<FeePlanOption, 'amount' | 'pricingMode' | 'perClassRate'>,
): string {
  if (plan.pricingMode === 'per_class' && plan.perClassRate != null) {
    return `${formatRupees(plan.perClassRate)}/class`
  }
  return formatRupees(plan.amount)
}
