import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useSkillDistribution } from '../../api/skillDistribution'
import { ChartCard } from '../ChartCard'

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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e2e2" />
            <XAxis
              dataKey="levelName"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={56}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
            <Tooltip
              cursor={{ fill: '#f5f3f3' }}
              formatter={(value) => [`${value} skater${value === 1 ? '' : 's'}`, '']}
            />
            <Bar dataKey="studentCount" fill="#ec3013" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
