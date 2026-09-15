import type { StatusTone } from '@/shared/ui/StatusBadge'

import type { Enums } from '@/shared/types'

const FEE_STATUS_LABEL: Record<Enums<'fee_status'>, string> = {
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
  waived: 'Waived',
}

const FEE_STATUS_TONE: Record<Enums<'fee_status'>, StatusTone> = {
  paid: 'success',
  pending: 'warning',
  overdue: 'danger',
  waived: 'outline',
}

export function feeStatusLabel(status: Enums<'fee_status'> | null): string {
  return status ? FEE_STATUS_LABEL[status] : 'No fee record'
}

export function feeStatusTone(status: Enums<'fee_status'> | null): StatusTone {
  return status ? FEE_STATUS_TONE[status] : 'neutral'
}

/** Matches the at-risk threshold used by the dashboard views (<60%). */
export function attendancePctColorClass(pct: number | null): string {
  if (pct === null) return 'text-muted-foreground'
  if (pct < 60) return 'text-brand-400'
  if (pct < 80) return 'text-warning-400'
  return 'text-success-400'
}

export function attendanceBarColorClass(pct: number | null): string {
  if (pct === null) return 'bg-muted'
  if (pct < 60) return 'bg-brand-500'
  if (pct < 80) return 'bg-warning-400'
  return 'bg-success-500'
}
