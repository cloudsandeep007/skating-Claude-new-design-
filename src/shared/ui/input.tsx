import * as React from 'react'

import { cn } from '@/shared/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full rounded-lg px-3.5 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground border-[1.5px] border-neutral-400 bg-card ring-offset-background placeholder:text-neutral-500 hover:border-neutral-950 focus-visible:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-[invalid=true]:border-brand-600 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:hover:border-neutral-300',
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
