import { Award } from 'lucide-react'

import { useAchievementHistory } from '../api/achievementHistory'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "What was achieved, when, and by which coach" — used on the coach page,
 * the admin Progress tab, and the parent Progress screen alike. */
export function AchievementHistoryList({ studentId }: { studentId: string }) {
  const { data: history, isLoading } = useAchievementHistory(studentId)

  if (isLoading) return null
  if (!history || history.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-3.5 text-sm text-muted-foreground">
        Nothing achieved yet — it'll show up here as skills are checked off.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {history.map((event) => (
        <li key={event.skillId} className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-500/15 text-success-400">
            <Award className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{event.skillName}</div>
            <div className="text-xs text-muted-foreground">
              {event.levelName} · {formatWhen(event.achievedAt)}
              {event.coachName && ` · Coach ${event.coachName}`}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
