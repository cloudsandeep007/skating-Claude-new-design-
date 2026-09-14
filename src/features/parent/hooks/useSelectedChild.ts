import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { useAuth } from '@/features/auth'

import { useMyChildren, type ChildOption } from '../api/myChildren'

interface SelectedChildState {
  childId: string | null
  setChildId: (id: string) => void
}

/** Which child the parent is looking at — remembered across screens and
 * reloads so a parent with two skaters isn't asked on every page. */
const useSelectedChildStore = create<SelectedChildState>()(
  persist(
    (set) => ({
      childId: null,
      setChildId: (id) => {
        set({ childId: id })
      },
    }),
    { name: 'parent-selected-child' },
  ),
)

export interface CurrentChild {
  children: ChildOption[]
  child: ChildOption | null
  setChildId: (id: string) => void
  isLoading: boolean
}

/** The parent's children plus the selected one (defaults to the first, and
 * self-heals if the remembered id no longer belongs to this login). */
export function useCurrentChild(): CurrentChild {
  const { profile } = useAuth()
  const { data: children, isLoading } = useMyChildren(profile?.id)
  const childId = useSelectedChildStore((s) => s.childId)
  const setChildId = useSelectedChildStore((s) => s.setChildId)

  useEffect(() => {
    if (!children || children.length === 0) return
    if (!children.some((c) => c.id === childId)) setChildId(children[0].id)
  }, [children, childId, setChildId])

  const child = children?.find((c) => c.id === childId) ?? children?.[0] ?? null

  return { children: children ?? [], child, setChildId, isLoading }
}
