import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useCoachLoad } from '../../api/coachLoad'
import { ChartCard } from '../ChartCard'

export function CoachLoadChart({ days }: { days: number }) {
  const { data, isLoading } = useCoachLoad(days)

  return (
    <ChartCard
      title="Coach load"
      subtitle={`Students & sessions, last ${days} days`}
      isLoading={isLoading}
      isEmpty={!data || data.length === 0}
      emptyDescription="No active coaches yet."
    >
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e2e2" />
            <XAxis dataKey="coachName" tick={{ fontSize: 11 }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
            <Tooltip cursor={{ fill: '#f5f3f3' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="studentCount" name="Students" fill="#201e1d" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sessionCount" name="Sessions" fill="#ec3013" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
