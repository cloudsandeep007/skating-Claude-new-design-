import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from './supabase'

/** Calls a Supabase Edge Function and returns its JSON body, or throws an
 * Error carrying the function's own `{ error: "..." }` message when it
 * responded with a non-2xx status. The caller's session JWT is forwarded
 * automatically by supabase-js. */
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  // supabase-js types the failure branch's `error` (and FunctionsHttpError's
  // `context`) as `any`, so re-type them as unknown here — once — instead of
  // every caller repeating the same dance.
  const { data, error } = (await supabase.functions.invoke<T>(name, { body })) as {
    data: T | null
    error: unknown
  }

  if (error !== null && error !== undefined) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? `${name} failed (${String(response.status)})`)
    }
    throw error instanceof Error ? error : new Error(`${name} failed`)
  }

  return data as T
}
