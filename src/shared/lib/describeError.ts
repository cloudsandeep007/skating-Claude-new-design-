/** Turns a thrown Supabase / Postgres / Edge Function error into one plain
 * sentence an admin can act on, instead of a generic "please try again".
 * Known database codes get a friendly reading; anything else falls back to
 * the server's own message, then to the caller's default. */
export function describeError(error: unknown, fallback: string): string {
  const e = error as { code?: unknown; message?: unknown; details?: unknown } | null
  const code = typeof e?.code === 'string' ? e.code : ''
  const message = typeof e?.message === 'string' ? e.message : ''

  switch (code) {
    case '23505':
      return 'One with this name already exists — pick a different name.'
    case '22003':
      return 'That number is too large to store — enter a smaller amount.'
    case '23503':
      return 'It refers to something that no longer exists — refresh and try again.'
    case '23514':
      return 'That value is outside the allowed range.'
    case '42501':
      return "You don't have permission to do that."
    case 'PGRST116':
      return 'Not found — it may have been removed.'
  }

  if (/rate limit/i.test(message)) {
    return 'The email service limit was reached, so the invite could not be sent right now. Try again in an hour, or link an existing parent.'
  }
  if (/already been registered|already exists|already registered/i.test(message)) {
    return 'An account with this email already exists — use "Existing parent" to link it.'
  }
  if (/Failed to fetch|NetworkError|network/i.test(message)) {
    return 'No connection — check your network and try again.'
  }
  if (message.trim() !== '') return message
  return fallback
}
