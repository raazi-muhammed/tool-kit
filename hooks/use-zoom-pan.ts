"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const MIN_ZOOM = 1
const MAX_ZOOM = 8

// Safari's trackpad pinch arrives as gesture* events, not ctrl+wheel.
type SafariGestureEvent = Event & {
  scale?: number
  clientX?: number
  clientY?: number
}

/**
 * Pinch/scroll zoom and pan for a canvas inside a clipped viewport, as a
 * pure CSS transform — selection/hit-testing math on the canvas is
 * unaffected since getBoundingClientRect already reflects the transform.
 * Call `fitView()` after painting a new base image (e.g. once the active
 * job switches) to reset zoom/pan and fit it to the viewport.
 *
 * `viewportRef` is a callback ref (not a plain object ref) so listener setup
 * runs exactly when the viewport mounts — it only exists in the DOM once a
 * file has been picked, which doesn't line up with any fixed render this
 * hook's caller controls. Listeners are wired natively rather than via
 * React's (passive) wheel handler, since `preventDefault` is needed to stop
 * page scroll and browser pinch-zoom.
 */
export function useZoomPan({
  canvasRef,
  getBaseSize,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** The natural size of whatever's currently painted onto `canvasRef`, to fit against. */
  getBaseSize: () => { width: number; height: number } | undefined
}) {
  const viewportElRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef({ scale: 1, x: 0, y: 0 })
  const fitSizeRef = useRef({ width: 0, height: 0 })
  const cleanupRef = useRef<() => void>(() => {})
  const [zoomPct, setZoomPct] = useState(100)

  // `getBaseSize` is a fresh closure every render (it typically wraps a
  // page's own `getResource`) — mirrored into a ref so the stable callbacks
  // below always read the latest one instead of the one captured on mount.
  const getBaseSizeRef = useRef(getBaseSize)
  useEffect(() => {
    getBaseSizeRef.current = getBaseSize
  })

  const applyView = useCallback(() => {
    const canvas = canvasRef.current
    const viewport = viewportElRef.current
    if (!canvas || !viewport) return
    const view = viewRef.current
    // Clamp so the image stays inside the viewport (centered when smaller).
    const vw = viewport.clientWidth
    const vh = viewport.clientHeight
    const w = fitSizeRef.current.width * view.scale
    const h = fitSizeRef.current.height * view.scale
    view.x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, view.x))
    view.y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, view.y))
    canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
    setZoomPct(Math.round(view.scale * 100))
  }, [canvasRef])

  /** Size the canvas to fit the viewport (object-contain) and reset the view. */
  const fitView = useCallback(() => {
    const canvas = canvasRef.current
    const viewport = viewportElRef.current
    const base = getBaseSizeRef.current()
    if (!canvas || !viewport || !base) return
    const fit = Math.min(viewport.clientWidth / base.width, viewport.clientHeight / base.height)
    fitSizeRef.current = { width: base.width * fit, height: base.height * fit }
    canvas.style.width = `${fitSizeRef.current.width}px`
    canvas.style.height = `${fitSizeRef.current.height}px`
    viewRef.current = { scale: 1, x: 0, y: 0 }
    applyView()
  }, [canvasRef, applyView])

  /** Zoom by `factor` keeping the viewport point (px, py) fixed. */
  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const view = viewRef.current
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * factor))
      const applied = next / view.scale
      view.x = px - (px - view.x) * applied
      view.y = py - (py - view.y) * applied
      view.scale = next
      applyView()
    },
    [applyView]
  )

  const zoomFromButton = useCallback(
    (factor: number) => {
      const viewport = viewportElRef.current
      if (!viewport) return
      zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, factor)
    },
    [zoomAt]
  )

  const viewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      cleanupRef.current()
      viewportElRef.current = node
      if (!node) return

      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        if (e.ctrlKey || e.metaKey) {
          // Pinch on Chrome/Firefox trackpads, or ctrl/cmd + scroll wheel.
          const box = node.getBoundingClientRect()
          zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * 0.01))
        } else {
          const view = viewRef.current
          view.x -= e.deltaX
          view.y -= e.deltaY
          applyView()
        }
      }

      // Safari trackpad pinch fires gesture* events instead of ctrl+wheel.
      let gestureStartScale = 1
      const onGestureStart = (e: Event) => {
        e.preventDefault()
        gestureStartScale = viewRef.current.scale
      }
      const onGestureChange = (e: Event) => {
        e.preventDefault()
        const gesture = e as SafariGestureEvent
        if (!gesture.scale) return
        const box = node.getBoundingClientRect()
        const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, gestureStartScale * gesture.scale))
        zoomAt(
          (gesture.clientX ?? box.left + box.width / 2) - box.left,
          (gesture.clientY ?? box.top + box.height / 2) - box.top,
          target / viewRef.current.scale
        )
      }

      const onResize = () => fitView()

      node.addEventListener("wheel", onWheel, { passive: false })
      node.addEventListener("gesturestart", onGestureStart)
      node.addEventListener("gesturechange", onGestureChange)
      window.addEventListener("resize", onResize)
      cleanupRef.current = () => {
        node.removeEventListener("wheel", onWheel)
        node.removeEventListener("gesturestart", onGestureStart)
        node.removeEventListener("gesturechange", onGestureChange)
        window.removeEventListener("resize", onResize)
      }
    },
    [zoomAt, applyView, fitView]
  )

  return { viewportRef, zoomPct, MIN_ZOOM, MAX_ZOOM, fitView, zoomFromButton }
}
