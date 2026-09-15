import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { useCreateCoach } from '../api/createCoach'
import { CoachFormSchema, type CoachForm } from '../types'

export function AddCoachPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const createCoach = useCreateCoach()
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const form = useForm<CoachForm>({
    resolver: zodResolver(CoachFormSchema),
    defaultValues: { fullName: '', email: '', phone: '', specialization: '' },
  })

  async function onSubmit(values: CoachForm) {
    if (!profile?.academy_id) return
    try {
      await createCoach.mutateAsync({ academyId: profile.academy_id, form: values, photoFile })
      toast.success(`Invite sent to ${values.email}.`)
      void navigate('/admin/coaches')
    } catch {
      toast.error('Could not add this coach. Please try again.')
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 font-display text-2xl font-extrabold tracking-tight">Add coach</h1>
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
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
                      <Input placeholder="Figure skating, speed skating…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>Photo (optional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    setPhotoFile(event.target.files?.[0] ?? null)
                  }}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                An invite email will be sent so they can set their own password.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" asChild>
                  <Link to="/admin/coaches">Cancel</Link>
                </Button>
                <Button type="submit" disabled={createCoach.isPending}>
                  {createCoach.isPending ? 'Sending invite…' : 'Add coach'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
