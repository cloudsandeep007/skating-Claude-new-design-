import type { StatusTone } from '@/shared/ui/StatusBadge'

export function isFull(enrolled: number, capacity: number): boolean {
  return enrolled >= capacity
}

/** Green with room, amber at the last two seats, red when full or over. */
export function capacityTone(enrolled: number, capacity: number): StatusTone {
  if (isFull(enrolled, capacity)) return 'danger'
  if (capacity - enrolled <= 2) return 'warning'
  return 'success'
}
