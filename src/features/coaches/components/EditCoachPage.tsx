import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'

import { useCoach } from '../api/getCoach'
import { useUpdateCoach } from '../api/updateCoach'
import { CoachEditSchema, type CoachEdit } from '../types'

export function EditCoachPage() {
  const { coachId = '' } = useParams<{ coachId: string }>()
  const navigate = useNavigate()
  const { data: coach, isLoading } = useCoach(coachId)
  const updateCoach = useUpdateCoach()

  const form = useForm<CoachEdit>({
    resolver: zodResolver(CoachEditSchema),
    defaultValues: { fullName: '', phone: '', specialization: '' },
  })

  useEffect(() => {
    if (coach) {
      form.reset({
        fullName: coach.fullName,
        phone: coach.phone ?? '',
        specialization: coach.specialization ?? '',
      })
    }
  }, [coach, form])

  async function onSubmit(values: CoachEdit) {
    if (!coach) return
    try {
      await updateCoach.mutateAsync({ coachId: coach.id, profileId: coach.profileId, form: values })
      toast.success('Coach updated.')
      void navigate(`/admin/coaches/${coach.id}`)
    } catch {
      toast.error('Could not save these changes.')
    }
  }

  if (isLoading || !coach) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Edit coach</h1>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form
              onSubmit={(event) => {
                void form.handleSubmit(onSubmit)(event)
              }}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coach's name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialization (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" asChild>
                  <Link to={`/admin/coaches/${coach.id}`}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={updateCoach.isPending}>
                  {updateCoach.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
