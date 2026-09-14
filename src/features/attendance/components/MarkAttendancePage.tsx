import { ArrowLeft, Check, CloudOff, Lock, Sparkles, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { formatDate, formatTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'

import { useSessionForMarking } from '../api/getSessionForMarking'
import { useSubmitAttendance } from '../api/saveAttendance'
import { useStudentPhotoUrls } from '../api/studentPhotos'
import { useMarkingDraft } from '../hooks/useMarkingDraft'
import type { AttendanceStatus, RosterStudent } from '../types'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const ROW_STYLE: Record<
  AttendanceStatus | 'unmarked',
  { row: string; avatar: string; meta: string; label: string }
> = {
  unmarked: {
    row: 'bg-card',
    avatar: 'bg-neutral-200 text-neutral-800',
    meta: 'text-neutral-700',
    label: '',
  },
  present: {
    row: 'bg-success-50',
    avatar: 'bg-success-100 text-success-800',
    meta: 'text-success-700',
    label: 'Marked present',
  },
  absent: {
    row: 'bg-brand-50',
    avatar: 'bg-brand-200 text-brand-800',
    meta: 'text-brand-800',
    label: 'Marked absent',
  },
  late: {
    row: 'bg-warning-50',
    avatar: 'bg-warning-200 text-warning-900',
    meta: 'text-warning-800',
    label: 'Marked late',
  },
  excused: {
    row: 'bg-info-50',
    avatar: 'bg-info-100 text-info-800',
    meta: 'text-info-800',
    label: 'Excused',
  },
}

export function MarkAttendancePage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useSessionForMarking(sessionId)
  const submit = useSubmitAttendance()
  const roster = data?.roster ?? []
  const draft = useMarkingDraft(sessionId, data?.saved, roster)
  const { data: photoUrls } = useStudentPhotoUrls(roster.map((s) => s.photoUrl))

  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load this session"
        description="Check your connection and try again."
        action={
          <Button
            variant="outline"
            onClick={() => {
              void refetch()
            }}
          >
            Try again
          </Button>
        }
      />
    )
  }

  if (isLoading || !data) {
    return (
      <div className="-m-4 space-y-3">
        <Skeleton className="h-40 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mx-4 h-[72px] rounded-lg" />
        ))}
      </div>
    )
  }

  const { session } = data
  const locked = !session.editable || session.status === 'cancelled'
  const remaining = draft.total - draft.marked
  const progressPct = draft.total === 0 ? 0 : Math.round((draft.marked / draft.total) * 100)

  async function confirm() {
    if (locked) return
    const confirmed = await submit(session.id, draft.marks)
    if (confirmed) {
      toast.success('Attendance saved', {
        description: `${draft.counts.present} present · ${draft.counts.absent} absent${draft.counts.late ? ` · ${draft.counts.late} late` : ''}`,
      })
    } else {
      toast.warning('Saved on this device', {
        description: "Will sync as soon as you're back online.",
      })
    }
    void navigate('/coach')
  }

  return (
    // Escape the layout's padding so the ink header runs edge to edge.
    <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] flex-col pb-40">
      <header className="bg-neutral-950 px-4 pb-4 pt-3 text-white">
        <div className="-ml-2 mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              void navigate('/coach')
            }}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-neutral-300 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              void navigate(`/coach/skills/session/${session.id}`)
            }}
            className="mr-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-neutral-300 hover:bg-white/10"
          >
            <Sparkles className="h-4 w-4" />
            Assess skills
          </button>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {formatDate(session.sessionDate)} · {formatTime(session.startTime)}
          {session.venue && ` · ${session.venue}`}
        </div>
        <div className="mt-1 text-2xl font-extrabold tracking-tight">{session.batchName}</div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-[26px] font-extrabold leading-none">{draft.marked}</span>
          <span className="text-[15px] font-semibold text-neutral-400">
            of {draft.total} marked
          </span>
          <span className="ml-auto text-[13px] font-bold text-success-400">
            {draft.counts.present} present
          </span>
          <span className="text-[13px] font-bold text-brand-500">{draft.counts.absent} absent</span>
          {draft.counts.late > 0 && (
            <span className="text-[13px] font-bold text-warning-300">{draft.counts.late} late</span>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {locked && (
        <div className="flex items-start gap-2.5 border-b bg-muted px-4 py-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="font-bold">
              {session.status === 'cancelled'
                ? 'This session was cancelled'
                : 'Attendance is locked'}
            </div>
            <div className="text-muted-foreground">
              {session.status === 'cancelled'
                ? 'Nothing to mark.'
                : 'Marks can be changed for 24 hours after a session. Ask your admin for a correction.'}
            </div>
          </div>
        </div>
      )}

      {draft.pendingSave && (
        <div className="flex items-start gap-2.5 border-b border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">Saved on this device — waiting to sync</div>
            <div>
              {draft.pendingSave.lastError
                ? `Last attempt: ${draft.pendingSave.lastError}. Retrying automatically.`
                : 'Will reach the academy as soon as the connection is back.'}
            </div>
          </div>
        </div>
      )}

      {!locked && !draft.allMarked && (
        <div className="border-b bg-card px-4 py-3">
          <button
            type="button"
            onClick={draft.markAllPresent}
            className="h-12 w-full rounded-lg border-[1.5px] border-neutral-950 bg-card text-[15px] font-bold hover:bg-muted"
          >
            Mark all present{remaining < draft.total && ` (${remaining} left)`}
          </button>
          <div className="mt-1.5 text-center text-xs text-muted-foreground">
            Then tap anyone who wasn't — a row cycles present → absent → late.
          </div>
        </div>
      )}

      <ul className="flex-1 bg-card">
        {roster.map((student) => (
          <RosterRow
            key={student.id}
            student={student}
            status={draft.marks[student.id]}
            photoUrl={student.photoUrl ? photoUrls?.[student.photoUrl] : undefined}
            disabled={locked}
            onCycle={() => {
              draft.cycle(student.id)
            }}
            onPresent={() => {
              draft.set(student.id, 'present')
            }}
            onAbsent={() => {
              draft.set(student.id, 'absent')
            }}
            onSkills={() => {
              void navigate(`/coach/skills/${student.id}`)
            }}
          />
        ))}
      </ul>

      {!locked && (
        <div className="fixed inset-x-0 bottom-16 border-t-2 bg-card px-4 pb-4 pt-3 shadow-[0_-3px_10px_rgba(45,43,43,.08)]">
          <button
            type="button"
            onClick={() => {
              void confirm()
            }}
            disabled={draft.marked === 0}
            className={cn(
              'flex h-14 w-full items-center gap-2.5 rounded-lg px-4.5 text-[17px] font-bold text-white disabled:opacity-45',
              draft.allMarked
                ? 'bg-brand-600 hover:bg-brand-700'
                : 'bg-neutral-950 hover:bg-neutral-800',
            )}
          >
            <span>{draft.allMarked ? 'Confirm attendance' : 'Confirm anyway'}</span>
            <span className="ml-auto text-sm font-semibold opacity-75">
              {draft.marked}/{draft.total}
            </span>
          </button>
          <div className="mt-2 text-[13px] leading-snug text-muted-foreground">
            {draft.allMarked
              ? `All ${draft.total} marked. One tap and it's saved.`
              : `${remaining} unmarked will be left blank for you to finish later.`}
          </div>
        </div>
      )}
    </div>
  )
}

function RosterRow({
  student,
  status,
  photoUrl,
  disabled,
  onCycle,
  onPresent,
  onAbsent,
  onSkills,
}: {
  student: RosterStudent
  status: AttendanceStatus | undefined
  photoUrl: string | undefined
  disabled: boolean
  onCycle: () => void
  onPresent: () => void
  onAbsent: () => void
  onSkills: () => void
}) {
  const style = ROW_STYLE[status ?? 'unmarked']
  const isPresent = status === 'present'
  const isAbsent = status === 'absent'

  return (
    <li
      onClick={disabled ? undefined : onCycle}
      className={cn(
        'flex min-h-[72px] items-center gap-2.5 border-b px-3 py-2 transition-colors',
        style.row,
        !disabled && 'cursor-pointer',
      )}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            style.avatar,
          )}
        >
          {initials(student.fullName)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-bold leading-tight">{student.fullName}</div>
        <div className={cn('text-[13px]', style.meta)}>
          {style.label !== '' ? style.label : (student.levelName ?? 'Tap to mark')}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          aria-label={`${student.fullName} skills`}
          onClick={(event) => {
            event.stopPropagation()
            onSkills()
          }}
          className="flex h-14 w-9 items-center justify-center rounded-lg border-[1.5px] border-neutral-400 bg-card text-neutral-600"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`${student.fullName} present`}
          aria-pressed={isPresent}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation()
            onPresent()
          }}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-lg border-[1.5px] text-xl font-bold disabled:opacity-45',
            isPresent
              ? 'border-success-600 bg-success-600 text-white'
              : 'border-neutral-400 bg-card text-neutral-800',
          )}
        >
          <Check className="h-6 w-6" strokeWidth={3} />
        </button>
        <button
          type="button"
          aria-label={`${student.fullName} absent`}
          aria-pressed={isAbsent}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation()
            onAbsent()
          }}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-lg border-[1.5px] text-xl font-bold disabled:opacity-45',
            isAbsent
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-neutral-400 bg-card text-neutral-800',
          )}
        >
          <X className="h-6 w-6" strokeWidth={3} />
        </button>
      </div>
    </li>
  )
}
