"use client"

import { useEffect, useState, type SetStateAction } from "react"

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full/unavailable (e.g. private browsing) — ignore.
  }
}

/**
 * State that mirrors a value into localStorage under `key`, so it survives
 * reloads and repeat visits. The initial render always uses `initialValue`
 * (server and client match, so no hydration mismatch); the persisted value
 * loads in a `useEffect` right after mount. `parse` validates the stored
 * JSON and must return `null` for anything malformed, in which case
 * `initialValue` is kept.
 *
 * Writes happen in the setter, not in an effect keyed on the value: an
 * effect would also fire on mount with `initialValue`, overwriting the saved
 * value before it loads — and under Strict Mode's double-run of effects, the
 * second load then reads back that default and the saved data is lost.
 *
 * The third element, `clear()`, removes the key from localStorage and resets
 * to `initialValue`; the key stays absent until the value next changes.
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

  function setPersisted(action: SetStateAction<T>) {
    setValue((prev) => {
      const next =
        typeof action === "function" ? (action as (prev: T) => T)(prev) : action
      // Idempotent, so safe even if React re-invokes this updater.
      writeStorage(key, next)
      return next
    })
  }

  function clear() {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage unavailable — nothing to remove.
    }
    setValue(initialValue)
  }

  return [value, setPersisted, clear] as const
}
