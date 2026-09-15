import { AnnouncementFeed } from '@/features/announcements'

export function ParentAnnouncementsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Announcements</h1>
      <AnnouncementFeed />
    </div>
  )
}
