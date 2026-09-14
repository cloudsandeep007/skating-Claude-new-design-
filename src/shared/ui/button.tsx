import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[15px] font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-neutral-950 text-white hover:bg-neutral-800 active:bg-neutral-900',
        brand: 'bg-brand-600 text-white hover:bg-brand-700',
        destructive:
          'border-[1.5px] border-brand-300 bg-card text-brand-700 hover:border-brand-400 hover:bg-brand-100 hover:text-brand-800',
        outline:
          'border-[1.5px] border-neutral-400 bg-card text-foreground hover:border-neutral-600 hover:bg-neutral-100',
        secondary: 'bg-neutral-200 text-neutral-950 hover:bg-neutral-300',
        ghost: 'text-foreground hover:bg-neutral-200',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-9 px-3 text-[13px]',
        lg: 'h-14 px-5 text-[17px]',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
