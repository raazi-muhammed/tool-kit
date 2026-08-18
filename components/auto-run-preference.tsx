"use client"

import * as React from "react"

import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import type { Rect } from "@/lib/canvas"

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

/**
 * The full "Run automatically" engine for a tool with a movable selection
 * rectangle (a drawn crop/blur region, …): reads the global setting itself
 * (no need for the caller to also call `useAutoRunEnabled`) and decides
 * the commit timing around it. Each tool opts in via `defersBake` (default
 * `false`, i.e. the original auto-run behavior):
 *
 * - `defersBake: true` — never bakes on a timer, so the selection stays
 *   live/movable indefinitely. Instead, call the returned
 *   `commitBeforeSwitch(nextActiveId)` from the page's own `activeId`
 *   effect, before it resets local selection state for the new job — it
 *   bakes the job being left behind so an in-progress edit is never
 *   silently dropped. (Export-time baking, the other deferred commit
 *   point, is the page's own responsibility — see e.g. Image Blur/Crop's
 *   `exportCanvasForJob`.)
 * - `defersBake: false` (default) — bakes the active job's selection
 *   shortly after `pendingRect` settles, via a debounced effect: the
 *   original auto-run behavior, where the selection is cleared the moment
 *   it's baked.
 *
 * `commit` is expected to both bake and clear the caller's own pending
 * selection state — the same function a manual "Apply" button would call.
 * Returns `autoRunEnabled` too, since the page still needs it to gate its
 * own manual button out of `sidebar.actions`.
 */
export function useEngine({
  activeId,
  pendingRect,
  hasPending,
  commit,
  defersBake = false,
}: {
  activeId: number | null
  /** The rect whose settling triggers a commit in eager mode. */
  pendingRect: Rect | null | undefined
  /** Whether the active job currently has anything uncommitted. */
  hasPending: () => boolean
  /** Bakes (and clears) whatever is pending for `id`. */
  commit: (id: number) => void
  /** Whether this tool defers baking instead of doing it eagerly. Defaults
   *  to `false` (eager) so a tool has to opt in explicitly. */
  defersBake?: boolean
}) {
  const { enabled: autoRunEnabled } = useAutoRunEnabled()
  const prevActiveIdRef = React.useRef<number | null>(null)

  useDebouncedEffect(
    () => {
      if (defersBake) return
      if (!autoRunEnabled || activeId == null || !pendingRect) return
      commit(activeId)
    },
    [autoRunEnabled, pendingRect, activeId, defersBake],
    600
  )

  function commitBeforeSwitch(nextActiveId: number | null) {
    const prevId = prevActiveIdRef.current
    prevActiveIdRef.current = nextActiveId
    if (!defersBake) return
    if (prevId == null || prevId === nextActiveId || !autoRunEnabled) return
    if (hasPending()) commit(prevId)
  }

  return { autoRunEnabled, commitBeforeSwitch }
}
