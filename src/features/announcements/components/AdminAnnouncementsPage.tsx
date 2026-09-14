import { useState } from 'react'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge, type StatusTone } from '@/shared/ui/StatusBadge'

import { useAdminAnnouncements, useDeleteAnnouncement } from '../api/adminAnnouncements'
import { AUDIENCE_LABEL, type AnnouncementListItem, type AnnouncementState } from '../types'
import { AnnouncementForm } from './AnnouncementForm'

const STATE_TONE: Record<AnnouncementState, StatusTone> = {
  draft: 'neutral',
  scheduled: 'warning',
  live: 'success',
  expired: 'outline',
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function AdminAnnouncementsPage() {
  const [open, setOpen] = useState(false)
  const { data: items, isLoading, isError, error } = useAdminAnnouncements()
  const remove = useDeleteAnnouncement()

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Announcements</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>New announcement</DialogTitle>
            </DialogHeader>
            <AnnouncementForm
              onDone={() => {
                setOpen(false)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-6">
            <EmptyState
              title="Couldn't load announcements"
              description={error instanceof Error ? error.message : 'Please try again.'}
            />
          </div>
        ) : !items || items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              description="Anything you post here reaches parents and coaches in the app."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <Row
                key={item.id}
                item={item}
                onDelete={() => {
                  remove.mutate(item.id, {
                    onSuccess: () => {
                      toast.success('Announcement deleted.')
                    },
                    onError: () => {
                      toast.error('Could not delete it.')
                    },
                  })
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({ item, onDelete }: { item: AnnouncementListItem; onDelete: () => void }) {
  return (
    <li className="flex items-start gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{item.title}</span>
          <StatusBadge tone={STATE_TONE[item.state]}>{item.state}</StatusBadge>
          <StatusBadge tone="neutral">
            {item.audience === 'batch'
              ? (item.batchName ?? 'Batch')
              : AUDIENCE_LABEL[item.audience]}
          </StatusBadge>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
        <div className="mt-1.5 text-xs text-muted-foreground">
          {item.state === 'scheduled' && item.publishedAt && `Publishes ${when(item.publishedAt)}`}
          {item.state === 'live' && item.publishedAt && `Published ${when(item.publishedAt)}`}
          {item.state === 'expired' && item.expiresAt && `Expired ${when(item.expiresAt)}`}
          {item.state === 'draft' && 'Draft'}
          {item.expiresAt && item.state === 'live' && ` · expires ${when(item.expiresAt)}`}
          {item.notifiedAt && ' · recipients notified'}
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Delete announcement">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{item.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from every feed, and the notifications it created are removed too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}
