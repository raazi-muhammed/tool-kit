"use client"

import { useEffect, useState } from "react"

/**
 * State that mirrors a value into localStorage under `key`, so it survives
 * reloads and repeat visits. The initial render always uses `initialValue`
 * (server and client match, so no hydration mismatch); the persisted value
 * loads in a `useEffect` right after mount. `parse` validates the stored
 * JSON and must return `null` for anything malformed, in which case
 * `initialValue` is kept.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  parse: (value: unknown) => T | null
) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return
      const parsed = parse(JSON.parse(raw))
      // One-time sync from localStorage after mount — not a cascading update.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (parsed != null) setValue(parsed)
    } catch {
      // Corrupted or inaccessible storage — keep initialValue.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full/unavailable (e.g. private browsing) — ignore.
    }
  }, [key, value])

  return [value, setValue] as const
}
