import { supabase } from '@/shared/lib/supabase'

const BUCKET = 'coach-photos'

/** Uploads to the private coach-photos bucket and returns the storage path
 * (not a public URL — the bucket is private, see 0009_photos_and_needs_attention.sql).
 * Store this path in coaches.photo_url; resolve it to a viewable URL with
 * useSignedPhotoUrls('coach-photos', ...) at display time. */
export async function uploadCoachPhoto(
  academyId: string,
  coachId: string,
  file: File,
): Promise<string> {
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${academyId}/${coachId}/photo.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error

  return path
}
