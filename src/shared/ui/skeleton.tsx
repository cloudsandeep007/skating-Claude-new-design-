import { cn } from '@/shared/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded bg-[linear-gradient(90deg,#eae7e7_0%,#f8f4f4_40%,#eae7e7_80%)] bg-[length:320px_100%]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
