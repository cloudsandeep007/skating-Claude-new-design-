import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Marks } from '../types'

export interface PendingSave {
  sessionId: string
  marks: Marks
  queuedAt: string
  attempts: number
  lastError: string | null
}

interface PendingSavesState {
  pending: Partial<Record<string, PendingSave>>
  enqueue: (sessionId: string, marks: Marks) => void
  markFailed: (sessionId: string, error: string) => void
  remove: (sessionId: string) => void
}

/** Attendance saves that haven't reached the server yet. Persisted to
 * localStorage so a coach who loses signal rink-side (or closes the tab)
 * doesn't lose the marks — the sync loop retries them. The latest marks
 * for a session replace any earlier queued ones. */
export const usePendingSaves = create<PendingSavesState>()(
  persist(
    (set) => ({
      pending: {},
      enqueue: (sessionId, marks) => {
        set((state) => ({
          pending: {
            ...state.pending,
            [sessionId]: {
              sessionId,
              marks,
              queuedAt: new Date().toISOString(),
              attempts: 0,
              lastError: null,
            },
          },
        }))
      },
      markFailed: (sessionId, error) => {
        set((state) => {
          const existing = state.pending[sessionId]
          if (!existing) return state
          return {
            pending: {
              ...state.pending,
              [sessionId]: { ...existing, attempts: existing.attempts + 1, lastError: error },
            },
          }
        })
      },
      remove: (sessionId) => {
        set((state) => ({
          pending: Object.fromEntries(
            Object.entries(state.pending).filter(([id]) => id !== sessionId),
          ),
        }))
      },
    }),
    { name: 'attendance-pending-saves' },
  ),
)
