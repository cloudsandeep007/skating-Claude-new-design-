import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { useOverrideAttendance } from '../api/adminQueries'
import { attendanceLabel } from '../hooks/attendanceTone'
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '../types'

interface OverrideSelectProps {
  sessionId: string
  studentId: string
  studentName: string
  value: AttendanceStatus | null
}

/** Admin-only status dropdown. Every change is an upsert the audit trigger
 * records with the admin as actor — no separate "reason" step, to keep
 * corrections quick; the audit log is the paper trail. */
export function OverrideSelect({ sessionId, studentId, studentName, value }: OverrideSelectProps) {
  const { profile } = useAuth()
  const override = useOverrideAttendance()

  return (
    <Select
      value={value ?? ''}
      disabled={override.isPending}
      onValueChange={(next) => {
        if (!profile?.academy_id) return
        override.mutate(
          {
            academyId: profile.academy_id,
            sessionId,
            studentId,
            status: next as AttendanceStatus,
            notes: 'Set by admin',
          },
          {
            onSuccess: () => {
              toast.success(
                `${studentName}: ${attendanceLabel(next as AttendanceStatus).toLowerCase()}`,
              )
            },
            onError: () => {
              toast.error('Could not save that change.')
            },
          },
        )
      }}
    >
      <SelectTrigger className="h-9 w-[130px]" aria-label={`${studentName} attendance`}>
        <SelectValue placeholder="Unmarked" />
      </SelectTrigger>
      <SelectContent>
        {ATTENDANCE_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {attendanceLabel(status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
