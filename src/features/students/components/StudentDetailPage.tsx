import { ArrowLeft, Pencil } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
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
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import { useSetStudentStatus } from '../api/archiveStudent'
import { useStudent } from '../api/getStudent'
import { attendancePctColorClass } from '../hooks/statusPresentation'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function StudentDetailPage() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { data: student, isLoading } = useStudent(studentId)
  const setStatus = useSetStudentStatus()

  if (isLoading || !student) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }

  const isArchived = student.status === 'archived'
  const { id, fullName } = student

  const archive = () => {
    setStatus.mutate(
      { studentId: id, status: 'archived' },
      {
        onSuccess: () => {
          toast.success(`${fullName} was archived.`)
        },
        onError: () => {
          toast.error('Could not archive this student.')
        },
      },
    )
  }

  const restore = () => {
    setStatus.mutate(
      { studentId: id, status: 'active' },
      {
        onSuccess: () => {
          toast.success(`${fullName} was restored.`)
        },
        onError: () => {
          toast.error('Could not restore this student.')
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
          void navigate('/admin/students')
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        All students
      </Button>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="bg-neutral-950 text-lg font-extrabold text-white">
              {initials(student.fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-[220px] flex-1">
            <div className="text-2xl font-extrabold tracking-tight">{student.fullName}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {student.batchName && <StatusBadge tone="neutral">{student.batchName}</StatusBadge>}
              {student.levelName && <StatusBadge tone="dark">{student.levelName}</StatusBadge>}
              {isArchived && <StatusBadge tone="neutral">Archived</StatusBadge>}
              {student.attendancePct !== null && (
                <StatusBadge
                  tone={student.attendancePct >= 80 ? 'success' : 'warning'}
                  className={attendancePctColorClass(student.attendancePct)}
                >
                  {student.attendancePct}% attendance
                </StatusBadge>
              )}
            </div>
            <div className="mt-2.5 text-sm text-muted-foreground">
              Joined {new Date(student.joinedDate).toLocaleDateString()}
              {student.coachName && ` · Coach ${student.coachName}`}
            </div>
          </div>

          {student.parents[0] && (
            <div className="min-w-[220px] flex-none rounded-lg bg-muted p-3.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Parent contact
              </div>
              <div className="mt-1.5 font-bold">{student.parents[0].fullName}</div>
              {student.parents[0].phone && (
                <div className="font-mono text-sm">{student.parents[0].phone}</div>
              )}
              {student.parents[0].email && (
                <div className="text-sm text-muted-foreground">{student.parents[0].email}</div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="icon" asChild aria-label="Edit student">
              <Link to={`/admin/students/${student.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            {isArchived ? (
              <Button variant="outline" onClick={restore} disabled={setStatus.isPending}>
                Restore
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Archive</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive {student.fullName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes them from active lists everywhere but keeps their full history.
                      You can restore them from here at any time — nothing is deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep active</AlertDialogCancel>
                    <AlertDialogAction onClick={archive}>Archive student</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="border-t border-t-neutral-200">
            {['overview', 'attendance', 'progress', 'fees', 'notes'].map((tab) => (
              <TabsTrigger key={tab} value={tab} className="capitalize">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="p-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date of birth
                </dt>
                <dd className="mt-1">
                  {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Gender
                </dt>
                <dd className="mt-1 capitalize">{student.gender ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Emergency contact
                </dt>
                <dd className="mt-1">
                  {student.emergencyContact?.name ?? '—'}
                  {student.emergencyContact?.phone && ` · ${student.emergencyContact.phone}`}
                </dd>
              </div>
            </dl>
            {student.medicalNotes && (
              <div className="mt-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Medical notes
                </div>
                <p className="mt-1 text-sm">{student.medicalNotes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="p-5 text-sm text-muted-foreground">
            Not built yet — this comes with the attendance feature.
          </TabsContent>
          <TabsContent value="progress" className="p-5 text-sm text-muted-foreground">
            Not built yet — this comes with the skill progression feature.
          </TabsContent>
          <TabsContent value="fees" className="p-5 text-sm text-muted-foreground">
            Not built yet — this comes with the fees feature.
          </TabsContent>
          <TabsContent value="notes" className="p-5 text-sm text-muted-foreground">
            Not built yet.
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
