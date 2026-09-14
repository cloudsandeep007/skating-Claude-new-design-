import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { RosterStudentForSkills } from '../types'

export interface RosterForSkills {
  batchName: string
  students: RosterStudentForSkills[]
}

interface SessionRow {
  batch_id: string
  batch: { name: string }
}

interface RosterRow {
  student: {
    id: string
    full_name: string
    photo_url: string | null
    current_level_id: string | null
    current_level: { name: string } | null
  }
}

/** The session's batch roster with each student's current level — the
 * "from a session" entry point for bulk skill assessment. */
export function useSessionRosterForSkills(sessionId: string) {
  return useQuery({
    queryKey: ['progression', 'session-roster', sessionId],
    queryFn: async (): Promise<RosterForSkills> => {
      const { data: session, error } = await supabase
        .from('schedule_sessions')
        .select('batch_id, batch:batches(name)')
        .eq('id', sessionId)
        .single()
        .overrideTypes<SessionRow, { merge: false }>()
      if (error) throw error

      const { data: roster, error: rosterError } = await supabase
        .from('student_batches')
        .select(
          'student:students(id, full_name, photo_url, current_level_id, current_level:levels(name))',
        )
        .eq('batch_id', session.batch_id)
        .eq('status', 'active')
        .overrideTypes<RosterRow[], { merge: false }>()
      if (rosterError) throw rosterError

      return {
        batchName: session.batch.name,
        students: roster
          .map((r) => ({
            id: r.student.id,
            fullName: r.student.full_name,
            photoUrl: r.student.photo_url,
            levelId: r.student.current_level_id,
            levelName: r.student.current_level?.name ?? null,
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      }
    },
  })
}
