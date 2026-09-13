import { useEffect, useState } from 'react'

/** Returns `value`, but only after it has stopped changing for `delayMs`.
 * Used to avoid firing a server query on every keystroke of a search box. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(value)
    }, delayMs)
    return () => {
      clearTimeout(timeout)
    }
  }, [value, delayMs])

  return debounced
}
