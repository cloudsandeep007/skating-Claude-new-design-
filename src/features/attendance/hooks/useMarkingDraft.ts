import { useEffect, useState } from 'react'

import { usePendingSaves } from './pendingSaves'
import { COACH_CYCLE, type AttendanceStatus, type Marks, type RosterStudent } from '../types'

/** Local draft of marks for one session. Starts from whatever is queued
 * locally (a save that hasn't synced yet wins over the server), else from
 * what the server has. All the tap logic lives here, not in the screen. */
export function useMarkingDraft(
  sessionId: string,
  saved: Marks | undefined,
  roster: RosterStudent[],
) {
  const pending = usePendingSaves((s) => s.pending[sessionId])
  const [marks, setMarks] = useState<Marks>({})
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (seeded || saved === undefined) return
    setMarks(pending ? { ...pending.marks } : { ...saved })
    setSeeded(true)
  }, [seeded, saved, pending])

  const set = (studentId: string, status: AttendanceStatus) => {
    setMarks((m) => ({ ...m, [studentId]: status }))
  }

  /** Row tap: unmarked → present → absent → late → present … */
  const cycle = (studentId: string) => {
    setMarks((m) => {
      const current = m[studentId]
      const index = current ? COACH_CYCLE.indexOf(current) : -1
      const next = COACH_CYCLE[(index + 1) % COACH_CYCLE.length]
      return { ...m, [studentId]: next }
    })
  }

  /** The default fast path: everyone expected is present, then fix the
   * exceptions. A credit-plan skater who didn't book isn't expected —
   * marking them present would spend a credit for a class they may not
   * have come to, so they're left for the coach to mark deliberately. */
  const markAllPresent = () => {
    setMarks((m) => {
      const next = { ...m }
      for (const student of roster) {
        if (student.onCreditPlan && !student.booked) continue
        next[student.id] ??= 'present'
      }
      return next
    })
  }

  const counts = { present: 0, absent: 0, late: 0 }
  for (const student of roster) {
    const status = marks[student.id]
    if (status === 'present' || status === 'absent' || status === 'late') counts[status] += 1
  }
  const marked = counts.present + counts.absent + counts.late
  const total = roster.length

  return {
    marks,
    set,
    cycle,
    markAllPresent,
    counts,
    marked,
    total,
    allMarked: total > 0 && marked === total,
    pendingSave: pending,
  }
}
