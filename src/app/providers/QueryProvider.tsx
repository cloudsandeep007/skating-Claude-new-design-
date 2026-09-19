import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            // Coming back to a tab or regaining signal re-fetches whatever
            // went stale — the safety net under the Realtime live sync
            // (useLiveSync), which handles changes while the tab is open.
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            // Default 'online' mode pauses a query (status stays 'pending',
            // no error) whenever the browser thinks it's offline — which
            // every screen would render as an empty list. On rink wifi we'd
            // rather the request try and fail so the page shows a real
            // "couldn't load / try again" state. Offline *writes* are handled
            // explicitly where they matter (the attendance save queue).
            networkMode: 'always',
          },
          mutations: {
            networkMode: 'always',
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
