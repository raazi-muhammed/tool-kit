"use client"

import * as React from "react"

const STORAGE_KEY = "auto-run-enabled"

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

const AutoRunContext = React.createContext<{
  enabled: boolean
  setEnabled: (enabled: boolean) => void
} | null>(null)

export function AutoRunProvider({ children }: { children: React.ReactNode }) {
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
    <AutoRunContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </AutoRunContext.Provider>
  )
}

/** Whether the "Run automatically" setting is on — gate a tool's explicit
 *  apply/convert/scan button behind this: when enabled, regenerate the result
 *  live (debounced) instead of waiting for the user to click it, hiding the
 *  button the same way Image Converter's format picker already does
 *  unconditionally. Falls back to the manual button when disabled. */
export function useAutoRunEnabled() {
  const context = React.useContext(AutoRunContext)
  if (!context) {
    throw new Error("useAutoRunEnabled must be used within an AutoRunProvider")
  }
  return context
}
