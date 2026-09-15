import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useSkillDistribution } from '../../api/skillDistribution'
import { ChartCard } from '@/shared/ui/ChartCard'

export function SkillDistributionChart() {
  const { data, isLoading } = useSkillDistribution()
  const hasData = !!data && data.some((d) => d.studentCount > 0)

  return (
    <ChartCard
      title="Skill level distribution"
      subtitle={data ? `${data.length} levels` : undefined}
      isLoading={isLoading}
      isEmpty={!hasData}
      emptyDescription="No skaters have been placed on a level yet."
    >
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="levelName"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              interval={0}
              angle={-25}
              textAnchor="end"
              height={56}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              width={28}
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
              formatter={(value) => [`${value} skater${value === 1 ? '' : 's'}`, '']}
            />
            <Bar dataKey="studentCount" fill="#FF4D4D" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
