"use client"

import * as React from "react"

const STORAGE_KEY = "compact-view-enabled"

const listeners = new Set<() => void>()

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

function getSnapshot(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return false
    const parsed = JSON.parse(raw)
    return typeof parsed === "boolean" ? parsed : false
  } catch {
    return false
  }
}

function getServerSnapshot(): boolean {
  return false
}

const CompactViewContext = React.createContext<{
  enabled: boolean
  setEnabled: (enabled: boolean) => void
} | null>(null)

export function CompactViewProvider({
  children,
}: {
  children: React.ReactNode
}) {
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
    <CompactViewContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </CompactViewContext.Provider>
  )
}

/** Whether the "Compact view" setting is on — the homepage grid packs more
 *  cards per row and hides each tool's description, leaving just the icon
 *  and name. */
export function useCompactViewEnabled() {
  const context = React.useContext(CompactViewContext)
  if (!context) {
    throw new Error(
      "useCompactViewEnabled must be used within a CompactViewProvider"
    )
  }
  return context
}
