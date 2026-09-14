import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import { publishDue } from './adminAnnouncements'
import type { FeedItem } from '../types'

interface Row {
  id: string
  title: string
  body: string
  audience: FeedItem['audience']
  published_at: string
  batch: { name: string } | null
}

/** Announcements the reader may see (RLS decides), newest first, joined
 * with their own notification row for read/unread. */
export function useAnnouncementFeed(profileId: string | undefined) {
  return useQuery({
    queryKey: ['announcements', 'feed', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<FeedItem[]> => {
      await publishDue()
      const [postsResult, notesResult] = await Promise.all([
        supabase
          .from('announcements')
          .select('id, title, body, audience, published_at, batch:batches(name)')
          .order('published_at', { ascending: false })
          .overrideTypes<Row[], { merge: false }>(),
        supabase
          .from('notifications')
          .select('id, announcement_id, read_at')
          .eq('profile_id', profileId ?? '')
          .not('announcement_id', 'is', null),
      ])
      if (postsResult.error) throw postsResult.error

      // Read state is a nicety; if it can't load (e.g. 0005 not applied yet)
      // the posts still show, just without unread dots.
      const byAnnouncement = new Map(
        (notesResult.data ?? []).map((n) => [n.announcement_id, { id: n.id, readAt: n.read_at }]),
      )
      return postsResult.data.map((p) => {
        const note = byAnnouncement.get(p.id)
        return {
          id: p.id,
          title: p.title,
          body: p.body,
          audience: p.audience,
          batchName: p.batch?.name ?? null,
          publishedAt: p.published_at,
          notificationId: note?.id ?? null,
          readAt: note?.readAt ?? null,
        }
      })
    },
  })
}

/** Marks a notification read. Optimistic on both the feed and the badge. */
export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .is('read_at', null)
      if (error) throw error
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['announcements', 'feed'] })
      const now = new Date().toISOString()
      queryClient.setQueriesData<FeedItem[]>({ queryKey: ['announcements', 'feed'] }, (items) =>
        items?.map((i) => (i.notificationId === notificationId ? { ...i, readAt: now } : i)),
      )
      queryClient.setQueriesData<number>({ queryKey: ['notifications', 'unread'] }, (count) =>
        count === undefined ? count : Math.max(0, count - 1),
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] })
    },
  })
}
