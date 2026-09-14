import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

/** Resolves private-bucket photo paths to signed URLs in one request.
 * Any failure (bucket missing, no photo) just yields no URL — the UI
 * falls back to initials, it never blocks the roster. */
export function useStudentPhotoUrls(paths: (string | null)[]) {
  const wanted = [...new Set(paths.filter((p): p is string => p !== null))].sort()

  return useQuery({
    queryKey: ['student-photos', wanted],
    enabled: wanted.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from('student-photos')
        .createSignedUrls(wanted, 60 * 60)
      if (error) return {}
      const urls: Record<string, string> = {}
      for (const item of data) {
        if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
      }
      return urls
    },
  })
}
