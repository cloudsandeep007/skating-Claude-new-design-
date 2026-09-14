import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

import { announcementState, localDateTimeToIso } from '../hooks/announcementState'
import type { AnnouncementForm, AnnouncementListItem } from '../types'

interface Row {
  id: string
  title: string
  body: string
  audience: AnnouncementListItem['audience']
  batch_id: string | null
  published_at: string | null
  expires_at: string | null
  notified_at: string | null
  created_at: string
  batch: { name: string } | null
}

/** Fans out any due announcements (idempotent). Called after publishing and
 * on every feed load, so scheduled posts go out without a cron job. */
export async function publishDue(): Promise<void> {
  await supabase.rpc('publish_due_announcements')
}

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ['announcements', 'admin'],
    queryFn: async (): Promise<AnnouncementListItem[]> => {
      await publishDue()
      const { data, error } = await supabase
        .from('announcements')
        .select(
          'id, title, body, audience, batch_id, published_at, expires_at, notified_at, created_at, batch:batches(name)',
        )
        .order('created_at', { ascending: false })
        .overrideTypes<Row[], { merge: false }>()
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        audience: r.audience,
        batchId: r.batch_id,
        batchName: r.batch?.name ?? null,
        publishedAt: r.published_at,
        expiresAt: r.expires_at,
        notifiedAt: r.notified_at,
        createdAt: r.created_at,
        state: announcementState(r.published_at, r.expires_at),
      }))
    },
  })
}

interface CreateInput {
  academyId: string
  createdBy: string
  form: AnnouncementForm
}

async function createAnnouncement({ academyId, createdBy, form }: CreateInput) {
  const publishedAt =
    form.publishMode === 'now'
      ? new Date().toISOString()
      : form.publishAt
        ? localDateTimeToIso(form.publishAt)
        : null

  const { error } = await supabase.from('announcements').insert({
    academy_id: academyId,
    created_by: createdBy,
    title: form.title,
    body: form.body,
    audience: form.audience,
    batch_id: form.audience === 'batch' ? emptyToNull(form.batchId) : null,
    published_at: publishedAt,
    expires_at: form.expiresAt ? localDateTimeToIso(form.expiresAt) : null,
  })
  if (error) throw error

  await publishDue()
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
