"use client"

import * as React from "react"

const STORAGE_KEY = "animations-enabled"

const listeners = new Set<() => void>()

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

function getSnapshot(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return true
    const parsed = JSON.parse(raw)
    return typeof parsed === "boolean" ? parsed : true
  } catch {
    return true
  }
}

function getServerSnapshot(): boolean {
  return true
}

const MotionPreferenceContext = React.createContext<{
  enabled: boolean
  setEnabled: (enabled: boolean) => void
} | null>(null)

export function MotionPreferenceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // A hook like `usePersistedState` (render with a default, correct from
  // localStorage in a later effect) isn't good enough here: framer-motion
  // decides whether to play a mount animation in its own internal layout
  // effect, which fires before that later correction ever arrives — so an
  // entrance animation would always play once regardless of the saved
  // preference. `useSyncExternalStore` resolves the real value synchronously
  // during render (via React's hydration-safe reconciliation, using
  // `getServerSnapshot` for the server/first-paint case), so it's already
  // correct by the time anything downstream decides whether to animate.
  const enabled = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  function setEnabled(next: boolean) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage full/unavailable (e.g. private browsing) — listeners still
      // fire, so this tab's in-memory state updates even if it won't persist.
    }
    listeners.forEach((listener) => listener())
  }

  return (
    <MotionPreferenceContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </MotionPreferenceContext.Provider>
  )
}

/** Whether the "Animations" setting is on — gate any non-essential motion
 *  (page-transition overlays, entrance stagger, dramatic dialog zoom) behind
 *  this, falling back to an instant/no-op equivalent when it's off. */
export function useAnimationsEnabled() {
  const context = React.useContext(MotionPreferenceContext)
  if (!context) {
    throw new Error(
      "useAnimationsEnabled must be used within a MotionPreferenceProvider"
    )
  }
  return context
}
