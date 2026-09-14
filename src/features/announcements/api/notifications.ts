import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { supabase } from '@/shared/lib/supabase'

import type { NotificationItem } from '../types'

/** Unread count across every notification type — announcements, cancelled
 * sessions, and whatever comes later. Drives the nav badge. */
export function useUnreadCount(profileId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', 'unread', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId ?? '')
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useNotifications(profileId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', 'list', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<NotificationItem[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, link, announcement_id, read_at, created_at')
        .eq('profile_id', profileId ?? '')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        announcementId: n.announcement_id,
        readAt: n.read_at,
        createdAt: n.created_at,
      }))
    },
  })
}

/** Subscribes to new notification rows for this profile. On each one:
 * refresh the badge and feeds, and show a toast so the person notices
 * without leaving the screen they're on. Mount once per signed-in layout. */
export function useNotificationsRealtime(profileId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!profileId) return

    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          const row = payload.new as { title?: string; body?: string | null }
          void queryClient.invalidateQueries({ queryKey: ['notifications'] })
          void queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] })
          if (row.title) toast(row.title, { description: row.body ?? undefined })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profileId, queryClient])
}
