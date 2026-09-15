import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { useBatchOptions } from '@/features/batches'
import { useFeePlanOptions } from '@/features/fees'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { DatePicker } from '@/shared/ui/DatePicker'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Textarea } from '@/shared/ui/textarea'

import { useStudentForEdit } from '../api/getStudentForEdit'
import { useLevelOptions } from '../api/listOptions'
import { useUpdateStudent } from '../api/updateStudent'
import { StudentEditSchema, type StudentEdit } from '../types'

export function EditStudentPage() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: existing, isLoading } = useStudentForEdit(studentId)
  const updateStudent = useUpdateStudent()
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const { data: batches } = useBatchOptions()
  const { data: levels } = useLevelOptions()
  const { data: feePlans } = useFeePlanOptions()

  const form = useForm<StudentEdit>({
    resolver: zodResolver(StudentEditSchema),
    defaultValues: {
      fullName: '',
      dateOfBirth: '',
      batchId: '',
      currentLevelId: '',
      feePlanId: '',
      emergencyContact: { name: '', phone: '', relationship: '' },
      medicalNotes: '',
    },
  })

  useEffect(() => {
    if (existing) form.reset(existing)
  }, [existing, form])

  const selectedBatchId = form.watch('batchId')
  const sortedFeePlans = [...(feePlans ?? [])].sort((a, b) => {
    const aMatches = a.batchId === selectedBatchId
    const bMatches = b.batchId === selectedBatchId
    if (aMatches !== bMatches) return aMatches ? -1 : 1
    return 0
  })

  async function onSubmit(values: StudentEdit) {
    if (!profile?.academy_id || !studentId) return
    try {
      await updateStudent.mutateAsync({
        academyId: profile.academy_id,
        studentId,
        form: values,
        photoFile,
      })
      toast.success('Student updated.')
      void navigate(`/admin/students/${studentId}`)
    } catch {
      toast.error('Could not save these changes. Please try again.')
    }
  }

  if (isLoading || !existing) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-extrabold tracking-tight">Edit student</h1>

      <Form {...form}>
        <form
          onSubmit={(event) => {
            void form.handleSubmit(onSubmit)(event)
          }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skater details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skater name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of birth</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          withYearDropdown
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="batchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a batch" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {batches?.map((batch) => (
                            <SelectItem key={batch.id} value={batch.id}>
                              {batch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentLevelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {levels?.map((level) => (
                            <SelectItem key={level.id} value={level.id}>
                              {level.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="feePlanId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee plan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No fee plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedFeePlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} — ₹{plan.amount.toLocaleString('en-IN')}
                            {plan.batchId && plan.batchId !== selectedBatchId ? ' (other batch)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Photo {existing.photoUrl ? '(replace)' : '(optional)'}</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    setPhotoFile(event.target.files?.[0] ?? null)
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emergency contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="emergencyContact.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContact.phone"
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
                  name="emergencyContact.relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="medicalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild>
              <Link to={`/admin/students/${studentId}`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={updateStudent.isPending}>
              {updateStudent.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
