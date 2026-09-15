import { Check, Circle, PenLine, PlayCircle, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { cn } from '@/shared/lib/utils'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Textarea } from '@/shared/ui/textarea'

import { useAssessSkill, usePromoteStudent, useStudentProgress } from '../api/studentProgress'
import { countByStatus, skillStatusLabel } from '../hooks/skillStatus'
import type { SkillStatus, StudentSkillState } from '../types'

const STATUS_CHIP: Record<SkillStatus, { icon: typeof Circle; className: string }> = {
  not_started: { icon: Circle, className: 'border-border text-muted-foreground' },
  learning: {
    icon: PlayCircle,
    className: 'border-warning-500 bg-warning-500/15 text-warning-300',
  },
  achieved: { icon: Check, className: 'border-success-600 bg-success-600 text-white' },
}

interface SkillAssessmentPanelProps {
  studentId: string
  academyId: string
  /** Called after a successful promotion — e.g. to navigate back. */
  onPromoted?: (nextLevelName: string) => void
}

/** The core two-tap assessment UI: current level's skills, each with three
 * status chips and an optional note. Reused by the coach's per-student page
 * and the admin "Progress" tab on a skater's profile — RLS decides who can
 * actually write. */
export function SkillAssessmentPanel({
  studentId,
  academyId,
  onPromoted,
}: SkillAssessmentPanelProps) {
  const { data: progress, isLoading, isError, refetch } = useStudentProgress(studentId)
  const assess = useAssessSkill()
  const promote = usePromoteStudent()
  const [noteSkill, setNoteSkill] = useState<StudentSkillState | null>(null)

  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load this skater's progress"
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

  if (isLoading || !progress) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!progress.currentLevelId) {
    return (
      <EmptyState
        title="No level assigned"
        description="Set this skater's starting level from their profile before assessing skills."
      />
    )
  }

  const counts = countByStatus(progress.skills)

  function setStatus(skill: StudentSkillState, status: SkillStatus, notes?: string | null) {
    assess.mutate(
      {
        academyId,
        studentIds: [studentId],
        skillId: skill.skillId,
        status,
        notes: notes === undefined ? skill.notes : notes,
      },
      {
        onError: () => {
          toast.error('Could not save that.')
        },
      },
    )
  }

  async function promoteStudent() {
    try {
      const result = await promote.mutateAsync(studentId)
      toast.success(`${progress?.fullName} promoted to ${result.levelName}!`)
      onPromoted?.(result.levelName)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not promote this skater.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge tone="dark">{progress.currentLevelName}</StatusBadge>
          <span className="text-sm font-semibold text-muted-foreground">
            {counts.achieved} of {progress.skills.length} skills achieved
          </span>
          {progress.isTopLevel && (
            <span className="ml-auto text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Highest level
            </span>
          )}
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success-600 transition-[width]"
            style={{
              width: `${progress.skills.length === 0 ? 0 : (counts.achieved / progress.skills.length) * 100}%`,
            }}
          />
        </div>

        {!progress.isTopLevel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="mt-3.5 w-full" variant="brand" disabled={!progress.allAchieved}>
                <Sparkles className="h-4 w-4" />
                {progress.allAchieved
                  ? `Promote to ${progress.nextLevelName}`
                  : 'Achieve every skill to promote'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Promote {progress.fullName} to {progress.nextLevelName}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Every skill in {progress.currentLevelName} is marked achieved. This moves them to{' '}
                  {progress.nextLevelName} — their history on {progress.currentLevelName} stays on
                  record.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not yet</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void promoteStudent()
                  }}
                >
                  Promote
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <ul className="space-y-1.5">
        {progress.skills.map((skill) => (
          <li
            key={skill.skillId}
            className="flex items-center gap-2.5 rounded-lg border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{skill.skillName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {skill.notes ?? skillStatusLabel(skill.status)}
              </div>
            </div>
            <button
              type="button"
              aria-label={`Add a note for ${skill.skillName}`}
              onClick={() => {
                setNoteSkill(skill)
              }}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[1.5px]',
                skill.notes
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              <PenLine className="h-3.5 w-3.5" />
            </button>
            <div className="flex shrink-0 gap-1.5">
              {(['not_started', 'learning', 'achieved'] as const).map((status) => {
                const chip = STATUS_CHIP[status]
                const Icon = chip.icon
                const active = skill.status === status
                return (
                  <button
                    key={status}
                    type="button"
                    aria-label={`${skill.skillName}: ${skillStatusLabel(status)}`}
                    aria-pressed={active}
                    onClick={() => {
                      setStatus(skill, status)
                    }}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg border-[1.5px]',
                      active
                        ? chip.className
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>

      <NoteDialog
        skill={noteSkill}
        pending={assess.isPending}
        onClose={() => {
          setNoteSkill(null)
        }}
        onSave={(notes) => {
          if (noteSkill) setStatus(noteSkill, noteSkill.status, notes.trim() || null)
          setNoteSkill(null)
        }}
      />
    </div>
  )
}

function NoteDialog({
  skill,
  pending,
  onClose,
  onSave,
}: {
  skill: StudentSkillState | null
  pending: boolean
  onClose: () => void
  onSave: (notes: string) => void
}) {
  const [value, setValue] = useState('')

  return (
    <Dialog
      open={skill !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          setValue(skill?.notes ?? '')
        }}
      >
        <DialogHeader>
          <DialogTitle>Note — {skill?.skillName}</DialogTitle>
          <DialogDescription>Visible to the academy and this skater's parent.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
          placeholder="e.g. Needs more confidence on the left foot"
        />
        <DialogFooter>
          <Button
            onClick={() => {
              onSave(value)
            }}
            disabled={pending}
          >
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
