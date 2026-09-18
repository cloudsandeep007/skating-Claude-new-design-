import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { useBatchOptions } from '@/features/batches'
import { feePlanPriceLabel, useFeePlanOptions } from '@/features/fees'
import { describeError } from '@/shared/lib/describeError'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { DatePicker } from '@/shared/ui/DatePicker'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

import { useCreateStudent } from '../api/createStudent'
import { useLevelOptions, useParentOptions } from '../api/listOptions'
import { StudentFormSchema, type StudentForm } from '../types'

export function AddStudentPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const createStudent = useCreateStudent()
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  // A second tap before the first request has even started must not
  // create a second skater — isPending flips too late for that.
  const submitting = useRef(false)

  const { data: batches } = useBatchOptions()
  const { data: levels } = useLevelOptions()
  const { data: feePlans } = useFeePlanOptions()
  const { data: parents } = useParentOptions()

  const form = useForm<StudentForm>({
    resolver: zodResolver(StudentFormSchema),
    defaultValues: {
      fullName: '',
      dateOfBirth: '',
      batchId: '',
      currentLevelId: '',
      feePlanId: '',
      emergencyContact: { name: '', phone: '', relationship: '' },
      medicalNotes: '',
      parent: { mode: 'new', fullName: '', email: '', phone: '', relationship: 'guardian' },
    },
  })

  const parentMode = form.watch('parent.mode')
  const selectedBatchId = form.watch('batchId')
  const sortedFeePlans = [...(feePlans ?? [])].sort((a, b) => {
    const aMatches = a.batchId === selectedBatchId
    const bMatches = b.batchId === selectedBatchId
    if (aMatches !== bMatches) return aMatches ? -1 : 1
    return 0
  })

  async function onSubmit(values: StudentForm) {
    if (!profile?.academy_id || submitting.current) return
    submitting.current = true
    try {
      const studentId = await createStudent.mutateAsync({
        academyId: profile.academy_id,
        form: values,
        photoFile,
      })
      toast.success(`${values.fullName} was added.`)
      void navigate(`/admin/students/${studentId}`)
    } catch (error) {
      toast.error(describeError(error, 'Could not add this student. Please try again.'))
    } finally {
      submitting.current = false
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-extrabold tracking-tight">Add student</h1>

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
                      <FormLabel>Starting level (optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Beginner 1" />
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
                    <FormLabel>Fee plan (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No fee plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedFeePlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} — {feePlanPriceLabel(plan)}
                            {plan.batchId && plan.batchId !== selectedBatchId
                              ? ' (other batch)'
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        <Input placeholder="Mother, father, guardian…" {...field} />
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="parent.mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to</FormLabel>
                    <Select
                      onValueChange={(value: 'existing' | 'new') => {
                        // Change the mode through the field so the watcher
                        // below re-renders, then clear the other mode's inputs.
                        field.onChange(value)
                        form.setValue('parent.parentProfileId', '')
                        form.setValue('parent.fullName', '')
                        form.setValue('parent.email', '')
                        form.setValue('parent.phone', '')
                        form.clearErrors('parent')
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">New parent (send invite)</SelectItem>
                        <SelectItem value="existing">Existing parent</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {parentMode === 'existing' ? (
                <FormField
                  control={form.control}
                  name="parent.parentProfileId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a parent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parents?.map((parent) => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.fullName} {parent.email ? `· ${parent.email}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="parent.fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent's name</FormLabel>
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
                      name="parent.email"
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
                      name="parent.phone"
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
                  </div>
                </>
              )}

              <FormField
                control={form.control}
                name="parent.relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship to skater</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="father">Father</SelectItem>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="guardian">Guardian</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild>
              <Link to="/admin/students">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createStudent.isPending}>
              {createStudent.isPending ? 'Adding…' : 'Add student'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
