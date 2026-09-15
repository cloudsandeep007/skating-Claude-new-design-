export interface DashboardStatCards {
  activeStudents: number
  newStudentsThisMonth: number
  todayAttendancePct: number | null
  lastMonthAttendancePct: number | null
  feesCollectedThisMonth: number
  feesCollectedLastMonth: number
  outstandingTotal: number
  outstandingStudents: number
  outstandingDueThisMonth: number
  outstandingDueLastMonth: number
}

export interface MonthPoint {
  month: string
  value: number | null
}

export interface RevenuePoint {
  month: string
  collected: number
  expected: number
}

export interface BatchCapacityRow {
  batchId: string
  batchName: string
  enrolledCount: number
  capacity: number
}

export interface SkillLevelRow {
  levelId: string
  levelName: string
  sequence: number
  studentCount: number
}

export interface CoachLoadRow {
  coachId: string
  coachName: string
  studentCount: number
  sessionCount: number
}

export interface NeedsAttentionRow {
  studentId: string
  fullName: string
  photoUrl: string | null
  batchNames: string | null
  levelName: string | null
  countedSessions: number
  attendedSessions: number
  missedSessions: number
  attendancePct: number | null
  parentName: string | null
  parentPhone: string | null
  hasOverdueFee: boolean
}

export interface RenewalDueRow {
  studentId: string
  fullName: string
  photoUrl: string | null
  batchNames: string | null
  pricingMode: 'cycle' | 'per_class' | null
  billingCycle: 'monthly' | 'quarterly' | 'annual' | null
  termEnd: string | null
  daysLeft: number | null
  termStatus: 'none' | 'active' | 'expiring' | 'expired'
  available: number | null
  minTopup: number | null
  rate: number | null
  parentName: string | null
  parentPhone: string | null
  lastRemindedAt: string | null
}

/** How many months of history the trend charts (attendance, revenue,
 * retention) look back over — the dashboard's one date-range selector. */
export const MONTH_RANGE_OPTIONS = [3, 6, 12] as const
export type MonthRange = (typeof MONTH_RANGE_OPTIONS)[number]
