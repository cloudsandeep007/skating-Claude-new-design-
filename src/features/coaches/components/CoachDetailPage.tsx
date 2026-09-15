import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useSignedPhotoUrls } from '@/shared/lib/signedPhotoUrls'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PersonAvatar } from '@/shared/ui/PersonAvatar'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useDeleteCoach } from '../api/deleteCoach'
import { useCoach } from '../api/getCoach'
import { useSetCoachStatus } from '../api/setCoachStatus'

export function CoachDetailPage() {
  const { coachId = '' } = useParams<{ coachId: string }>()
  const navigate = useNavigate()
  const { data: coach, isLoading } = useCoach(coachId)
  const setStatus = useSetCoachStatus()
  const deleteCoach = useDeleteCoach()
  const { data: photoUrls } = useSignedPhotoUrls('coach-photos', [coach?.photoUrl ?? null])

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
          <PersonAvatar
            name={coach.fullName}
            photoUrl={coach.photoUrl ? photoUrls?.[coach.photoUrl] : undefined}
            className="h-16 w-16 shrink-0"
            fallbackClassName="bg-primary text-lg font-extrabold text-primary-foreground"
          />

          <div className="min-w-[220px] flex-1">
            <div className="font-display text-2xl font-extrabold tracking-tight">{coach.fullName}</div>
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Remove ${fullName}`}
                  className="text-brand-400 hover:text-brand-300"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {fullName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes their account — they won't be able to sign in again.
                    Any batch or upcoming session they're assigned to stays exactly as it is, just
                    with no coach assigned. Sessions and attendance they already marked are kept.
                    This can't be undone; use Deactivate instead if they might come back.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep coach</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteCoach.mutate(coach.profileId, {
                        onSuccess: () => {
                          toast.success(`${fullName} was removed.`)
                          void navigate('/admin/coaches')
                        },
                        onError: () => {
                          toast.error('Could not remove this coach.')
                        },
                      })
                    }}
                  >
                    Remove coach
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
