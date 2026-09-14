import { Award, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useSignedPhotoUrls } from '@/shared/lib/signedPhotoUrls'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PersonAvatar } from '@/shared/ui/PersonAvatar'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { useCoaches } from '../api/listCoaches'

export function CoachesListPage() {
  const navigate = useNavigate()
  const { data: coaches, isLoading } = useCoaches()
  const { data: photoUrls } = useSignedPhotoUrls(
    'coach-photos',
    (coaches ?? []).map((c) => c.photoUrl),
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Coaches</h1>
        <Button asChild>
          <Link to="/admin/coaches/new">
            <Plus className="h-4 w-4" />
            Add coach
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : !coaches || coaches.length === 0 ? (
          <div className="p-2">
            <EmptyState
              className="border-0 shadow-none"
              icon={Award}
              title="No coaches yet"
              description="Add your first coach to start assigning batches."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coach</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Batches</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map((coach) => (
                <TableRow
                  key={coach.id}
                  className="cursor-pointer"
                  onClick={() => {
                    void navigate(`/admin/coaches/${coach.id}`)
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <PersonAvatar
                        name={coach.fullName}
                        photoUrl={coach.photoUrl ? photoUrls?.[coach.photoUrl] : undefined}
                        className="h-9 w-9"
                        fallbackClassName="bg-neutral-200 text-xs font-bold text-neutral-800"
                      />
                      <div>
                        <div className="font-bold">{coach.fullName}</div>
                        <div className="text-xs text-muted-foreground">{coach.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{coach.specialization ?? '—'}</TableCell>
                  <TableCell>{coach.batchCount}</TableCell>
                  <TableCell>{coach.studentCount}</TableCell>
                  <TableCell>
                    <StatusBadge tone={coach.status === 'active' ? 'success' : 'neutral'}>
                      {coach.status === 'active' ? 'Active' : 'Inactive'}
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
