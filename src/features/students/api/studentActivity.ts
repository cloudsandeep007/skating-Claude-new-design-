import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export interface ActivityEntry {
  id: string
  createdAt: string
  actorName: string | null
  action: string
  entityType: string
  entityId: string | null
  /** Insert: {new: row}. Update: {col: {old, new}}. Delete: {old: row}. */
  changes: Record<string, unknown> | null
}

/** student_activity() RPC — everything the audit log holds about this
 * skater: their record, fees, payments, bookings, make-ups and attendance,
 * newest first, with who did it. */
export function useStudentActivity(studentId: string | null, limit = 100) {
  return useQuery({
    queryKey: ['students', 'activity', studentId, limit],
    enabled: studentId !== null,
    queryFn: async (): Promise<ActivityEntry[]> => {
      if (!studentId) return []
      const { data, error } = await supabase.rpc('student_activity', {
        p_student_id: studentId,
        p_limit: limit,
      })
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        actorName: r.actor_name,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        changes: (r.changes as Record<string, unknown> | null) ?? null,
      }))
    },
  })
}
