import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useBatchOptions } from '@/features/batches'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { useAttendanceTrend } from '../../api/attendanceTrend'
import { ChartCard } from '@/shared/ui/ChartCard'

interface AttendanceTrendChartProps {
  months: number
  batchId: string
  onBatchChange: (batchId: string) => void
}

/** Attendance % trend, filterable by batch (its own filter, independent
 * of the batch capacity chart which has none). */
export function AttendanceTrendChart({
  months,
  batchId,
  onBatchChange,
}: AttendanceTrendChartProps) {
  const { data: batches } = useBatchOptions()
  const { data, isLoading } = useAttendanceTrend(months, batchId === 'all' ? null : batchId)

  return (
    <ChartCard
      title="Attendance trend"
      subtitle={`Last ${months} months`}
      isLoading={isLoading}
      isEmpty={!data || data.length === 0}
      emptyDescription="No attendance has been marked in this window yet."
      action={
        <Select value={batchId} onValueChange={onBatchChange}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
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
      }
    >
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              width={32}
            />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--border))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                color: 'hsl(var(--popover-foreground))',
                fontSize: 12,
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              formatter={(value) => [`${value}%`, 'Attendance']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#00F2FE"
              strokeWidth={3}
              dot={{ r: 4, fill: 'hsl(var(--card))', stroke: '#00F2FE', strokeWidth: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
