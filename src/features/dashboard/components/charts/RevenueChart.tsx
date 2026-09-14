import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useRevenueTrend } from '../../api/revenueTrend'
import { ChartCard } from '../ChartCard'

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/** Short form for axis ticks — "₹1.4L" / "₹40K" — the full rupees() figure
 * is too wide to fit without clipping at a normal axis width. */
function rupeesShort(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

export function RevenueChart({ months }: { months: number }) {
  const { data, isLoading } = useRevenueTrend(months)

  return (
    <ChartCard
      title="Revenue collected vs expected"
      subtitle={`Last ${months} months`}
      isLoading={isLoading}
      isEmpty={!data || data.length === 0}
      emptyDescription="No fees have been generated or collected in this window yet."
    >
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              width={44}
              tickFormatter={(v: number) => rupeesShort(v)}
            />
            <Tooltip cursor={{ fill: '#f5f3f3' }} formatter={(value) => rupees(Number(value))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="collected" name="Collected" fill="#201e1d" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expected" name="Expected" fill="#d7d3d3" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
