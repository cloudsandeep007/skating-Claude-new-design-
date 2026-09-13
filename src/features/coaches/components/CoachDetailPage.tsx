import { ArrowLeft, Pencil } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useCoach } from '../api/getCoach'
import { useSetCoachStatus } from '../api/setCoachStatus'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function CoachDetailPage() {
  const { coachId = '' } = useParams<{ coachId: string }>()
  const navigate = useNavigate()
  const { data: coach, isLoading } = useCoach(coachId)
  const setStatus = useSetCoachStatus()

  if (isLoading || !coach) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  const isActive = coach.status === 'active'
  const { id, fullName } = coach

  const toggleStatus = () => {
    const nextStatus = isActive ? 'inactive' : 'active'
    setStatus.mutate(
      { coachId: id, status: nextStatus },
      {
        onSuccess: () => {
          toast.success(isActive ? `${fullName} was deactivated.` : `${fullName} was reactivated.`)
        },
        onError: () => {
          toast.error('Could not update this coach.')
        },
      },
    )
  }

  return (
    <div>
      <Button
        variant="ghost"
        className="mb-3"
        onClick={() => {
          void navigate('/admin/coaches')
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        All coaches
      </Button>

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="bg-neutral-950 text-lg font-extrabold text-white">
              {initials(coach.fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-[220px] flex-1">
            <div className="text-2xl font-extrabold tracking-tight">{coach.fullName}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge tone={isActive ? 'success' : 'neutral'}>
                {isActive ? 'Active' : 'Inactive'}
              </StatusBadge>
              {coach.specialization && (
                <StatusBadge tone="neutral">{coach.specialization}</StatusBadge>
              )}
            </div>
            <div className="mt-2.5 text-sm text-muted-foreground">
              Joined {new Date(coach.joinedDate).toLocaleDateString()}
              {coach.email && ` · ${coach.email}`}
              {coach.phone && ` · ${coach.phone}`}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="icon" asChild aria-label="Edit coach">
              <Link to={`/admin/coaches/${coach.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant={isActive ? 'destructive' : 'outline'}
              onClick={toggleStatus}
              disabled={setStatus.isPending}
            >
              {isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="mb-3 text-lg font-bold">Assigned batches</h2>
        {coach.batches.length === 0 ? (
          <EmptyState
            title="No batches assigned"
            description="Assign this coach to a batch from the batches screen."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {coach.batches.map((batch) => (
              <Card key={batch.id}>
                <CardContent className="flex items-center justify-between pt-6">
                  <span className="font-bold">{batch.name}</span>
                  <StatusBadge tone="neutral">{batch.studentCount} students</StatusBadge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
