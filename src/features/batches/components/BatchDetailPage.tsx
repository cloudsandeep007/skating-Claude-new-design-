import { ArrowLeft, Pencil, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { GenerateScheduleDialog } from '@/features/schedule'
import { formatDate, formatDays, formatTime, formatTimeRange } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useRemoveStudent } from '../api/enrollment'
import { useBatch } from '../api/getBatch'
import { capacityTone } from '../hooks/capacity'
import { EnrollStudentDialog } from './EnrollStudentDialog'

export function BatchDetailPage() {
  const { batchId = '' } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const { data: batch, isLoading } = useBatch(batchId)
  const removeStudent = useRemoveStudent(batchId)

  if (isLoading || !batch) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => {
          void navigate('/admin/batches')
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        All batches
      </Button>

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{batch.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge tone={capacityTone(batch.enrolledCount, batch.capacity)}>
                {batch.enrolledCount} / {batch.capacity} enrolled
              </StatusBadge>
              {batch.levelRange && <StatusBadge tone="neutral">{batch.levelRange}</StatusBadge>}
              <StatusBadge tone={batch.status === 'active' ? 'success' : 'neutral'}>
                {batch.status}
              </StatusBadge>
            </div>
            <div className="mt-2.5 text-sm text-muted-foreground">
              {formatDays(batch.daysOfWeek)} · {formatTimeRange(batch.startTime, batch.endTime)}
              {batch.venue && ` · ${batch.venue}`}
              {' · '}
              {batch.coachName ? `Coach ${batch.coachName}` : 'No coach assigned'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <GenerateScheduleDialog batchId={batch.id} batchName={batch.name} />
            <Button variant="outline" size="icon" asChild aria-label="Edit batch">
              <Link to={`/admin/batches/${batch.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-bold">Roster</h2>
            <EnrollStudentDialog
              batchId={batch.id}
              enrolledCount={batch.enrolledCount}
              capacity={batch.capacity}
            />
          </div>
          {batch.roster.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No skaters yet"
                description="Enroll the first skater to this batch."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {batch.roster.map((entry) => (
                <li key={entry.studentId} className="flex items-center gap-3 px-4 py-3">
                  <Link
                    to={`/admin/students/${entry.studentId}`}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <div className="truncate font-bold">{entry.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.levelName ?? 'No level'} · since {formatDate(entry.enrolledDate)}
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-brand-700"
                    aria-label={`Remove ${entry.fullName} from batch`}
                    disabled={removeStudent.isPending}
                    onClick={() => {
                      removeStudent.mutate(
                        { batchId: batch.id, studentId: entry.studentId },
                        {
                          onSuccess: () => {
                            toast.success(`${entry.fullName} removed from ${batch.name}.`)
                          },
                          onError: () => {
                            toast.error('Could not remove this skater.')
                          },
                        },
                      )
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border bg-card shadow-sm">
          <div className="border-b p-4">
            <h2 className="font-bold">Upcoming sessions</h2>
          </div>
          {batch.upcomingSessions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Nothing scheduled"
                description="Use Generate schedule to create sessions from this batch's days."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {batch.upcomingSessions.map((session) => {
                const cancelled = session.status === 'cancelled'
                return (
                  <li
                    key={session.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 text-sm',
                      cancelled && 'opacity-60',
                    )}
                  >
                    <span className="w-24 font-mono text-xs text-muted-foreground">
                      {formatDate(session.sessionDate)}
                    </span>
                    <span className={cn('flex-1', cancelled && 'line-through')}>
                      {formatTime(session.startTime)} – {formatTime(session.endTime)}
                    </span>
                    {cancelled && <StatusBadge tone="danger">Cancelled</StatusBadge>}
                    {session.status === 'completed' && (
                      <StatusBadge tone="success">Done</StatusBadge>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
