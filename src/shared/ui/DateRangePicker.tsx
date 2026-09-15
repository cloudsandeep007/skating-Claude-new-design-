import { DatePicker } from '@/shared/ui/DatePicker'

/** A plain from/to date pair — used by the admin Reports page and anywhere
 * else that needs an explicit range rather than a preset window. */
export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker
        value={from}
        className="w-[160px] max-w-full"
        onChange={(next) => {
          onChange(next, to)
        }}
      />
      <span className="text-sm text-muted-foreground">to</span>
      <DatePicker
        value={to}
        className="w-[160px] max-w-full"
        onChange={(next) => {
          onChange(from, next)
        }}
      />
    </div>
  )
}
