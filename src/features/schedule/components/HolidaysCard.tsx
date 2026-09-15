import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { formatDate } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/shared/ui/form'
import { DatePicker } from '@/shared/ui/DatePicker'
import { Input } from '@/shared/ui/input'

import { useAddHoliday, useHolidays, useRemoveHoliday } from '../api/holidays'
import { HolidaySchema, type Holiday } from '../types'

export function HolidaysCard() {
  const { profile } = useAuth()
  const { data: holidays } = useHolidays()
  const addHoliday = useAddHoliday()
  const removeHoliday = useRemoveHoliday()

  const form = useForm<Holiday>({
    resolver: zodResolver(HolidaySchema),
    defaultValues: { date: '', name: '' },
  })

  async function onSubmit(values: Holiday) {
    if (!profile?.academy_id) return
    try {
      await addHoliday.mutateAsync({ academyId: profile.academy_id, ...values })
      form.reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the holiday.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Holidays</CardTitle>
        <CardDescription>
          Schedule generation skips these dates. Sessions already on the calendar aren't affected —
          cancel those individually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Form {...form}>
          <form
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event)
            }}
            className="flex flex-wrap items-start gap-2"
          >
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} className="w-[160px]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="min-w-[160px] flex-1">
                  <FormControl>
                    <Input placeholder="Diwali" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="outline" disabled={addHoliday.isPending}>
              Add
            </Button>
          </form>
        </Form>

        {holidays && holidays.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {holidays.map((holiday) => (
              <li key={holiday.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 font-mono text-muted-foreground">
                  {formatDate(holiday.date)}
                </span>
                <span className="flex-1 font-medium">{holiday.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Remove ${holiday.name}`}
                  onClick={() => {
                    removeHoliday.mutate(holiday.id)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
