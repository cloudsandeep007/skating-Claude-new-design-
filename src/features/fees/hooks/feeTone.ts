import type { StatusTone } from '@/shared/ui/StatusBadge'

import type { FeeStatus } from '../types'

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
