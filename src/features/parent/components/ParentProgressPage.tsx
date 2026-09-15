import { Award, Lock, Sparkles } from 'lucide-react'

import {
  AchievementHistoryList,
  ladderPct,
  useLevelsWithSkills,
  useStudentProgress,
} from '@/features/progression'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useCurrentChild } from '../hooks/useSelectedChild'
import { ChildSelector } from './ChildSelector'

const SKILL_TILE: Record<string, string> = {
  not_started: 'border-border bg-card text-muted-foreground',
  learning: 'border-warning-500 bg-warning-500/10 text-warning-300',
  achieved: 'border-success-500 bg-success-500/10 text-success-300',
}

const SKILL_TILE_ICON_BG: Record<string, string> = {
  not_started: 'bg-muted',
  learning: 'bg-warning-500/20',
  achieved: 'bg-success-500/20',
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Up next',
  learning: 'Learning',
  achieved: 'Achieved',
}

/** Rewarding, not a checklist — a ladder position bar, skill tiles with
 * color and icon (not a table), a peek at the next level, and the
 * achievement history. */
export function ParentProgressPage() {
  const { child, isLoading: loadingChild } = useCurrentChild()
  const { data: progress, isLoading } = useStudentProgress(child?.id ?? null)
  const { data: levels } = useLevelsWithSkills()

  if (loadingChild) return <Skeleton className="h-48 w-full rounded-lg" />
  if (!child) {
    return (
      <EmptyState
        title="No skater linked to your account"
        description="Ask the academy to link your child to this login."
      />
    )
  }

  if (isLoading || !progress) {
    return (
      <div className="space-y-4">
        <ChildSelector subtitle="Progress" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }

  if (!progress.currentLevelId) {
    return (
      <div className="space-y-4">
        <ChildSelector subtitle="Progress" />
        <EmptyState
          title="No level yet"
          description="The academy hasn't placed your skater on a starting level yet."
        />
      </div>
    )
  }

  const nextLevel =
    levels?.find((l) => l.sequence === (progress.currentLevelSequence ?? 0) + 1) ?? null
  const pct = ladderPct(progress.currentLevelSequence ?? 1, progress.totalLevels)

  return (
    <div className="space-y-5">
      <ChildSelector subtitle="Progress" />

      <div className="rounded-lg border border-primary/20 bg-card p-4 text-foreground shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>
            Level {progress.currentLevelSequence} of {progress.totalLevels}
          </span>
          {progress.isTopLevel && <span className="text-success-400">Top level!</span>}
        </div>
        <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          {progress.currentLevelName}
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <section>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Skills in {progress.currentLevelName}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {progress.skills.map((skill) => (
            <div
              key={skill.skillId}
              className={cn('rounded-lg border-[1.5px] p-3', SKILL_TILE[skill.status])}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  SKILL_TILE_ICON_BG[skill.status],
                )}
              >
                {skill.status === 'achieved' ? (
                  <Award className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4 opacity-60" />
                )}
              </div>
              <div className="mt-2 text-sm font-bold leading-tight">{skill.skillName}</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-75">
                {STATUS_LABEL[skill.status]}
              </div>
            </div>
          ))}
        </div>
      </section>

      {nextLevel && (
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Coming up: {nextLevel.name}
          </div>
          <div className="rounded-lg border border-dashed bg-muted/40 p-3.5">
            <div className="flex flex-wrap gap-1.5">
              {nextLevel.skills.map((s) => (
                <StatusBadge key={s.id} tone="outline">
                  {s.name}
                </StatusBadge>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          History
        </div>
        <AchievementHistoryList studentId={child.id} />
      </section>
    </div>
  )
}
