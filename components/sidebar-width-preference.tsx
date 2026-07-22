"use client"

import * as React from "react"

const STORAGE_KEY = "settings-sidebar-width"

export const SIDEBAR_MIN_WIDTH = 260
export const SIDEBAR_MAX_WIDTH = 480
export const SIDEBAR_DEFAULT_WIDTH = 320

function clampWidth(value: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value))
}

const listeners = new Set<() => void>()

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

function getSnapshot(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return SIDEBAR_DEFAULT_WIDTH
    const parsed = JSON.parse(raw)
    return typeof parsed === "number" && Number.isFinite(parsed)
      ? clampWidth(parsed)
      : SIDEBAR_DEFAULT_WIDTH
  } catch {
    return SIDEBAR_DEFAULT_WIDTH
  }
}

function getServerSnapshot(): number {
  return SIDEBAR_DEFAULT_WIDTH
}

const SidebarWidthContext = React.createContext<{
  width: number
  setWidth: (width: number) => void
} | null>(null)

export function SidebarWidthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // A hook like `usePersistedState` (render with a default, correct from
  // localStorage in a later effect) isn't good enough here: the settings
  // panel would render at the default width and then visibly snap to the
  // saved one right after mount, on every tool page. `useSyncExternalStore`
  // resolves the real width synchronously during render (see
  // `motion-preference.tsx` for the same reasoning), so it's already
  // correct by the first paint.
  const width = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  function setWidth(next: number) {
    const clamped = clampWidth(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
    } catch {
      // Storage full/unavailable (e.g. private browsing) — listeners still
      // fire, so this tab's in-memory state updates even if it won't persist.
    }
    listeners.forEach((listener) => listener())
  }

  return (
    <SidebarWidthContext.Provider value={{ width, setWidth }}>
      {children}
    </SidebarWidthContext.Provider>
  )
}

/** The settings sidebar's drag-resized width (`ToolPage`'s right-hand
 *  panel) — shared and persisted across every tool and reload. */
export function useSidebarWidth() {
  const context = React.useContext(SidebarWidthContext)
  if (!context) {
    throw new Error(
      "useSidebarWidth must be used within a SidebarWidthProvider"
    )
  }
  return context
}
