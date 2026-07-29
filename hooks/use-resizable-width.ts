"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Drag-to-resize interaction for a panel's width, driven from a handle at
 * one of its edges — purely the pointer/keyboard mechanics, with no
 * persistence of its own; pair it with a controlled `value`/`onChange`
 * (e.g. `useSidebarWidth`) to save the result. `edge` says which side of
 * the panel the handle sits on — `"left"` grows the panel as the pointer
 * moves left (a right-hand panel's own left edge), `"right"` grows it
 * moving right — so dragging always grows the panel toward its own
 * interior regardless of which side it's docked on.
 */
export function useResizableWidth({
  value,
  onChange,
  min,
  max,
  edge,
  step = 16,
}: {
  value: number
  onChange: (width: number) => void
  min: number
  max: number
  edge: "left" | "right"
  /** Amount ArrowLeft/ArrowRight nudge the width by. */
  step?: number
}) {
  const [isResizing, setIsResizing] = useState(false)

  const clamp = useCallback(
    (next: number) => Math.min(max, Math.max(min, next)),
    [min, max]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      const startX = e.clientX
      const startWidth = value
      setIsResizing(true)

      function onPointerMove(event: PointerEvent) {
        const delta = event.clientX - startX
        onChange(clamp(startWidth + (edge === "left" ? -delta : delta)))
      }

      function stop() {
        setIsResizing(false)
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", stop)
        window.removeEventListener("pointercancel", stop)
      }

      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", stop)
      window.addEventListener("pointercancel", stop)
    },
    [value, edge, clamp, onChange]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const grow = edge === "left" ? "ArrowLeft" : "ArrowRight"
      const shrink = edge === "left" ? "ArrowRight" : "ArrowLeft"
      if (e.key === grow) onChange(clamp(value + step))
      else if (e.key === shrink) onChange(clamp(value - step))
      else if (e.key === "Home") onChange(min)
      else if (e.key === "End") onChange(max)
      else return
      e.preventDefault()
    },
    [edge, step, min, max, value, clamp, onChange]
  )

  // Dragging fast can otherwise select surrounding text and flicker between
  // the resize cursor and a text-selection cursor mid-drag.
  useEffect(() => {
    if (!isResizing) return
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isResizing])

  return { isResizing, onPointerDown, onKeyDown }
}
