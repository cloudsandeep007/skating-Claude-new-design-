import { useState } from 'react'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

interface MonthPickerProps {
  /** "YYYY-MM" or "YYYY-MM-DD" (only the year/month are read; DD is ignored). */
  value: string
  /** Always fires with "YYYY-MM-01". */
  onChange: (value: string) => void
  className?: string
}

/** A compact month+year picker — replaces the native `<input type="month">`,
 * whose picker UI is inconsistent across browsers and wasn't opening
 * reliably for some users. */
export function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [year, month] = value.split('-').map(Number)
  const selectedYear = year || new Date().getFullYear()
  const selectedMonth = (month || 1) - 1
  const [viewYear, setViewYear] = useState(selectedYear)

  const label = value
    ? `${MONTH_SHORT[selectedMonth]} ${selectedYear}`
    : 'Pick a month'

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setViewYear(selectedYear)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-11 justify-start gap-2 border-[1.5px] font-normal', className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous year"
            onClick={() => {
              setViewYear((y) => y - 1)
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-bold">{viewYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Next year"
            onClick={() => {
              setViewYear((y) => y + 1)
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_SHORT.map((m, i) => {
            const isSelected = viewYear === selectedYear && i === selectedMonth
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onChange(`${viewYear}-${String(i + 1).padStart(2, '0')}-01`)
                  setOpen(false)
                }}
                className={cn(
                  'rounded-md py-1.5 text-sm font-semibold transition-colors hover:bg-accent',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
