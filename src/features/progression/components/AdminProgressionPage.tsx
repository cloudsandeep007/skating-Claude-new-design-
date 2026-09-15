import { AlertCircle, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useLevelDistribution, useStaleStudents } from '../api/adminReports'

function formatWhen(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function AdminProgressionPage() {
  const [days, setDays] = useState('60')
  const { data: distribution, isLoading: loadingDist } = useLevelDistribution()
  const { data: stale, isLoading: loadingStale } = useStaleStudents(Number(days))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where skaters stand on the progression ladder.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/levels">
            <Settings2 className="h-4 w-4" />
            Manage levels & skills
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribution across levels</CardTitle>
          <CardDescription>Active skaters currently on each level.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDist ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : !distribution ||
            distribution.length === 0 ||
            distribution.every((d) => d.studentCount === 0) ? (
            <EmptyState
              className="border-0 shadow-none"
              title="No skaters placed on a level yet"
              description="Once skaters have a level assigned, their distribution shows up here."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
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
                    formatter={(value) => [`${value} skater${value === 1 ? '' : 's'}`, '']}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
                  />
                  <Bar dataKey="studentCount" fill="#FF4D4D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Haven't progressed</CardTitle>
            <CardDescription>Active skaters with no skill achieved in the window.</CardDescription>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loadingStale ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : !stale || stale.length === 0 ? (
            <EmptyState
              className="border-0 shadow-none"
              title="Everyone's moving"
              description={`No active skater has gone ${days}+ days without a skill achieved.`}
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {stale.map((row) => (
                <li key={row.studentId} className="flex items-center gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{row.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.levelName ?? 'No level'} · last achieved {formatWhen(row.lastAchievedAt)}
                    </div>
                  </div>
                  {row.isTopLevel && <StatusBadge tone="neutral">Top level</StatusBadge>}
                  <StatusBadge
                    tone={row.daysSince >= 90 ? 'danger' : 'warning'}
                    className="shrink-0"
                  >
                    <AlertCircle className="mr-1 h-3 w-3" />
                    {row.daysSince}d
                  </StatusBadge>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/admin/students/${row.studentId}`}>View</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
