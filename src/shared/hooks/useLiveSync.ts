import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabase } from '@/shared/lib/supabase'

/** Which cached queries a change in each table can make stale. Keys are
 * query-key prefixes (`['fees']` covers `['fees', 'list', …]`). Generous on
 * purpose: an extra refetch is cheap, a stale screen is a support call. */
export const TABLE_QUERY_KEYS: Record<string, string[][]> = {
  academies: [['academy'], ['bookings', 'plan-status']],
  profiles: [['students'], ['coaches'], ['parent-options'], ['parent']],
  coaches: [['coaches'], ['batches'], ['sessions'], ['reports']],
  students: [
    ['students'],
    ['student-options'],
    ['batches'],
    ['parent'],
    ['dashboard'],
    ['fees'],
    ['bookings'],
  ],
  parents_students: [['students'], ['parent']],
  student_batches: [
    ['students'],
    ['batches'],
    ['batch-options'],
    ['parent'],
    ['attendance'],
    ['dashboard'],
    ['bookings'],
  ],
  batches: [
    ['batches'],
    ['batch-options'],
    ['sessions'],
    ['students'],
    ['parent'],
    ['dashboard'],
    ['fees', 'plan-options'],
  ],
  schedule_sessions: [
    ['sessions'],
    ['parent', 'upcoming'],
    ['attendance'],
    ['bookings'],
    ['dashboard'],
  ],
  holidays: [['holidays'], ['sessions']],
  class_bookings: [
    ['bookings'],
    ['sessions'],
    ['parent', 'upcoming'],
    ['attendance', 'session'],
    ['students', 'detail'],
  ],
  attendance: [
    ['attendance'],
    ['bookings'],
    ['sessions'],
    ['parent'],
    ['students'],
    ['dashboard'],
    ['reports'],
    ['progression', 'session-roster'],
  ],
  makeup_credits: [['attendance', 'makeup-credits'], ['bookings'], ['parent']],
  fee_plans: [['fees'], ['students'], ['bookings', 'plan-status'], ['parent', 'fee']],
  student_fees: [['fees'], ['bookings'], ['parent'], ['dashboard'], ['reports'], ['students']],
  payments: [['fees'], ['dashboard'], ['reports'], ['students', 'activity'], ['parent', 'fee']],
  student_advances: [
    ['fees', 'advance'],
    ['fees', 'student'],
    ['parent', 'fee'],
  ],
  credit_ledger: [['bookings'], ['students', 'detail'], ['dashboard', 'renewals-due'], ['parent']],
  levels: [['progression'], ['level-options'], ['students']],
  skills: [['progression']],
  student_skills: [['progression'], ['students'], ['reports', 'progress'], ['parent']],
  announcements: [['announcements']],
}

/** Invalidate everything a table change can affect. Exported so a mutation
 * can use the same map instead of listing keys by hand. */
export function invalidateForTable(queryClient: QueryClient, table: string) {
  for (const key of TABLE_QUERY_KEYS[table] ?? []) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}

const COALESCE_MS = 250

/** Mount once per signed-in layout. One Realtime channel for the whole
 * academy: any insert/update/delete on a published table (0037) re-fetches
 * the queries that could show it, coalesced so a burst of rows (a whole
 * roster saved at once) triggers one refetch, not fifty. Tabs that were in
 * the background catch up on focus and on reconnect (QueryProvider). */
export function useLiveSync(enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    const pendingTables = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      timer = null
      for (const t of pendingTables) invalidateForTable(queryClient, t)
      pendingTables.clear()
    }

    const channel = supabase
      .channel('live-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        pendingTables.add(payload.table)
        timer ??= setTimeout(flush, COALESCE_MS)
      })
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [enabled, queryClient])
}
