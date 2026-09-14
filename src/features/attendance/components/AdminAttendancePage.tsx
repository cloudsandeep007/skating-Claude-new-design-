import { useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

import { useBatchOptions } from '@/features/batches'
import { useStudentOptions } from '@/features/students'
import { downloadCsv } from '@/shared/lib/csv'
import { addDays, formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import { useAttendanceSummary, useSessionsOnDate, useStudentHistory } from '../api/adminQueries'
import { useSessionForMarking } from '../api/getSessionForMarking'
import { computeTotals } from '../hooks/attendancePct'
import { attendanceLabel, attendanceTone, pctColorClass } from '../hooks/attendanceTone'
import { OverrideSelect } from './OverrideSelect'

const TAB_TRIGGER =
  'h-[52px] rounded-none border-b-2 border-transparent px-4.5 data-[state=active]:border-foreground data-[state=active]:shadow-none'

export function AdminAttendancePage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Attendance</h1>
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Tabs defaultValue="date">
          <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="date" className={TAB_TRIGGER}>
              By date
            </TabsTrigger>
            <TabsTrigger value="batch" className={TAB_TRIGGER}>
              By batch
            </TabsTrigger>
            <TabsTrigger value="student" className={TAB_TRIGGER}>
              By student
            </TabsTrigger>
          </TabsList>
          <TabsContent value="date" className="p-4">
            <ByDate />
          </TabsContent>
          <TabsContent value="batch" className="p-4">
            <ByBatch />
          </TabsContent>
          <TabsContent value="student" className="p-4">
            <ByStudent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ByDate() {
  const [date, setDate] = useState(todayIso())
  const [openId, setOpenId] = useState<string | null>(null)
  const { data: sessions, isLoading } = useSessionsOnDate(date)

  return (
    <div className="space-y-4">
      <Input
        type="date"
        value={date}
        className="w-[180px]"
        onChange={(e) => {
          setDate(e.target.value)
          setOpenId(null)
        }}
      />

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : !sessions || sessions.length === 0 ? (
        <EmptyState title="No sessions that day" />
      ) : (
        <ul className="divide-y rounded-lg border">
          {sessions.map((session) => {
            const open = openId === session.id
            const cancelled = session.status === 'cancelled'
            return (
              <li key={session.id}>
                <button
                  type="button"
                  disabled={cancelled}
                  onClick={() => {
                    setOpenId(open ? null : session.id)
                  }}
                  className={cn(
                    'flex h-14 w-full items-center gap-3 px-4 text-left',
                    cancelled ? 'opacity-60' : 'hover:bg-muted',
                  )}
                >
                  {cancelled ? (
                    <span className="w-4" />
                  ) : open ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="w-40 font-mono text-xs text-muted-foreground">
                    {formatTime(session.startTime)} – {formatTime(session.endTime)}
                  </span>
                  <span className="flex-1 font-bold">{session.batchName}</span>
                  {cancelled ? (
                    <StatusBadge tone="danger">Cancelled</StatusBadge>
                  ) : (
                    <StatusBadge
                      tone={
                        session.markedCount === 0
                          ? 'neutral'
                          : session.markedCount >= session.studentCount
                            ? 'success'
                            : 'warning'
                      }
                    >
                      {session.markedCount}/{session.studentCount} marked
                    </StatusBadge>
                  )}
                </button>
                {open && <SessionRoster sessionId={session.id} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SessionRoster({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useSessionForMarking(sessionId)
  if (isLoading || !data) return <Skeleton className="mx-4 mb-4 h-20 rounded-lg" />

  return (
    <div className="border-t bg-muted/40">
      <Table>
        <TableBody>
          {data.roster.map((student) => (
            <TableRow key={student.id}>
              <TableCell className="pl-12 font-bold">{student.fullName}</TableCell>
              <TableCell>
                <StatusBadge tone={attendanceTone(data.saved[student.id] ?? null)}>
                  {attendanceLabel(data.saved[student.id] ?? null)}
                </StatusBadge>
              </TableCell>
              <TableCell className="text-right">
                <OverrideSelect
                  sessionId={sessionId}
                  studentId={student.id}
                  studentName={student.fullName}
                  value={data.saved[student.id] ?? null}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="px-4 pb-3 pt-1 text-xs text-muted-foreground">
        Changes here are recorded in the audit log with your name.
      </div>
    </div>
  )
}

function RangePicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={from}
        className="w-[160px]"
        onChange={(e) => {
          onChange(e.target.value, to)
        }}
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="date"
        value={to}
        className="w-[160px]"
        onChange={(e) => {
          onChange(from, e.target.value)
        }}
      />
    </div>
  )
}

function ByBatch() {
  const today = todayIso()
  const [batchId, setBatchId] = useState<string>('all')
  const [range, setRange] = useState({ from: addDays(today, -29), to: today })
  const { data: batches } = useBatchOptions()
  const { data: rows, isLoading } = useAttendanceSummary(
    range.from,
    range.to,
    batchId === 'all' ? null : batchId,
  )

  const batchName = batches?.find((b) => b.id === batchId)?.name ?? 'All batches'

  function exportCsv() {
    if (!rows) return
    downloadCsv(`attendance-${batchName}-${range.from}-to-${range.to}.csv`, [
      ['Student', 'Counted sessions', 'Attended', 'Absent', 'Late', 'Excused', 'Attendance %'],
      ...rows.map((r) => [r.fullName, r.counted, r.attended, r.absent, r.late, r.excused, r.pct]),
    ])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger className="w-[220px]">
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
        <RangePicker
          from={range.from}
          to={range.to}
          onChange={(from, to) => {
            setRange({ from, to })
          }}
        />
        <Button variant="outline" className="ml-auto" onClick={exportCsv} disabled={!rows?.length}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title="No attendance in this range" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">Late</TableHead>
              <TableHead className="text-right">Excused</TableHead>
              <TableHead className="text-right">Attendance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-bold">{r.fullName}</TableCell>
                <TableCell className="text-right">{r.counted}</TableCell>
                <TableCell className="text-right">{r.attended - r.late}</TableCell>
                <TableCell className="text-right">{r.absent}</TableCell>
                <TableCell className="text-right">{r.late}</TableCell>
                <TableCell className="text-right">{r.excused}</TableCell>
                <TableCell className={cn('text-right font-bold', pctColorClass(r.pct))}>
                  {r.pct === null ? '—' : `${r.pct}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function ByStudent() {
  const today = todayIso()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [range, setRange] = useState({ from: addDays(today, -89), to: today })
  const { data: students } = useStudentOptions()
  const { data: rows, isLoading } = useStudentHistory(studentId, range.from, range.to)

  const totals = computeTotals((rows ?? []).map((r) => r.status))
  const studentName = students?.find((s) => s.id === studentId)?.fullName ?? ''

  function exportCsv() {
    if (!rows) return
    downloadCsv(`attendance-${studentName}-${range.from}-to-${range.to}.csv`, [
      ['Date', 'Time', 'Batch', 'Status'],
      ...rows.map((r) => [
        r.sessionDate,
        formatTime(r.startTime),
        r.batchName,
        attendanceLabel(r.status),
      ]),
      [],
      ['Attendance %', totals.pct ?? ''],
    ])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={studentId ?? ''} onValueChange={setStudentId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Choose a student" />
          </SelectTrigger>
          <SelectContent>
            {students?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <RangePicker
          from={range.from}
          to={range.to}
          onChange={(from, to) => {
            setRange({ from, to })
          }}
        />
        <Button variant="outline" className="ml-auto" onClick={exportCsv} disabled={!rows?.length}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {studentId === null ? (
        <EmptyState
          title="Pick a student"
          description="Their session-by-session history appears here."
        />
      ) : isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title="No sessions in this range" />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-4 rounded-lg bg-muted px-4 py-3">
            <span className={cn('text-3xl font-extrabold', pctColorClass(totals.pct))}>
              {totals.pct === null ? '—' : `${totals.pct}%`}
            </span>
            <span className="text-sm text-muted-foreground">
              {totals.attended} of {totals.counted} counted · {totals.present} present ·{' '}
              {totals.late} late · {totals.absent} absent · {totals.excused} excused
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Override</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.sessionId}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(r.sessionDate)}{' '}
                    <span className="text-muted-foreground">{formatTime(r.startTime)}</span>
                  </TableCell>
                  <TableCell>{r.batchName}</TableCell>
                  <TableCell>
                    <StatusBadge tone={attendanceTone(r.status)}>
                      {attendanceLabel(r.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <OverrideSelect
                      sessionId={r.sessionId}
                      studentId={studentId}
                      studentName={studentName}
                      value={r.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
