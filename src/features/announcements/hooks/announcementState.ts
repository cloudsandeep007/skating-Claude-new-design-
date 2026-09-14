import type { AnnouncementState } from '../types'

/** draft = no publish date · scheduled = publish date in the future ·
 * expired = past expiry · live = everything else. */
export function announcementState(
  publishedAt: string | null,
  expiresAt: string | null,
  now: Date = new Date(),
): AnnouncementState {
  if (!publishedAt) return 'draft'
  if (new Date(publishedAt) > now) return 'scheduled'
  if (expiresAt && new Date(expiresAt) <= now) return 'expired'
  return 'live'
}

/** <input type="datetime-local"> gives "YYYY-MM-DDTHH:MM" in local time;
 * turn it into an ISO instant for the database. */
export function localDateTimeToIso(local: string): string {
  return new Date(local).toISOString()
}
