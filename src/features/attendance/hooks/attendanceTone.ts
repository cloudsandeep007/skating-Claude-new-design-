import type { StatusTone } from '@/shared/ui/StatusBadge'

import type { AttendanceStatus } from '../types'

const TONE: Record<AttendanceStatus, StatusTone> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'outline',
}

const LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
}

export function attendanceTone(status: AttendanceStatus | null): StatusTone {
  return status ? TONE[status] : 'neutral'
}

export function attendanceLabel(status: AttendanceStatus | null): string {
  return status ? LABEL[status] : 'Unmarked'
}

/** Same thresholds as the students list and the at-risk view (<60%). */
export function pctColorClass(pct: number | null): string {
  if (pct === null) return 'text-muted-foreground'
  if (pct < 60) return 'text-brand-700'
  if (pct < 80) return 'text-warning-800'
  return 'text-success-700'
}
