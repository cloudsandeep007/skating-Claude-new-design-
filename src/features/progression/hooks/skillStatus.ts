import type { StatusTone } from '@/shared/ui/StatusBadge'

import type { SkillStatus, StudentSkillState } from '../types'

const LABEL: Record<SkillStatus, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  achieved: 'Achieved',
}

const TONE: Record<SkillStatus, StatusTone> = {
  not_started: 'outline',
  learning: 'warning',
  achieved: 'success',
}

export function skillStatusLabel(status: SkillStatus): string {
  return LABEL[status]
}

export function skillStatusTone(status: SkillStatus): StatusTone {
  return TONE[status]
}

/** All skills present and every one achieved — the promotion gate. Empty
 * (a level with no skills yet) is never "all achieved". */
export function allSkillsAchieved(skills: StudentSkillState[]): boolean {
  return skills.length > 0 && skills.every((s) => s.status === 'achieved')
}

export function countByStatus(skills: StudentSkillState[]): Record<SkillStatus, number> {
  const counts: Record<SkillStatus, number> = { not_started: 0, learning: 0, achieved: 0 }
  for (const s of skills) counts[s.status] += 1
  return counts
}
