import { ArrowLeft, Check, Circle, PlayCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Textarea } from '@/shared/ui/textarea'

import { useLevelsWithSkills } from '../api/levels'
import { useSessionRosterForSkills } from '../api/sessionRoster'
import { useAssessSkill, useSkillStatusMap } from '../api/studentProgress'
import { skillStatusLabel } from '../hooks/skillStatus'
import type { SkillStatus } from '../types'

const STATUS_ICON: Record<SkillStatus, typeof Circle> = {
  not_started: Circle,
  learning: PlayCircle,
  achieved: Check,
}

/** Coach entry point "from a session" — mark one skill across the whole
 * batch (or as many as apply) in one go, e.g. right after a group drill. */
export function BulkAssessPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: roster, isLoading: loadingRoster } = useSessionRosterForSkills(sessionId)
  const { data: levels, isLoading: loadingLevels } = useLevelsWithSkills()
  const assess = useAssessSkill()

  const [levelId, setLevelId] = useState('')
  const [skillId, setSkillId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')

  const levelsPresent = useMemo(() => {
    if (!roster || !levels) return []
    const idsPresent = new Set(
      roster.students.map((s) => s.levelId).filter((id): id is string => !!id),
    )
    return levels.filter((l) => idsPresent.has(l.id))
  }, [roster, levels])

  useEffect(() => {
    if (!levelId && levelsPresent.length > 0) setLevelId(levelsPresent[0].id)
  }, [levelId, levelsPresent])

  const chosenLevel = levels?.find((l) => l.id === levelId) ?? null

  useEffect(() => {
    setSkillId('')
    setSelected(new Set())
  }, [levelId])

  const studentsInLevel = roster?.students.filter((s) => s.levelId === levelId) ?? []
  const { data: statusMap } = useSkillStatusMap(
    skillId || null,
    studentsInLevel.map((s) => s.id),
  )

  function toggle(studentId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === studentsInLevel.length
        ? new Set()
        : new Set(studentsInLevel.map((s) => s.id)),
    )
  }

  async function apply(status: SkillStatus) {
    if (!profile?.academy_id || selected.size === 0) return
    try {
      await assess.mutateAsync({
        academyId: profile.academy_id,
        studentIds: [...selected],
        skillId,
        status,
        notes: notes || null,
      })
      toast.success(
        `${selected.size} skater${selected.size === 1 ? '' : 's'} marked ${skillStatusLabel(status).toLowerCase()}.`,
      )
      setSelected(new Set())
      setNotes('')
    } catch {
      toast.error('Could not save that.')
    }
  }

  if (loadingRoster || loadingLevels) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (levelsPresent.length === 0) {
    return (
      <EmptyState
        title="No skaters to assess"
        description="Nobody in this batch has a level set yet."
      />
    )
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => {
            void navigate(-1)
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight">Bulk assess</h1>
          <p className="text-xs text-muted-foreground">{roster?.batchName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Select value={levelId} onValueChange={setLevelId}>
          <SelectTrigger>
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            {levelsPresent.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={skillId} onValueChange={setSkillId} disabled={!chosenLevel}>
          <SelectTrigger>
            <SelectValue placeholder="Skill" />
          </SelectTrigger>
          <SelectContent>
            {chosenLevel?.skills.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {skillId && (
        <>
          <div className="flex items-center gap-2.5 rounded-lg border bg-muted px-3.5 py-2.5">
            <Checkbox
              checked={selected.size > 0 && selected.size === studentsInLevel.length}
              onCheckedChange={toggleAll}
            />
            <span className="text-sm font-semibold">
              {selected.size === 0 ? 'Select skaters' : `${selected.size} selected`}
            </span>
          </div>

          <ul className="space-y-1.5">
            {studentsInLevel.map((student) => {
              const current = statusMap?.[student.id] ?? 'not_started'
              const Icon = STATUS_ICON[current]
              return (
                <li
                  key={student.id}
                  onClick={() => {
                    toggle(student.id)
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg border bg-card p-3',
                    selected.has(student.id) && 'border-primary bg-primary/10',
                  )}
                >
                  <Checkbox
                    checked={selected.has(student.id)}
                    onCheckedChange={() => {
                      toggle(student.id)
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {student.fullName}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs font-semibold',
                      current === 'achieved' && 'text-success-400',
                      current === 'learning' && 'text-warning-300',
                      current === 'not_started' && 'text-muted-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {skillStatusLabel(current)}
                  </span>
                </li>
              )
            })}
          </ul>

          <Textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value)
            }}
            placeholder="Optional note for everyone selected — replaces each skater's note for this skill"
            rows={2}
          />

          <div className="fixed inset-x-0 bottom-16 border-t-2 bg-card px-4 pb-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={selected.size === 0 || assess.isPending}
                onClick={() => {
                  void apply('learning')
                }}
              >
                Learning
              </Button>
              <Button
                variant="brand"
                className="flex-1"
                disabled={selected.size === 0 || assess.isPending}
                onClick={() => {
                  void apply('achieved')
                }}
              >
                Achieved
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
