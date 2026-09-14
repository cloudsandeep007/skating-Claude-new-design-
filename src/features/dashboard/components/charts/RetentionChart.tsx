import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useRetention } from '../../api/retention'
import { ChartCard } from '../ChartCard'

export function RetentionChart({ months }: { months: number }) {
  const { data, isLoading } = useRetention(months)

  return (
    <ChartCard
      title="Retention"
      subtitle={`Active skaters, last ${months} months`}
      isLoading={isLoading}
      isEmpty={!data || data.length === 0}
      emptyDescription="No attendance history in this window yet."
    >
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
            <Tooltip formatter={(value) => [value, 'Active skaters']} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#145ca4"
              strokeWidth={3}
              dot={{ r: 4, fill: '#fff', stroke: '#145ca4', strokeWidth: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
