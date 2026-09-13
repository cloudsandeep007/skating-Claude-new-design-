// Shared types used by more than one feature go here.
import type { Database } from './database'

export type { Database }

/** Row type for a `public` table, e.g. `Tables<'students'>`. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Value type for a `public` enum, e.g. `Enums<'app_role'>`. */
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
