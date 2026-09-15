import { Download, FileDown } from 'lucide-react'
import { useState } from 'react'

import { useBatchOptions } from '@/features/batches'
import { downloadCsv } from '@/shared/lib/csv'
import { formatDate, addDays, todayIso } from '@/shared/lib/format'
import { exportTableToPdf } from '@/shared/lib/pdf'
import { Button } from '@/shared/ui/button'
import { DateRangePicker } from '@/shared/ui/DateRangePicker'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import { useAttendanceReport } from '../api/attendanceReport'
import { useCoachReport } from '../api/coachReport'
import { useFeeReport } from '../api/feeReport'
import { useProgressReport } from '../api/progressReport'
import type { ReportRange } from '../types'

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/** Filters shared by every report tab — the from/to range and the batch
 * picker, both required by the spec for all four. */
function ReportFilters({
  range,
  onRangeChange,
  batchId,
  onBatchChange,
  onExportCsv,
  onExportPdf,
  exportDisabled,
}: {
  range: ReportRange
  onRangeChange: (from: string, to: string) => void
  batchId: string
  onBatchChange: (id: string) => void
  onExportCsv: () => void
  onExportPdf: () => void
  exportDisabled: boolean
}) {
  const { data: batches } = useBatchOptions()
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <DateRangePicker from={range.from} to={range.to} onChange={onRangeChange} />
      <Select value={batchId} onValueChange={onBatchChange}>
        <SelectTrigger className="w-[190px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All batches</SelectItem>
          {batches?.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" onClick={onExportCsv} disabled={exportDisabled}>
          <Download className="h-4 w-4" />
          CSV
        </Button>
        <Button variant="outline" onClick={onExportPdf} disabled={exportDisabled}>
          <FileDown className="h-4 w-4" />
          PDF
        </Button>
      </div>
    </div>
  )
}

export function ReportsPage() {
  const today = todayIso()
  const [range, setRange] = useState<ReportRange>({ from: addDays(today, -29), to: today })
  const [batchId, setBatchId] = useState('all')
  const resolvedBatchId = batchId === 'all' ? null : batchId

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attendance, fees, progress and coach activity — filter by date range and batch, export
          either format.
        </p>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fee collection</TabsTrigger>
          <TabsTrigger value="progress">Student progress</TabsTrigger>
          <TabsTrigger value="coach">Coach activity</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4 pt-4">
          <AttendanceReportTab
            range={range}
            setRange={setRange}
            batchId={batchId}
            setBatchId={setBatchId}
            resolvedBatchId={resolvedBatchId}
          />
        </TabsContent>
        <TabsContent value="fees" className="space-y-4 pt-4">
          <FeeReportTab
            range={range}
            setRange={setRange}
            batchId={batchId}
            setBatchId={setBatchId}
            resolvedBatchId={resolvedBatchId}
          />
        </TabsContent>
        <TabsContent value="progress" className="space-y-4 pt-4">
          <ProgressReportTab
            range={range}
            setRange={setRange}
            batchId={batchId}
            setBatchId={setBatchId}
            resolvedBatchId={resolvedBatchId}
          />
        </TabsContent>
        <TabsContent value="coach" className="space-y-4 pt-4">
          <CoachReportTab
            range={range}
            setRange={setRange}
            batchId={batchId}
            setBatchId={setBatchId}
            resolvedBatchId={resolvedBatchId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface TabProps {
  range: ReportRange
  setRange: (r: ReportRange) => void
  batchId: string
  setBatchId: (id: string) => void
  resolvedBatchId: string | null
}

function AttendanceReportTab({ range, setRange, batchId, setBatchId, resolvedBatchId }: TabProps) {
  const { data: rows, isLoading, isError, refetch } = useAttendanceReport(range, resolvedBatchId)

  function exportCsv() {
    if (!rows) return
    downloadCsv(`attendance-report-${range.from}-to-${range.to}.csv`, [
      [
        'Student',
        'Expected',
        'Counted',
        'Attended',
        'Absent',
        'Late',
        'Excused',
        'Attendance %',
        'Make-up owed',
      ],
      ...rows.map((r) => [
        r.fullName,
        r.expected,
        r.counted,
        r.attended,
        r.absent,
        r.late,
        r.excused,
        r.pct ?? '',
        r.makeupOwed,
      ]),
    ])
  }
  function exportPdf() {
    if (!rows) return
    void exportTableToPdf(
      `attendance-report-${range.from}-to-${range.to}.pdf`,
      'Attendance report',
      `${formatDate(range.from)} – ${formatDate(range.to)}`,
      [
        'Student',
        'Expected',
        'Counted',
        'Attended',
        'Absent',
        'Late',
        'Excused',
        'Attendance %',
        'Make-up owed',
      ],
      rows.map((r) => [
        r.fullName,
        r.expected,
        r.counted,
        r.attended,
        r.absent,
        r.late,
        r.excused,
        r.pct ?? '—',
        r.makeupOwed,
      ]),
    )
  }

  return (
    <>
      <ReportFilters
        range={range}
        onRangeChange={(f, t) => {
          setRange({ from: f, to: t })
        }}
        batchId={batchId}
        onBatchChange={setBatchId}
        onExportCsv={exportCsv}
        onExportPdf={exportPdf}
        exportDisabled={!rows || rows.length === 0}
      />
      <ReportTable
        isLoading={isLoading}
        isError={isError}
        onRetry={() => {
          void refetch()
        }}
        isEmpty={!rows || rows.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Counted</TableHead>
              <TableHead>Attended</TableHead>
              <TableHead>Absent</TableHead>
              <TableHead>Late</TableHead>
              <TableHead>Excused</TableHead>
              <TableHead>Attendance %</TableHead>
              <TableHead>Make-up owed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-bold">{r.fullName}</TableCell>
                <TableCell>{r.expected}</TableCell>
                <TableCell>{r.counted}</TableCell>
                <TableCell>{r.attended}</TableCell>
                <TableCell>{r.absent}</TableCell>
                <TableCell>{r.late}</TableCell>
                <TableCell>{r.excused}</TableCell>
                <TableCell>{r.pct !== null ? `${r.pct}%` : '—'}</TableCell>
                <TableCell>{r.makeupOwed > 0 ? r.makeupOwed : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTable>
    </>
  )
}

function FeeReportTab({ range, setRange, batchId, setBatchId, resolvedBatchId }: TabProps) {
  const { data: rows, isLoading, isError, refetch } = useFeeReport(range, resolvedBatchId)

  function exportCsv() {
    if (!rows) return
    downloadCsv(`fee-report-${range.from}-to-${range.to}.csv`, [
      ['Student', 'Batch', 'Plan', 'Due date', 'Amount', 'Paid', 'Balance', 'Status'],
      ...rows.map((r) => [
        r.fullName,
        r.batchNames ?? '',
        r.feePlanName ?? '',
        r.dueDate,
        r.amount,
        r.paid,
        r.balance,
        r.status,
      ]),
    ])
  }
  function exportPdf() {
    if (!rows) return
    void exportTableToPdf(
      `fee-report-${range.from}-to-${range.to}.pdf`,
      'Fee collection report',
      `${formatDate(range.from)} – ${formatDate(range.to)}`,
      ['Student', 'Batch', 'Plan', 'Due date', 'Amount', 'Paid', 'Balance', 'Status'],
      rows.map((r) => [
        r.fullName,
        r.batchNames ?? '—',
        r.feePlanName ?? '—',
        formatDate(r.dueDate),
        rupees(r.amount),
        rupees(r.paid),
        rupees(r.balance),
        r.status,
      ]),
    )
  }

  return (
    <>
      <ReportFilters
        range={range}
        onRangeChange={(f, t) => {
          setRange({ from: f, to: t })
        }}
        batchId={batchId}
        onBatchChange={setBatchId}
        onExportCsv={exportCsv}
        onExportPdf={exportPdf}
        exportDisabled={!rows || rows.length === 0}
      />
      <ReportTable
        isLoading={isLoading}
        isError={isError}
        onRetry={() => {
          void refetch()
        }}
        isEmpty={!rows || rows.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.studentFeeId}>
                <TableCell className="font-bold">{r.fullName}</TableCell>
                <TableCell>{r.batchNames ?? '—'}</TableCell>
                <TableCell>{r.feePlanName ?? '—'}</TableCell>
                <TableCell>{formatDate(r.dueDate)}</TableCell>
                <TableCell>{rupees(r.amount)}</TableCell>
                <TableCell>{rupees(r.balance)}</TableCell>
                <TableCell className="capitalize">{r.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTable>
    </>
  )
}

function ProgressReportTab({ range, setRange, batchId, setBatchId, resolvedBatchId }: TabProps) {
  const { data: rows, isLoading, isError, refetch } = useProgressReport(range, resolvedBatchId)

  function exportCsv() {
    if (!rows) return
    downloadCsv(`progress-report-${range.from}-to-${range.to}.csv`, [
      [
        'Student',
        'Batch',
        'Level',
        'Skills achieved in range',
        'Skills in current level',
        'Attendance %',
      ],
      ...rows.map((r) => [
        r.fullName,
        r.batchNames ?? '',
        r.levelName ?? '',
        r.skillsAchievedInRange,
        r.skillsInLevel,
        r.attendancePct ?? '',
      ]),
    ])
  }
  function exportPdf() {
    if (!rows) return
    void exportTableToPdf(
      `progress-report-${range.from}-to-${range.to}.pdf`,
      'Student progress report',
      `${formatDate(range.from)} – ${formatDate(range.to)}`,
      ['Student', 'Batch', 'Level', 'Skills achieved (range)', 'Skills in level', 'Attendance %'],
      rows.map((r) => [
        r.fullName,
        r.batchNames ?? '—',
        r.levelName ?? '—',
        r.skillsAchievedInRange,
        r.skillsInLevel,
        r.attendancePct !== null ? `${r.attendancePct}%` : '—',
      ]),
    )
  }

  return (
    <>
      <ReportFilters
        range={range}
        onRangeChange={(f, t) => {
          setRange({ from: f, to: t })
        }}
        batchId={batchId}
        onBatchChange={setBatchId}
        onExportCsv={exportCsv}
        onExportPdf={exportPdf}
        exportDisabled={!rows || rows.length === 0}
      />
      <p className="text-xs text-muted-foreground">
        "Skills achieved" counts skills marked achieved within the date range, across any level —
        not only the student's current one. "Skills in level" is their current level's total, for
        context, not a denominator of the first number.
      </p>
      <ReportTable
        isLoading={isLoading}
        isError={isError}
        onRetry={() => {
          void refetch()
        }}
        isEmpty={!rows || rows.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Skills achieved (range)</TableHead>
              <TableHead>Skills in level</TableHead>
              <TableHead>Attendance %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-bold">{r.fullName}</TableCell>
                <TableCell>{r.batchNames ?? '—'}</TableCell>
                <TableCell>{r.levelName ?? '—'}</TableCell>
                <TableCell>{r.skillsAchievedInRange}</TableCell>
                <TableCell>{r.skillsInLevel}</TableCell>
                <TableCell>{r.attendancePct !== null ? `${r.attendancePct}%` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTable>
    </>
  )
}

function CoachReportTab({ range, setRange, batchId, setBatchId, resolvedBatchId }: TabProps) {
  const { data: rows, isLoading, isError, refetch } = useCoachReport(range, resolvedBatchId)

  function exportCsv() {
    if (!rows) return
    downloadCsv(`coach-activity-report-${range.from}-to-${range.to}.csv`, [
      ['Coach', 'Batches', 'Sessions', 'Students', 'Attendance %'],
      ...rows.map((r) => [
        r.coachName,
        r.batchNames ?? '',
        r.sessionCount,
        r.studentCount,
        r.attendancePct ?? '',
      ]),
    ])
  }
  function exportPdf() {
    if (!rows) return
    void exportTableToPdf(
      `coach-activity-report-${range.from}-to-${range.to}.pdf`,
      'Coach activity report',
      `${formatDate(range.from)} – ${formatDate(range.to)}`,
      ['Coach', 'Batches', 'Sessions', 'Students', 'Attendance %'],
      rows.map((r) => [
        r.coachName,
        r.batchNames ?? '—',
        r.sessionCount,
        r.studentCount,
        r.attendancePct !== null ? `${r.attendancePct}%` : '—',
      ]),
    )
  }

  return (
    <>
      <ReportFilters
        range={range}
        onRangeChange={(f, t) => {
          setRange({ from: f, to: t })
        }}
        batchId={batchId}
        onBatchChange={setBatchId}
        onExportCsv={exportCsv}
        onExportPdf={exportPdf}
        exportDisabled={!rows || rows.length === 0}
      />
      <ReportTable
        isLoading={isLoading}
        isError={isError}
        onRetry={() => {
          void refetch()
        }}
        isEmpty={!rows || rows.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Coach</TableHead>
              <TableHead>Batches</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Attendance %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.coachId}>
                <TableCell className="font-bold">{r.coachName}</TableCell>
                <TableCell>{r.batchNames ?? '—'}</TableCell>
                <TableCell>{r.sessionCount}</TableCell>
                <TableCell>{r.studentCount}</TableCell>
                <TableCell>{r.attendancePct !== null ? `${r.attendancePct}%` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTable>
    </>
  )
}

function ReportTable({
  isLoading,
  isError,
  onRetry,
  isEmpty,
  children,
}: {
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  isEmpty: boolean
  children: React.ReactNode
}) {
  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load this report"
        description="Check your connection and try again."
        action={
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    )
  }
  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />
  if (isEmpty) {
    return (
      <EmptyState
        title="Nothing for this range"
        description="Try a wider date range, or a different batch."
      />
    )
  }
  return <div className="scroll-shadow-x overflow-x-auto rounded-lg border">{children}</div>
}
