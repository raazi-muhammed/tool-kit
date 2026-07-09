"use client"

import { useRef, useState } from "react"

import {
  canvasPointFromEvent,
  clampPoint,
  hitQuadCorner,
  type Quad,
} from "@/lib/canvas"

/**
 * Pointer-driven 4-corner (quadrilateral) selection on a canvas: drag any one
 * corner at a time, clamped to the canvas — used to mark a photographed
 * document's edges before a perspective de-skew warp. Unlike
 * `useRectSelection` there's no draw-from-scratch or move-the-whole-thing
 * gesture; corners always exist (seeded via `resetQuad`) and are only
 * repositioned individually.
 */
export function useQuadSelection({
  canvasRef,
  render,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** Repaint the canvas with the given quad (null = none yet). */
  render: (quad: Quad | null) => void
}) {
  const [quad, setQuad] = useState<Quad | null>(null)
  // Drag tracking lives in a ref — pointerdown/move/up can all fire before
  // React flushes a state update, so state isn't reliable here.
  const dragIndexRef = useRef<number | null>(null)

  function toCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    return canvasPointFromEvent(canvas, e)
  }

  /** Corner grab tolerance: ~14 screen px, converted to canvas px. */
  function hitTolerance(): number {
    const canvas = canvasRef.current
    if (!canvas) return 14
    const box = canvas.getBoundingClientRect()
    return 14 * (canvas.width / box.width)
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0 || !quad) return
    const point = toCanvasPoint(e)
    const index = hitQuadCorner(point.x, point.y, quad, hitTolerance())
    if (index == null) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Untrusted/synthetic events have no active pointer to capture.
    }
    dragIndexRef.current = index
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const index = dragIndexRef.current
    if (index == null || !canvas || !quad) return
    const point = clampPoint(toCanvasPoint(e), canvas.width, canvas.height)
    const next = quad.map((p, i) => (i === index ? point : p)) as Quad
    setQuad(next)
    render(next)
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    dragIndexRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Capture may already be gone; nothing to clean up.
    }
  }

  function onPointerCancel() {
    dragIndexRef.current = null
  }

  /** Seed a fresh quad (e.g. a newly picked/switched image, or after a warp is applied) and repaint. */
  function resetQuad(next: Quad | null) {
    setQuad(next)
    render(next)
  }

  return {
    quad,
    resetQuad,
    quadHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
