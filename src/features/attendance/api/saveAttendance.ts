import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import { usePendingSaves } from '../hooks/pendingSaves'
import type { Marks } from '../types'

/** One request: upserts every mark and completes the session (save_attendance RPC). */
async function saveAttendance(sessionId: string, marks: Marks): Promise<void> {
  const payload = Object.entries(marks).flatMap(([student_id, status]) =>
    status ? [{ student_id, status }] : [],
  )
  const { error } = await supabase.rpc('save_attendance', {
    p_session_id: sessionId,
    p_marks: payload,
  })
  if (error) throw new Error(error.message)
}

function invalidateAttendance(queryClient: QueryClient, sessionId: string) {
  void queryClient.invalidateQueries({ queryKey: ['attendance'] })
  void queryClient.invalidateQueries({ queryKey: ['sessions'] })
  void queryClient.invalidateQueries({ queryKey: ['attendance', 'session', sessionId] })
}

let flushInFlight: Promise<void> | null = null

/** Tries every queued save once. Safe to call often — concurrent calls
 * share one in-flight pass, and each session is removed from the queue
 * only after the server confirms it. */
export function flushPendingSaves(queryClient: QueryClient): Promise<void> {
  if (flushInFlight) return flushInFlight

  flushInFlight = (async () => {
    const { pending, remove, markFailed } = usePendingSaves.getState()
    for (const save of Object.values(pending)) {
      if (!save) continue
      try {
        await saveAttendance(save.sessionId, save.marks)
        remove(save.sessionId)
        invalidateAttendance(queryClient, save.sessionId)
      } catch (error) {
        markFailed(save.sessionId, error instanceof Error ? error.message : 'Save failed')
      }
    }
  })().finally(() => {
    flushInFlight = null
  })

  return flushInFlight
}

/** Queue-then-flush: the UI treats the save as done immediately (the marks
 * are safe in localStorage); the network round-trip happens in the
 * background and retries until it succeeds. Returns true if the server
 * confirmed on the first try, false if it's still queued. */
export function useSubmitAttendance() {
  const queryClient = useQueryClient()
  const enqueue = usePendingSaves((s) => s.enqueue)

  return async (sessionId: string, marks: Marks): Promise<boolean> => {
    enqueue(sessionId, marks)
    await flushPendingSaves(queryClient)
    return !(sessionId in usePendingSaves.getState().pending)
  }
}

const RETRY_INTERVAL_MS = 20_000

/** Mount once (the coach layout does). Retries queued saves on mount, when
 * the browser comes back online, and every 20s while anything is queued. */
export function usePendingSavesSync() {
  const queryClient = useQueryClient()
  const hasPending = usePendingSaves((s) => Object.keys(s.pending).length > 0)

  useEffect(() => {
    if (!hasPending) return

    const flush = () => {
      void flushPendingSaves(queryClient)
    }
    flush()
    window.addEventListener('online', flush)
    const interval = setInterval(flush, RETRY_INTERVAL_MS)
    return () => {
      window.removeEventListener('online', flush)
      clearInterval(interval)
    }
  }, [hasPending, queryClient])
}
