"use client"

import { useRef, useState } from "react"

import {
  canvasPointFromEvent,
  clampRect,
  edgeCursor,
  hitEdges,
  pointInRect,
  rectFromPoints,
  rectFromPointsWithRatio,
  resizeRect,
  type Edges,
  type Rect,
} from "@/lib/canvas"

// A drag either draws a new selection ("select"), translates the pending one
// ("move", grabbed at an offset from the rect's origin), or drags one of its
// edges/corners ("resize").
type Drag =
  | { mode: "select"; startX: number; startY: number }
  | { mode: "move"; grabX: number; grabY: number; rect: Rect }
  | { mode: "resize"; edges: Edges; rect: Rect }

/**
 * Pointer-driven rectangle selection on a canvas: drag to draw a selection,
 * drag inside it to move it, drag its edges/corners to resize it — clamped to
 * the canvas, optionally locked to an aspect `ratio`, with the hover cursor
 * kept in sync. The canvas's internal size is taken as the coordinate space,
 * so it works regardless of how the canvas is scaled or transformed on
 * screen.
 *
 * The hook owns the selection state and calls `render` whenever the canvas
 * should repaint — with the in-progress/committed rect, or null when the
 * selection is gone. Spread `selectionHandlers` onto the canvas element and
 * draw the selection chrome in `render` via `drawSelectionRect`.
 */
export function useRectSelection({
  canvasRef,
  ratio = null,
  render,
  minSize = 2,
  onDiscardPending,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** Locked aspect ratio (width / height); null for free-form. */
  ratio?: number | null
  /** Repaint the canvas with the given selection (null = no selection). */
  render: (rect: Rect | null) => void
  /** Drags smaller than this (canvas px) are discarded as accidental. */
  minSize?: number
  /**
   * Called with the pending rect right before it's replaced by a fresh
   * "draw a new selection" drag started elsewhere on the canvas (not a
   * move/resize of it) — e.g. to stash it in a caller-owned list instead of
   * losing it, so drawing a second rect doesn't erase the first.
   */
  onDiscardPending?: (rect: Rect) => void
}) {
  const [pendingRect, setPendingRect] = useState<Rect | null>(null)
  // Drag tracking lives entirely in a ref — pointerdown/move/up can all fire
  // before React flushes a state update, so state isn't reliable here.
  const dragRef = useRef<Drag | null>(null)

  function toCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    return canvasPointFromEvent(canvas, e)
  }

  /** Edge grab tolerance: ~8 screen px, converted to canvas px. */
  function hitTolerance(): number {
    const canvas = canvasRef.current
    if (!canvas) return 8
    const box = canvas.getBoundingClientRect()
    return 8 * (canvas.width / box.width)
  }

  function dragRect(e: React.PointerEvent<HTMLCanvasElement>): Rect | null {
    const drag = dragRef.current
    const canvas = canvasRef.current
    if (!drag || !canvas) return null
    const point = toCanvasPoint(e)

    if (drag.mode === "resize") {
      return resizeRect(
        drag.edges,
        drag.rect,
        point,
        ratio,
        canvas.width,
        canvas.height
      )
    }

    if (drag.mode === "move") {
      // Translate the grabbed rect, keeping it fully inside the canvas.
      return {
        x: Math.max(
          0,
          Math.min(point.x - drag.grabX, canvas.width - drag.rect.width)
        ),
        y: Math.max(
          0,
          Math.min(point.y - drag.grabY, canvas.height - drag.rect.height)
        ),
        width: drag.rect.width,
        height: drag.rect.height,
      }
    }

    if (ratio) {
      return rectFromPointsWithRatio(
        drag.startX,
        drag.startY,
        point.x,
        point.y,
        ratio,
        canvas.width,
        canvas.height
      )
    }
    return clampRect(
      rectFromPoints(drag.startX, drag.startY, point.x, point.y),
      canvas.width,
      canvas.height
    )
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Untrusted/synthetic events have no active pointer to capture.
    }
    const point = toCanvasPoint(e)
    const edges = pendingRect
      ? hitEdges(point.x, point.y, pendingRect, hitTolerance())
      : null
    if (pendingRect && edges) {
      dragRef.current = { mode: "resize", edges, rect: pendingRect }
    } else if (pendingRect && pointInRect(point.x, point.y, pendingRect)) {
      dragRef.current = {
        mode: "move",
        grabX: point.x - pendingRect.x,
        grabY: point.y - pendingRect.y,
        rect: pendingRect,
      }
    } else {
      if (pendingRect) onDiscardPending?.(pendingRect)
      dragRef.current = { mode: "select", startX: point.x, startY: point.y }
      setPendingRect(null)
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) {
      // Not dragging: just reflect what a drag here would do in the cursor.
      const canvas = canvasRef.current
      if (canvas) {
        const point = toCanvasPoint(e)
        let cursor = "crosshair"
        if (pendingRect) {
          const edges = hitEdges(point.x, point.y, pendingRect, hitTolerance())
          if (edges) cursor = edgeCursor(edges)
          else if (pointInRect(point.x, point.y, pendingRect)) cursor = "move"
        }
        canvas.style.cursor = cursor
      }
      return
    }
    const rect = dragRect(e)
    if (rect) render(rect)
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    const rect = dragRect(e)
    dragRef.current = null
    if (!drag || !rect) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Capture may already be gone; nothing to clean up.
    }
    if (drag.mode === "select" && (rect.width < minSize || rect.height < minSize)) {
      setPendingRect(null)
      render(null)
      return
    }
    setPendingRect(rect)
    render(rect)
  }

  function onPointerCancel() {
    dragRef.current = null
    render(pendingRect)
  }

  /** Drop the selection and repaint clean. */
  function clearSelection() {
    setPendingRect(null)
    render(null)
  }

  /**
   * Make `rect` the pending selection and immediately start moving it from
   * the pointer event that picked it up — for a caller that manages other
   * rects of its own (e.g. several queued selections) and wants clicking one
   * of them to hand it off to this hook instead of starting a fresh drag.
   * Sets `dragRef` directly (not through React state) so the drag continues
   * correctly on this same gesture's `onPointerMove`/`onPointerUp`.
   */
  function selectRect(rect: Rect, e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Untrusted/synthetic events have no active pointer to capture.
    }
    const point = toCanvasPoint(e)
    dragRef.current = {
      mode: "move",
      grabX: point.x - rect.x,
      grabY: point.y - rect.y,
      rect,
    }
    setPendingRect(rect)
    render(rect)
  }

  return {
    pendingRect,
    clearSelection,
    selectRect,
    selectionHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
