import { Construction } from 'lucide-react'

import { EmptyState } from '@/shared/ui/EmptyState'

/** Stand-in for a role's landing page until its real dashboard is built. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <EmptyState
      icon={Construction}
      title={title}
      description="This screen hasn't been built yet."
    />
  )
}
