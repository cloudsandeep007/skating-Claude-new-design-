import { useMemo, useState } from 'react'
import { BellRing, Download, RefreshCw, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { useBatchOptions } from '@/features/batches'
import { downloadCsv } from '@/shared/lib/csv'
import { formatDate, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { EmptyState } from '@/shared/ui/EmptyState'
import { MonthPicker } from '@/shared/ui/MonthPicker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { useFeeDashboard } from '../api/dashboard'
import { useFeeList } from '../api/feeList'
import { useGenerateFees } from '../api/generate'
import { useSendFeeReminders } from '../api/reminders'
import { canWaive } from '../hooks/feeMath'
import { feeStatusLabel, feeStatusTone, formatRupees } from '../hooks/feeTone'
import { FEE_STATUSES, type FeeListRow, type FeeStatus } from '../types'
import { RecordPaymentDialog, type PaymentTarget } from './RecordPaymentDialog'
import { WaiveFeeDialog, type WaiveTarget } from './WaiveFeeDialog'

export function FeeDashboardPage() {
  const { profile } = useAuth()
  const { data: batches } = useBatchOptions()
  const [month, setMonth] = useState(`${todayIso().slice(0, 7)}-01`)
  const [statusFilter, setStatusFilter] = useState<FeeStatus | 'all'>('all')
  const [batchId, setBatchId] = useState('all')
  const [payTarget, setPayTarget] = useState<PaymentTarget | null>(null)
  const [waiveTarget, setWaiveTarget] = useState<WaiveTarget | null>(null)
  /** One click, answers "who's currently due" without having to remember
   * that clearing the month filter is what shows every outstanding fee. */
  const [dueOnly, setDueOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: summary, isLoading: loadingSummary } = useFeeDashboard(month)
  const {
    data: rows,
    isLoading: loadingList,
    isError,
    refetch,
  } = useFeeList({
    status: dueOnly ? 'overdue' : statusFilter === 'all' ? null : statusFilter,
    month: dueOnly ? null : month,
    batchId: batchId === 'all' ? null : batchId,
  })
  const generateFees = useGenerateFees()
  const sendReminders = useSendFeeReminders()

  const selectedRows = (rows ?? []).filter((r) => selected.has(r.studentFeeId))

  async function remind(studentFeeIds: string[]) {
    try {
      const sent = await sendReminders.mutateAsync(studentFeeIds)
      toast.success(
        sent > 0
          ? `Sent ${sent} reminder${sent === 1 ? '' : 's'}.`
          : 'Nobody selected has a parent on file to remind — nothing sent.',
      )
      setSelected(new Set())
    } catch {
      toast.error('Could not send reminders.')
    }
  }

  const totals = useMemo(() => {
    const pending = (rows ?? []).filter((r) => r.status === 'pending')
    const overdue = (rows ?? []).filter((r) => r.status === 'overdue')
    return {
      pendingAmount: pending.reduce((sum, r) => sum + r.balance, 0),
      pendingCount: pending.length,
      overdueAmount: overdue.reduce((sum, r) => sum + r.balance, 0),
      overdueCount: overdue.length,
    }
  }, [rows])

  async function generate() {
    if (!profile?.academy_id) return
    try {
      const count = await generateFees.mutateAsync(profile.academy_id)
      toast.success(
        count > 0
          ? `Generated ${count} fee record${count === 1 ? '' : 's'}.`
          : 'Everyone is already up to date.',
      )
    } catch {
      toast.error('Could not generate fees.')
    }
  }

  function exportCsv() {
    if (!rows) return
    downloadCsv(`fees-${month.slice(0, 7)}.csv`, [
      [
        'Student',
        'Batch',
        'Plan',
        'Period start',
        'Period end',
        'Due date',
        'Amount',
        'Paid',
        'Balance',
        'Status',
      ],
      ...rows.map((r) => [
        r.fullName,
        r.batchNames ?? '',
        r.feePlanName ?? '',
        r.periodStart,
        r.periodEnd,
        r.dueDate,
        r.amount,
        r.paid,
        r.balance,
        feeStatusLabel(r.status),
      ]),
    ])
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Fees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manual payment recording — no gateway yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/fee-plans">
              <Settings2 className="h-4 w-4" />
              Manage plans
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void generate()
            }}
            disabled={generateFees.isPending}
          >
            <RefreshCw className="h-4 w-4" />
            {generateFees.isPending ? 'Generating…' : 'Generate now'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Collected this month"
          amount={summary?.collected ?? 0}
          count={summary?.paymentCount ?? 0}
          countLabel="payments"
          loading={loadingSummary}
          tone="success"
        />
        <SummaryCard
          label="Pending"
          amount={totals.pendingAmount}
          count={totals.pendingCount}
          countLabel="fees"
          loading={loadingList}
          tone="warning"
        />
        <SummaryCard
          label="Overdue"
          amount={totals.overdueAmount}
          count={totals.overdueCount}
          countLabel="fees"
          loading={loadingList}
          tone="danger"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant={dueOnly ? 'default' : 'outline'}
          onClick={() => {
            setDueOnly((v) => !v)
            setSelected(new Set())
          }}
        >
          Overdue{dueOnly ? ' — showing all months' : ''}
        </Button>
        <MonthPicker value={month} onChange={setMonth} className={cn(dueOnly && 'opacity-50')} />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as FeeStatus | 'all')
          }}
          disabled={dueOnly}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {FEE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {feeStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger className="w-[200px]">
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
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                void remind([...selected])
              }}
              disabled={sendReminders.isPending || selectedRows.some((r) => r.balance <= 0)}
            >
              <BellRing className="h-4 w-4" />
              {sendReminders.isPending ? 'Sending…' : `Send reminder (${selected.size})`}
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} disabled={!rows || rows.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {isError ? (
        <EmptyState
          tone="error"
          title="Couldn't load fees"
          description="Check your connection and try again."
          action={
            <Button
              variant="outline"
              onClick={() => {
                void refetch()
              }}
            >
              Try again
            </Button>
          }
        />
      ) : loadingList ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          title="No fees for this month"
          description="Try a different month, or generate fees for skaters who don't have one yet."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all"
                    checked={
                      rows.length > 0 &&
                      rows.filter((r) => r.balance > 0).every((r) => selected.has(r.studentFeeId))
                    }
                    onCheckedChange={(checked) => {
                      setSelected(
                        checked
                          ? new Set(rows.filter((r) => r.balance > 0).map((r) => r.studentFeeId))
                          : new Set(),
                      )
                    }}
                  />
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <FeeRow
                  key={row.studentFeeId}
                  row={row}
                  checked={selected.has(row.studentFeeId)}
                  onCheckedChange={(checked) => {
                    setSelected((current) => {
                      const next = new Set(current)
                      if (checked) next.add(row.studentFeeId)
                      else next.delete(row.studentFeeId)
                      return next
                    })
                  }}
                  onPay={() => {
                    setPayTarget({
                      studentFeeId: row.studentFeeId,
                      studentName: row.fullName,
                      amount: row.amount,
                      paid: row.paid,
                    })
                  }}
                  onWaive={() => {
                    setWaiveTarget({
                      studentFeeId: row.studentFeeId,
                      studentName: row.fullName,
                      amount: row.balance,
                    })
                  }}
                  onRemind={() => {
                    void remind([row.studentFeeId])
                  }}
                  remindPending={sendReminders.isPending}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RecordPaymentDialog
        fee={payTarget}
        onClose={() => {
          setPayTarget(null)
        }}
      />
      <WaiveFeeDialog
        fee={waiveTarget}
        onClose={() => {
          setWaiveTarget(null)
        }}
      />
    </div>
  )
}

function SummaryCard({
  label,
  amount,
  count,
  countLabel,
  loading,
  tone,
}: {
  label: string
  amount: number
  count: number
  countLabel: string
  loading: boolean
  tone: 'success' | 'warning' | 'danger'
}) {
  const TONE_TEXT: Record<typeof tone, string> = {
    success: 'text-success-400',
    warning: 'text-warning-400',
    danger: 'text-brand-400',
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-28" />
        ) : (
          <>
            <div className={`mt-1 text-2xl font-extrabold tracking-tight ${TONE_TEXT[tone]}`}>
              {formatRupees(amount)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {count} {countLabel}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function FeeRow({
  row,
  checked,
  onCheckedChange,
  onPay,
  onWaive,
  onRemind,
  remindPending,
}: {
  row: FeeListRow
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  onPay: () => void
  onWaive: () => void
  onRemind: () => void
  remindPending: boolean
}) {
  return (
    <TableRow>
      <TableCell>
        {row.balance > 0 && (
          <Checkbox
            aria-label={`Select ${row.fullName}`}
            checked={checked}
            onCheckedChange={(next) => {
              onCheckedChange(next === true)
            }}
          />
        )}
      </TableCell>
      <TableCell>
        <Link to={`/admin/students/${row.studentId}`} className="font-bold hover:underline">
          {row.fullName}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{row.batchNames ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{row.feePlanName ?? '—'}</TableCell>
      <TableCell>{formatDate(row.dueDate)}</TableCell>
      <TableCell>{formatRupees(row.amount)}</TableCell>
      <TableCell className={row.balance > 0 ? 'font-bold text-brand-400' : 'text-muted-foreground'}>
        {formatRupees(row.balance)}
        {row.lastRemindedAt && (
          <div className="text-xs font-normal text-muted-foreground">
            Reminded {daysAgo(row.lastRemindedAt)}
          </div>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge tone={feeStatusTone(row.status)}>{feeStatusLabel(row.status)}</StatusBadge>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          {row.balance > 0 && row.status !== 'waived' && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remind ${row.fullName}`}
              disabled={remindPending}
              onClick={onRemind}
            >
              <BellRing className="h-4 w-4" />
            </Button>
          )}
          {row.balance > 0 && row.status !== 'waived' && (
            <Button variant="outline" size="sm" onClick={onPay}>
              Record payment
            </Button>
          )}
          {canWaive(row.status) && (
            <Button variant="ghost" size="sm" onClick={onWaive}>
              Waive
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
