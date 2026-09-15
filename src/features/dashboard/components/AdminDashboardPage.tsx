import { Download } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { exportElementToPdf } from '@/shared/lib/pdf'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { useDashboardStatCards } from '../api/statCards'
import { AttendanceTrendChart } from './charts/AttendanceTrendChart'
import { BatchCapacityChart } from './charts/BatchCapacityChart'
import { CoachLoadChart } from './charts/CoachLoadChart'
import { RetentionChart } from './charts/RetentionChart'
import { RevenueChart } from './charts/RevenueChart'
import { SkillDistributionChart } from './charts/SkillDistributionChart'
import { NeedsAttentionPanel } from './NeedsAttentionPanel'
import { RenewalsDuePanel } from './RenewalsDuePanel'
import { StatCard } from '@/shared/ui/StatCard'
import { computeTrend } from '../hooks/trend'
import { MONTH_RANGE_OPTIONS, type MonthRange } from '../types'

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function AdminDashboardPage() {
  const [months, setMonths] = useState<MonthRange>(6)
  const [attendanceBatchId, setAttendanceBatchId] = useState('all')
  const [exporting, setExporting] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const { data: stats, isLoading: loadingStats } = useDashboardStatCards()

  const studentsTrend = computeTrend(
    stats?.activeStudents ?? null,
    stats ? stats.activeStudents - stats.newStudentsThisMonth : null,
  )
  const attendanceTrend = computeTrend(
    stats?.todayAttendancePct ?? null,
    stats?.lastMonthAttendancePct ?? null,
  )
  const feesTrend = computeTrend(
    stats?.feesCollectedThisMonth ?? null,
    stats?.feesCollectedLastMonth ?? null,
  )
  const outstandingTrend = computeTrend(
    stats?.outstandingDueThisMonth ?? null,
    stats?.outstandingDueLastMonth ?? null,
  )

  async function exportPdf() {
    if (!contentRef.current) return
    setExporting(true)
    try {
      await exportElementToPdf(
        contentRef.current,
        `dashboard-${new Date().toISOString().slice(0, 10)}.pdf`,
        'Academy Dashboard',
      )
    } catch {
      toast.error('Could not export the dashboard as PDF.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where the academy stands right now, and who needs a call today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={String(months)}
            onValueChange={(v) => {
              setMonths(Number(v) as MonthRange)
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_RANGE_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  Last {m} months
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              void exportPdf()
            }}
            disabled={exporting}
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export PDF'}
          </Button>
        </div>
      </div>

      <div ref={contentRef} className="space-y-5 bg-muted p-0.5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active students"
            value={stats ? String(stats.activeStudents) : '—'}
            trend={studentsTrend}
            trendCaption="vs last month"
            isLoading={loadingStats}
          />
          <StatCard
            label="Today's attendance"
            value={
              stats?.todayAttendancePct !== null && stats?.todayAttendancePct !== undefined
                ? `${stats.todayAttendancePct}%`
                : '—'
            }
            trend={attendanceTrend}
            trendCaption="pts vs last month"
            isLoading={loadingStats}
          />
          <StatCard
            label={`Fees collected · ${new Date().toLocaleDateString(undefined, { month: 'short' })}`}
            value={stats ? rupees(stats.feesCollectedThisMonth) : '—'}
            trend={feesTrend}
            trendCaption={stats ? `vs ${rupees(stats.feesCollectedLastMonth)}` : ''}
            formatDelta={rupees}
            isLoading={loadingStats}
          />
          <StatCard
            label="Outstanding dues"
            value={stats ? rupees(stats.outstandingTotal) : '—'}
            trend={outstandingTrend}
            trendCaption={stats ? `${stats.outstandingStudents} students` : ''}
            formatDelta={rupees}
            invertColor
            emphasize
            isLoading={loadingStats}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AttendanceTrendChart
            months={months}
            batchId={attendanceBatchId}
            onBatchChange={setAttendanceBatchId}
          />
          <RevenueChart months={months} />
          <BatchCapacityChart />
          <SkillDistributionChart />
          <RetentionChart months={months} />
          <CoachLoadChart days={months * 30} />
        </div>

        <RenewalsDuePanel />

        <NeedsAttentionPanel />
      </div>
    </div>
  )
}
