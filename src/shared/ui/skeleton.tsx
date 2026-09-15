import { cn } from '@/shared/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded bg-[linear-gradient(90deg,hsl(var(--muted))_0%,hsl(var(--accent))_40%,hsl(var(--muted))_80%)] bg-[length:320px_100%]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
