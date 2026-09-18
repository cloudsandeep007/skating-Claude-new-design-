import type { ActivityEntry } from '../api/studentActivity'

const ENTITY: Record<string, string> = {
  students: 'Skater record',
  student_fees: 'Fee',
  payments: 'Payment',
  class_bookings: 'Booking',
  makeup_credits: 'Make-up credit',
  attendance: 'Attendance',
}

const FIELD: Record<string, string> = {
  status: 'status',
  amount: 'amount',
  credits_granted: 'classes',
  waived_reason: 'waive reason',
  voided_at: 'voided',
  void_reason: 'void reason',
  fee_plan_id: 'fee plan',
  period_start: 'period start',
  period_end: 'period end',
  due_date: 'due date',
  paid_date: 'paid on',
  method: 'method',
  reference: 'reference',
  receipt_no: 'receipt',
  cancelled_at: 'cancelled',
  source: 'source',
  full_name: 'name',
  current_level_id: 'level',
  notes: 'notes',
}

const IGNORE = new Set(['updated_at', 'created_at', 'marked_at', 'marked_by', 'recorded_by', 'voided_by', 'id', 'academy_id', 'student_id', 'session_id', 'student_fee_id', 'idempotency_key', 'last_reminded_at', 'booked_at'])

function show(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10)
    return v
  }
  return JSON.stringify(v)
}

/** One plain-language line per audit row: what kind of thing, what
 * happened, and — for an update — which fields changed and how. */
export function describeActivity(e: ActivityEntry): { headline: string; details: string[] } {
  const what = ENTITY[e.entityType] ?? e.entityType
  const changes = e.changes ?? {}

  if (e.action === 'insert') {
    const row = (changes.new ?? {}) as Record<string, unknown>
    const bits: string[] = []
    if (e.entityType === 'payments') {
      bits.push(`₹${show(row.amount)}${row.method ? ` · ${show(row.method)}` : ''}${row.receipt_no ? ` · ${show(row.receipt_no)}` : ''}`)
    } else if (e.entityType === 'student_fees') {
      bits.push(`${show(row.kind ?? 'period')} · ₹${show(row.amount)} · ${show(row.period_start)} – ${show(row.period_end)}${row.credits_granted != null ? ` · ${show(row.credits_granted)} classes` : ''}`)
    } else if (e.entityType === 'class_bookings') {
      bits.push(`${show(row.status)}${row.source === 'attendance' ? ' (walk-in)' : ''}`)
    } else if (e.entityType === 'attendance') {
      bits.push(`marked ${show(row.status)}`)
    }
    return { headline: `${what} added`, details: bits }
  }

  if (e.action === 'delete') {
    return { headline: `${what} deleted`, details: [] }
  }

  const details = Object.entries(changes)
    .filter(([k]) => !IGNORE.has(k))
    .map(([k, v]) => {
      const pair = v as { old?: unknown; new?: unknown }
      const label = FIELD[k] ?? k.replace(/_/g, ' ')
      if (k === 'voided_at' && pair.new) return 'voided'
      if (k === 'cancelled_at') return pair.new ? 'cancelled' : 're-booked'
      return `${label}: ${show(pair.old)} → ${show(pair.new)}`
    })
  return { headline: `${what} changed`, details }
}
