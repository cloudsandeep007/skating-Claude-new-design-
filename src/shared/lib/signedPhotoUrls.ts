import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

/** Resolves private-bucket photo paths to signed URLs in one request. Any
 * failure (bucket missing, no photo) just yields no URL — callers fall back
 * to initials, this never blocks rendering. */
export function useSignedPhotoUrls(bucket: string, paths: (string | null)[]) {
  const wanted = [...new Set(paths.filter((p): p is string => p !== null))].sort()

  return useQuery({
    queryKey: ['signed-photo-urls', bucket, wanted],
    enabled: wanted.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(wanted, 60 * 60)
      if (error) return {}
      const urls: Record<string, string> = {}
      for (const item of data) {
        if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
      }
      return urls
    },
  })
}
