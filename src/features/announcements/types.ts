import { z } from 'zod'

import type { Enums, Tables } from '@/shared/types'

export type Announcement = Tables<'announcements'>
export type Audience = Enums<'announcement_audience'>
export type Notification = Tables<'notifications'>

export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'Everyone',
  parents: 'Parents',
  coaches: 'Coaches',
  batch: 'One batch',
}

export type AnnouncementState = 'draft' | 'scheduled' | 'live' | 'expired'

export interface AnnouncementListItem {
  id: string
  title: string
  body: string
  audience: Audience
  batchId: string | null
  batchName: string | null
  publishedAt: string | null
  expiresAt: string | null
  notifiedAt: string | null
  createdAt: string
  state: AnnouncementState
}

/** An announcement as a reader sees it, with their own read state. */
export interface FeedItem {
  id: string
  title: string
  body: string
  audience: Audience
  batchName: string | null
  publishedAt: string
  /** The reader's notification row for this post, if they were a recipient. */
  notificationId: string | null
  readAt: string | null
}

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  announcementId: string | null
  readAt: string | null
  createdAt: string
}

export const AnnouncementFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Give it a title')
      .max(120, 'Keep the title under 120 characters'),
    body: z.string().trim().min(1, 'Write the announcement'),
    audience: z.enum(['all', 'parents', 'coaches', 'batch']),
    batchId: z.string().optional(),
    publishMode: z.enum(['now', 'later']),
    /** Local datetime from <input type="datetime-local">; required for 'later'. */
    publishAt: z.string().optional(),
    expiresAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audience === 'batch' && !data.batchId) {
      ctx.addIssue({ code: 'custom', path: ['batchId'], message: 'Choose the batch' })
    }
    if (data.publishMode === 'later' && !data.publishAt) {
      ctx.addIssue({ code: 'custom', path: ['publishAt'], message: 'Choose when to publish' })
    }
    if (data.expiresAt && data.publishAt && data.expiresAt <= data.publishAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Expiry must be after publishing',
      })
    }
  })
export type AnnouncementForm = z.infer<typeof AnnouncementFormSchema>
