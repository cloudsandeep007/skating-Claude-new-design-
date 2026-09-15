import * as React from 'react'

import { cn } from '@/shared/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full rounded-lg px-3.5 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground border-[1.5px] border-border bg-card ring-offset-background placeholder:text-muted-foreground hover:border-primary/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-[invalid=true]:border-brand-600 disabled:cursor-not-allowed disabled:border-border/50 disabled:bg-muted/50 disabled:text-muted-foreground disabled:hover:border-border/50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
