"use client"

import { useEffect } from "react"

/**
 * Like `useEffect`, but delays running `effect` until `deps` have settled
 * for `delayMs` — for tools that regenerate every queued job automatically
 * whenever a setting changes, instead of requiring an explicit apply click,
 * so dragging a slider/color picker doesn't redraw on every tick.
 */
export function useDebouncedEffect(
  effect: () => void,
  deps: React.DependencyList,
  delayMs = 300
) {
  useEffect(() => {
    const timeout = setTimeout(effect, delayMs)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
