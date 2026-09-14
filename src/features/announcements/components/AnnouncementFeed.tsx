import { Megaphone } from 'lucide-react'

import { useAuth } from '@/features/auth'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useAnnouncementFeed, useMarkRead } from '../api/feed'
import { AUDIENCE_LABEL, type FeedItem } from '../types'

function when(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** The reader's feed (parent or coach — RLS decides what's in it). Tapping
 * an unread post marks it read. Mobile-first: full-width cards, no table. */
export function AnnouncementFeed({ limit }: { limit?: number }) {
  const { profile } = useAuth()
  const { data: items, isLoading, isError } = useAnnouncementFeed(profile?.id)
  const markRead = useMarkRead()

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load announcements"
        description="Check your connection and try again."
      />
    )
  }

  const visible = limit ? items?.slice(0, limit) : items

  if (!visible || visible.length === 0) {
    return <EmptyState icon={Megaphone} title="No announcements yet" />
  }

  return (
    <ul className="space-y-3">
      {visible.map((item) => (
        <FeedCard
          key={item.id}
          item={item}
          onOpen={() => {
            if (item.notificationId && !item.readAt) markRead.mutate(item.notificationId)
          }}
        />
      ))}
    </ul>
  )
}

function FeedCard({ item, onOpen }: { item: FeedItem; onOpen: () => void }) {
  const unread = item.notificationId !== null && item.readAt === null
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'w-full rounded-lg border bg-card p-4 text-left shadow-sm transition-colors',
          unread && 'border-neutral-600 shadow-md',
        )}
      >
        <div className="flex items-start gap-3">
          {unread && (
            <span
              className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600"
              aria-label="Unread"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn('text-base leading-tight', unread ? 'font-extrabold' : 'font-bold')}
              >
                {item.title}
              </span>
              <StatusBadge tone="neutral">
                {item.audience === 'batch'
                  ? (item.batchName ?? 'Batch')
                  : AUDIENCE_LABEL[item.audience]}
              </StatusBadge>
            </div>
            <p className="mt-1.5 whitespace-pre-line text-sm text-foreground/90">{item.body}</p>
            <div className="mt-2 text-xs text-muted-foreground">{when(item.publishedAt)}</div>
          </div>
        </div>
      </button>
    </li>
  )
}
