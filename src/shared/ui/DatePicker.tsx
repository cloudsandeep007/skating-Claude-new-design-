import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'

import { toIsoDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Calendar } from '@/shared/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

function parseIso(value: string): Date | undefined {
  if (!value) return undefined
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function displayLabel(value: string): string {
  const d = parseIso(value)
  if (!d) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Widens the calendar's year dropdown for birthdate-style pickers that
   * need to jump back decades quickly instead of clicking prev/next months. */
  withYearDropdown?: boolean
}

/** A button that opens a calendar popover — replaces the native
 * `<input type="date">`, whose picker UI is inconsistent across browsers
 * and wasn't opening reliably for some users. Value/onChange are plain
 * "YYYY-MM-DD" strings, same as the native input, so it's a drop-in swap. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  disabled,
  withYearDropdown = false,
}: DatePickerProps) {
  const selected = parseIso(value)
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-11 justify-start gap-2 border-[1.5px] font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {value ? displayLabel(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          captionLayout={withYearDropdown ? 'dropdown' : 'label'}
          startMonth={withYearDropdown ? new Date(1950, 0) : undefined}
          endMonth={withYearDropdown ? new Date() : undefined}
          onSelect={(date) => {
            if (date) {
              onChange(toIsoDate(date))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
