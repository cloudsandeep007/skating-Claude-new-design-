import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
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
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useLevelsWithSkills } from '../api/levels'
import {
  useCreateLevel,
  useDeleteLevel,
  useReorderLevels,
  useUpdateLevel,
} from '../api/manageLevels'
import {
  useCreateSkill,
  useDeleteSkill,
  useReorderSkills,
  useUpdateSkill,
} from '../api/manageSkills'
import type { LevelForm, LevelWithSkills, SkillRow } from '../types'
import { NameDescriptionDialog } from './NameDescriptionDialog'

export function LevelsManagePage() {
  const { profile } = useAuth()
  const { data: levels, isLoading, isError, refetch } = useLevelsWithSkills()
  const [order, setOrder] = useState<LevelWithSkills[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (levels) setOrder(levels)
  }, [levels])

  const createLevel = useCreateLevel()
  const updateLevel = useUpdateLevel()
  const deleteLevel = useDeleteLevel()
  const reorderLevels = useReorderLevels()
  const createSkill = useCreateSkill()
  const updateSkill = useUpdateSkill()
  const deleteSkill = useDeleteSkill()
  const reorderSkills = useReorderSkills()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load levels"
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  function handleLevelDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((current) => {
      const oldIndex = current.findIndex((l) => l.id === active.id)
      const newIndex = current.findIndex((l) => l.id === over.id)
      const next = arrayMove(current, oldIndex, newIndex)
      reorderLevels.mutate(next.map((l) => l.id))
      return next
    })
  }

  function handleSkillDragEnd(levelId: string, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((current) =>
      current.map((level) => {
        if (level.id !== levelId) return level
        const oldIndex = level.skills.findIndex((s) => s.id === active.id)
        const newIndex = level.skills.findIndex((s) => s.id === over.id)
        const nextSkills = arrayMove(level.skills, oldIndex, newIndex)
        reorderSkills.mutate({ levelId, orderedIds: nextSkills.map((s) => s.id) })
        return { ...level, skills: nextSkills }
      }),
    )
  }

  async function submitCreateLevel(values: LevelForm) {
    if (!profile?.academy_id) return
    try {
      await createLevel.mutateAsync({
        academyId: profile.academy_id,
        name: values.name,
        description: values.description,
        sequence: order.length + 1,
      })
      toast.success('Level added.')
    } catch {
      toast.error('Could not add the level.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/admin/progression">← Progress</Link>
          </Button>
          <h1 className="text-2xl font-extrabold tracking-tight">Levels & skills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The progression ladder every skater climbs. Drag to reorder.
          </p>
        </div>
        <NameDescriptionDialog
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              Add level
            </Button>
          }
          title="Add a level"
          description="A new rung on the ladder, added at the end."
          namePlaceholder="Beginner 4"
          submitLabel="Add level"
          pending={createLevel.isPending}
          onSubmit={submitCreateLevel}
        />
      </div>

      {order.length === 0 ? (
        <EmptyState
          title="No levels yet"
          description="Add the first level to start building the progression ladder."
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleLevelDragEnd}
        >
          <SortableContext items={order.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {order.map((level, index) => (
                <LevelCard
                  key={level.id}
                  level={level}
                  index={index}
                  expanded={expandedId === level.id}
                  onToggle={() => {
                    setExpandedId(expandedId === level.id ? null : level.id)
                  }}
                  onEdit={async (values) => {
                    try {
                      await updateLevel.mutateAsync({ id: level.id, ...values })
                      toast.success('Level updated.')
                    } catch {
                      toast.error('Could not update the level.')
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await deleteLevel.mutateAsync(level.id)
                      toast.success(`${level.name} removed.`)
                    } catch {
                      toast.error('Could not remove this level.')
                    }
                  }}
                  onSkillDragEnd={(event) => {
                    handleSkillDragEnd(level.id, event)
                  }}
                  onAddSkill={async (values) => {
                    if (!profile?.academy_id) return
                    try {
                      await createSkill.mutateAsync({
                        academyId: profile.academy_id,
                        levelId: level.id,
                        name: values.name,
                        description: values.description,
                        sequence: level.skills.length + 1,
                      })
                      toast.success('Skill added.')
                    } catch {
                      toast.error('Could not add the skill.')
                    }
                  }}
                  addSkillPending={createSkill.isPending}
                  onEditSkill={async (skillId, values) => {
                    try {
                      await updateSkill.mutateAsync({ id: skillId, ...values })
                      toast.success('Skill updated.')
                    } catch {
                      toast.error('Could not update the skill.')
                    }
                  }}
                  onDeleteSkill={async (skillId, skillName) => {
                    try {
                      await deleteSkill.mutateAsync(skillId)
                      toast.success(`${skillName} removed.`)
                    } catch {
                      toast.error('Could not remove this skill.')
                    }
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function LevelCard({
  level,
  index,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onSkillDragEnd,
  onAddSkill,
  addSkillPending,
  onEditSkill,
  onDeleteSkill,
}: {
  level: LevelWithSkills
  index: number
  expanded: boolean
  onToggle: () => void
  onEdit: (values: LevelForm) => Promise<void>
  onDelete: () => Promise<void>
  onSkillDragEnd: (event: DragEndEvent) => void
  onAddSkill: (values: LevelForm) => Promise<void>
  addSkillPending: boolean
  onEditSkill: (skillId: string, values: LevelForm) => Promise<void>
  onDeleteSkill: (skillId: string, skillName: string) => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: level.id,
  })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border bg-card shadow-sm ${isDragging ? 'z-10 opacity-90' : ''}`}
    >
      <div className="flex items-center gap-2.5 p-3.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${level.name}`}
          className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{level.name}</span>
            {level.description && (
              <span className="block truncate text-xs text-muted-foreground">
                {level.description}
              </span>
            )}
          </span>
          <StatusBadge tone="neutral">
            {level.skills.length} skill{level.skills.length === 1 ? '' : 's'}
          </StatusBadge>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        <NameDescriptionDialog
          trigger={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${level.name}`}
              className="h-9 w-9"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          }
          title="Edit level"
          description="Change the name or description."
          namePlaceholder="Beginner 1"
          defaultValues={{ name: level.name, description: level.description ?? '' }}
          submitLabel="Save"
          pending={false}
          onSubmit={onEdit}
        />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${level.name}`}
              className="h-9 w-9 text-brand-700 hover:text-brand-800"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {level.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes its {level.skills.length} skill{level.skills.length === 1 ? '' : 's'}{' '}
                and every skater's recorded progress on them. Skaters currently on this level fall
                back to no level — nothing else about them changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep level</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  void onDelete()
                }}
              >
                Remove level
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {expanded && (
        <div className="border-t bg-muted/40 p-3.5 pl-[52px]">
          {level.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills in this level yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onSkillDragEnd}
            >
              <SortableContext
                items={level.skills.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-1.5">
                  {level.skills.map((skill) => (
                    <SkillRowItem
                      key={skill.id}
                      skill={skill}
                      onEdit={(values) => onEditSkill(skill.id, values)}
                      onDelete={() => onDeleteSkill(skill.id, skill.name)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          <div className="mt-3">
            <NameDescriptionDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Add skill
                </Button>
              }
              title={`Add a skill to ${level.name}`}
              description="Added at the end of this level's list."
              namePlaceholder="Forward crossovers"
              submitLabel="Add skill"
              pending={addSkillPending}
              onSubmit={onAddSkill}
            />
          </div>
        </div>
      )}
    </li>
  )
}

function SkillRowItem({
  skill,
  onEdit,
  onDelete,
}: {
  skill: SkillRow
  onEdit: (values: LevelForm) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: skill.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md bg-card p-2 shadow-sm ${isDragging ? 'z-10 opacity-90' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${skill.name}`}
        className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{skill.name}</div>
        {skill.description && (
          <div className="truncate text-xs text-muted-foreground">{skill.description}</div>
        )}
      </div>
      <NameDescriptionDialog
        trigger={
          <Button variant="ghost" size="icon" aria-label={`Edit ${skill.name}`} className="h-8 w-8">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        }
        title="Edit skill"
        description="Change the name or description."
        namePlaceholder="Forward crossovers"
        defaultValues={{ name: skill.name, description: skill.description ?? '' }}
        submitLabel="Save"
        pending={false}
        onSubmit={onEdit}
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${skill.name}`}
            className="h-8 w-8 text-brand-700 hover:text-brand-800"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {skill.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Every skater's recorded progress on this skill is removed too. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep skill</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void onDelete()
              }}
            >
              Remove skill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}
