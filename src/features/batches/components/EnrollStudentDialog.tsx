import { useState } from 'react'
import { AlertTriangle, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { useEnrollStudent, useEnrollableStudents } from '../api/enrollment'
import { isFull } from '../hooks/capacity'

interface EnrollStudentDialogProps {
  batchId: string
  enrolledCount: number
  capacity: number
}

export function EnrollStudentDialog({
  batchId,
  enrolledCount,
  capacity,
}: EnrollStudentDialogProps) {
  const [open, setOpen] = useState(false)
  const [studentId, setStudentId] = useState('')
  const { profile } = useAuth()
  const { data: students } = useEnrollableStudents(batchId)
  const enroll = useEnrollStudent(batchId)
  const full = isFull(enrolledCount, capacity)

  async function submit() {
    if (!profile?.academy_id || !studentId) return
    try {
      await enroll.mutateAsync({ academyId: profile.academy_id, batchId, studentId })
      toast.success('Skater enrolled.')
      setStudentId('')
      setOpen(false)
    } catch {
      toast.error('Could not enroll this skater.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="h-4 w-4" />
          Enroll skater
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll a skater</DialogTitle>
          <DialogDescription>
            {enrolledCount} of {capacity} places taken.
          </DialogDescription>
        </DialogHeader>

        {full && (
          <div className="flex gap-2.5 rounded-lg border border-warning-700 bg-warning-500/10 p-3 text-sm text-warning-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-bold">This batch is full.</div>
              You can still enroll, but the rink will be over the {capacity}-skater capacity.
              Consider raising the capacity or opening another batch.
            </div>
          </div>
        )}

        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a skater" />
          </SelectTrigger>
          <SelectContent>
            {students?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.fullName}
                {s.levelName ? ` · ${s.levelName}` : ''}
              </SelectItem>
            ))}
            {students?.length === 0 && (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                Every active skater is already in this batch.
              </div>
            )}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button
            onClick={() => {
              void submit()
            }}
            disabled={!studentId || enroll.isPending}
            variant={full ? 'destructive' : 'default'}
          >
            {enroll.isPending ? 'Enrolling…' : full ? 'Enroll anyway' : 'Enroll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
