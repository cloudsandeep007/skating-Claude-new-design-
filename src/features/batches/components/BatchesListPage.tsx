import { Layers, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { formatDays, formatTimeRange } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { useBatches } from '../api/listBatches'
import { capacityTone } from '../hooks/capacity'

export function BatchesListPage() {
  const navigate = useNavigate()
  const { data: batches, isLoading } = useBatches()

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Batches</h1>
        <Button asChild>
          <Link to="/admin/batches/new">
            <Plus className="h-4 w-4" />
            New batch
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-4">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : !batches || batches.length === 0 ? (
          <div className="p-2">
            <EmptyState
              className="border-0 shadow-none"
              icon={Layers}
              title="No batches yet"
              description="Create a batch to start enrolling skaters and scheduling sessions."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Coach</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow
                  key={batch.id}
                  className="cursor-pointer"
                  onClick={() => {
                    void navigate(`/admin/batches/${batch.id}`)
                  }}
                >
                  <TableCell>
                    <div className="font-bold">{batch.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[batch.levelRange, batch.venue].filter(Boolean).join(' · ')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {batch.coachName ?? <span className="text-muted-foreground">Unassigned</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatTimeRange(batch.startTime, batch.endTime)}
                  </TableCell>
                  <TableCell>{formatDays(batch.daysOfWeek)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={capacityTone(batch.enrolledCount, batch.capacity)}>
                      {batch.enrolledCount} / {batch.capacity}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={batch.status === 'active' ? 'success' : 'neutral'}>
                      {batch.status === 'active' ? 'Active' : batch.status}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
