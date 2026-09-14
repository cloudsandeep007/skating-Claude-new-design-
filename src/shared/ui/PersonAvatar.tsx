import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** An Avatar that shows a real photo when one's resolved, falling back to
 * initials otherwise (no photo, still loading, or the signed URL fetch
 * failed) — Radix's AvatarImage already swaps to AvatarFallback on any
 * load error, so this never needs its own loading state. */
export function PersonAvatar({
  name,
  photoUrl,
  className,
  fallbackClassName,
}: {
  name: string
  photoUrl?: string | null
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar className={className}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" className="object-cover" />}
      <AvatarFallback className={fallbackClassName}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
