import { supabase } from '@/shared/lib/supabase'

const BUCKET = 'student-photos'

/** Uploads to the private student-photos bucket and returns the storage path
 * (not a public URL — the bucket is private, see 0002_storage.sql). Store
 * this path in students.photo_url; resolve it to a viewable URL with
 * getStudentPhotoUrl() at display time. */
export async function uploadStudentPhoto(
  academyId: string,
  studentId: string,
  file: File,
): Promise<string> {
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${academyId}/${studentId}/photo.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error

  return path
}

export async function getStudentPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}
