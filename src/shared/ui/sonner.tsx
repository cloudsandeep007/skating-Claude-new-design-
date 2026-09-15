import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="bottom-center"
      visibleToasts={1}
      offset={88}
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-white/10 group-[.toaster]:bg-popover group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
          title: 'group-[.toast]:text-[15px] group-[.toast]:font-bold',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-transparent group-[.toast]:font-bold group-[.toast]:text-muted-foreground',
          cancelButton: 'group-[.toast]:bg-transparent group-[.toast]:text-muted-foreground/70',
          success: 'group-[.toast]:[&>svg]:text-success-400',
          error: 'group-[.toast]:[&>svg]:text-brand-500',
          warning: 'group-[.toast]:[&>svg]:text-warning-300',
          info: 'group-[.toast]:[&>svg]:text-info-300',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
