/** Form inputs give '' for "left blank"; the database wants null. */
export function emptyToNull(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value
}
