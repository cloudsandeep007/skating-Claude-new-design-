import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useBatchCapacity } from '../../api/batchCapacity'
import { ChartCard } from '@/shared/ui/ChartCard'

export function BatchCapacityChart() {
  const { data, isLoading } = useBatchCapacity()
  const rows = data?.map((b) => ({ ...b, remaining: Math.max(b.capacity - b.enrolledCount, 0) }))

  return (
    <ChartCard
      title="Students per batch"
      subtitle={data ? `${data.length} batches` : undefined}
      isLoading={isLoading}
      isEmpty={!rows || rows.length === 0}
      emptyDescription="No active batches yet."
      height={Math.max(220, (rows?.length ?? 0) * 34)}
    >
      <div style={{ height: Math.max(220, (rows?.length ?? 0) * 34) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            barCategoryGap={10}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              type="category"
              dataKey="batchName"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              width={140}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--accent))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                color: 'hsl(var(--popover-foreground))',
                fontSize: 12,
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              formatter={(value, name) =>
                name === 'enrolledCount' ? [value, 'Enrolled'] : [value, 'Capacity']
              }
            />
            <Bar dataKey="capacity" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} />
            <Bar dataKey="enrolledCount" fill="#00F2FE" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
