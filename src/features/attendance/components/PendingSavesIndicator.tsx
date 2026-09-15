import { CloudOff } from 'lucide-react'

import { usePendingSavesSync } from '../api/saveAttendance'
import { usePendingSaves } from '../hooks/pendingSaves'

/** Mounted once in the coach layout's header. Runs the background retry
 * loop and shows a pill while any attendance save is still queued. */
export function PendingSavesIndicator() {
  usePendingSavesSync()
  const count = usePendingSaves((s) => Object.keys(s.pending).length)

  if (count === 0) return null

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-warning-500/15 px-2.5 py-1 text-xs font-bold text-warning-300"
      title="Attendance saved on this device, waiting for a connection"
    >
      <CloudOff className="h-3.5 w-3.5" />
      {count} to sync
    </span>
  )
}
