export interface AttendanceReportRow {
  studentId: string
  fullName: string
  counted: number
  attended: number
  absent: number
  late: number
  excused: number
  pct: number | null
  expected: number
  makeupOwed: number
}

export interface FeeReportRow {
  studentFeeId: string
  studentId: string
  fullName: string
  batchNames: string | null
  feePlanName: string | null
  dueDate: string
  amount: number
  paid: number
  balance: number
  status: string
}

export interface ProgressReportRow {
  studentId: string
  fullName: string
  batchNames: string | null
  levelName: string | null
  skillsAchievedInRange: number
  skillsInLevel: number
  attendancePct: number | null
}

export interface CoachReportRow {
  coachId: string
  coachName: string
  batchNames: string | null
  sessionCount: number
  studentCount: number
  attendancePct: number | null
}

export interface ReconciliationRow {
  day: string
  cash: number
  upi: number
  card: number
  bankTransfer: number
  cheque: number
  other: number
  collected: number
  paymentCount: number
  voidedTotal: number
  voidedCount: number
  advanceApplied: number
  firstReceipt: string | null
  lastReceipt: string | null
}

export interface ReportRange {
  from: string
  to: string
}
