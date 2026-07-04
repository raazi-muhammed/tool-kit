"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  BlurIcon,
  Cancel01Icon,
  CloudUploadIcon,
  Download04Icon,
  FitToScreenIcon,
  GridViewIcon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { ToolPage } from "@/components/tool-page"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { useRectSelection } from "@/hooks/use-rect-selection"
import {
  blurRegion,
  drawSelectionRect,
  type BlurMode,
  type Rect,
} from "@/lib/canvas"
import { replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*"
const MIN_ZOOM = 1
const MAX_ZOOM = 8

// Safari's trackpad pinch arrives as gesture* events, not ctrl+wheel.
type SafariGestureEvent = Event & {
  scale?: number
  clientX?: number
  clientY?: number
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error("This file couldn't be decoded as an image."))
    img.src = url
  })
}

export default function ImageBlurPage() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blur, setBlur] = useState(20)
  const [mode, setMode] = useState<BlurMode>("gaussian")
  const [dragging, setDragging] = useState(false)
  const [hasEdits, setHasEdits] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  // `baseCanvas` is the committed ground truth (applied blurs only).
  // `displayCanvas` is what's on screen, and also shows the live preview.
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)

  const { pendingRect, clearSelection, selectionHandlers } = useRectSelection({
    canvasRef: displayCanvasRef,
    render: (rect) => renderDisplay(rect ?? undefined),
  })

  // Zoom/pan is pure CSS transform on the canvas inside a clipped viewport —
  // selection mapping is unaffected because getBoundingClientRect already
  // reflects the transform. Kept in refs (not state) so wheel/pinch events
  // don't re-render React on every tick; `zoomPct` mirrors it for the UI.
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef({ scale: 1, x: 0, y: 0 })
  const fitSizeRef = useRef({ width: 0, height: 0 })
  const [zoomPct, setZoomPct] = useState(100)

  function applyView() {
    const canvas = displayCanvasRef.current
    const viewport = viewportRef.current
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
  }

  /** Size the canvas to fit the viewport (object-contain) and reset the view. */
  function fitView() {
    const canvas = displayCanvasRef.current
    const viewport = viewportRef.current
    const base = baseCanvasRef.current
    if (!canvas || !viewport || !base) return
    const fit = Math.min(
      viewport.clientWidth / base.width,
      viewport.clientHeight / base.height
    )
    fitSizeRef.current = { width: base.width * fit, height: base.height * fit }
    canvas.style.width = `${fitSizeRef.current.width}px`
    canvas.style.height = `${fitSizeRef.current.height}px`
    viewRef.current = { scale: 1, x: 0, y: 0 }
    applyView()
  }

  /** Zoom by `factor` keeping the viewport point (px, py) fixed. */
  function zoomAt(px: number, py: number, factor: number) {
    const view = viewRef.current
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * factor))
    const applied = next / view.scale
    view.x = px - (px - view.x) * applied
    view.y = py - (py - view.y) * applied
    view.scale = next
    applyView()
  }

  function zoomFromButton(factor: number) {
    const viewport = viewportRef.current
    if (!viewport) return
    zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, factor)
  }

  function renderDisplay(
    rect?: Rect,
    blurPx: number = blur,
    blurMode: BlurMode = mode
  ) {
    const base = baseCanvasRef.current
    const display = displayCanvasRef.current
    if (!base || !display) return
    const ctx = display.getContext("2d")
    if (!ctx) return

    // Keep the visible canvas's internal resolution in sync with the image —
    // it may have just mounted (React renders it only once a file is picked).
    if (display.width !== base.width || display.height !== base.height) {
      display.width = base.width
      display.height = base.height
    }

    if (rect && rect.width > 0 && rect.height > 0) {
      blurRegion(display, base, rect, blurPx, blurMode)
    } else {
      ctx.drawImage(base, 0, 0)
    }

    if (rect) {
      drawSelectionRect(display, rect)
    }
  }

  // Paint + fit the visible canvas after it mounts — it only exists in the
  // DOM once a file has been picked, so this can't happen in addFile itself.
  // Also wires zoom/pan listeners natively: React registers wheel handlers as
  // passive, which would make preventDefault (needed to stop page scroll and
  // browser pinch-zoom) a no-op.
  useEffect(() => {
    if (!file) return
    renderDisplay()
    fitView()

    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Pinch on Chrome/Firefox trackpads, or ctrl/cmd + scroll wheel.
        const box = viewport.getBoundingClientRect()
        zoomAt(
          e.clientX - box.left,
          e.clientY - box.top,
          Math.exp(-e.deltaY * 0.01)
        )
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
      const box = viewport.getBoundingClientRect()
      const target = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, gestureStartScale * gesture.scale)
      )
      zoomAt(
        (gesture.clientX ?? box.left + box.width / 2) - box.left,
        (gesture.clientY ?? box.top + box.height / 2) - box.top,
        target / viewRef.current.scale
      )
    }

    const onResize = () => fitView()

    viewport.addEventListener("wheel", onWheel, { passive: false })
    viewport.addEventListener("gesturestart", onGestureStart)
    viewport.addEventListener("gesturechange", onGestureChange)
    window.addEventListener("resize", onResize)
    return () => {
      viewport.removeEventListener("wheel", onWheel)
      viewport.removeEventListener("gesturestart", onGestureStart)
      viewport.removeEventListener("gesturechange", onGestureChange)
      window.removeEventListener("resize", onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  function reset() {
    setFile(null)
    setError(null)
    setBlur(20)
    setHasEdits(false)
    baseCanvasRef.current = null
    clearSelection()
  }

  async function addFile(picked: File | null | undefined) {
    if (!picked) return
    if (!isImageFile(picked)) {
      reset()
      setError("This file doesn't look like an image.")
      return
    }

    const url = URL.createObjectURL(picked)
    try {
      const img = await loadImage(url)
      const base = document.createElement("canvas")
      base.width = img.naturalWidth
      base.height = img.naturalHeight
      const baseCtx = base.getContext("2d")
      if (!baseCtx) throw new Error("Canvas isn't supported in this browser.")
      baseCtx.drawImage(img, 0, 0)
      baseCanvasRef.current = base

      // The visible canvas mounts on this state change; the effect below
      // paints it once it exists.
      setFile(picked)
      setError(null)
      setHasEdits(false)
      clearSelection()
    } catch (err) {
      reset()
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading the image."
      )
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    addFile(e.target.files?.[0])
    e.target.value = ""
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFile(e.dataTransfer.files?.[0])
  }

  function applyBlur() {
    const base = baseCanvasRef.current
    if (!base || !pendingRect) return
    // Commit the current preview into the base image, then re-render clean.
    const committed = document.createElement("canvas")
    committed.width = base.width
    committed.height = base.height
    blurRegion(committed, base, pendingRect, blur, mode)
    baseCanvasRef.current = committed
    setHasEdits(true)
    clearSelection()
  }

  async function download() {
    const base = baseCanvasRef.current
    if (!base || !file) return
    const mime =
      file.type && file.type.startsWith("image/") ? file.type : "image/png"
    const blob: Blob | null = await new Promise((resolve) =>
      base.toBlob(resolve, mime)
    )
    if (!blob) return
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "png"
    const name = replaceExtension(file.name, ext)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  // Re-render whenever the blur strength or mode changes while a selection is
  // pending, so the preview stays live. New values are passed explicitly —
  // the state in these closures is still the old one.
  function onBlurChange(value: number) {
    setBlur(value)
    if (pendingRect) renderDisplay(pendingRect, value)
  }

  function onModeChange(value: BlurMode) {
    setMode(value)
    if (pendingRect) renderDisplay(pendingRect, blur, value)
  }

  return (
    <ToolPage
      page="Image Blur"
      icon={BlurIcon}
      segments={{
        value: mode,
        onValueChange: (value) => onModeChange(value as BlurMode),
        options: [
          { value: "gaussian", label: "Gaussian", icon: BlurIcon },
          { value: "pixelate", label: "Blocky", icon: GridViewIcon },
        ],
      }}
      onClear={reset}
    >
      <div className="flex flex-1 flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onPick}
          className="hidden"
        />

        {file ? (
          <div className="flex flex-col gap-4">
            <Card className="overflow-hidden p-2">
              <div
                ref={viewportRef}
                className="relative h-[60vh] w-full overflow-hidden rounded-md"
              >
                <canvas
                  ref={displayCanvasRef}
                  {...selectionHandlers}
                  className="absolute top-0 left-0 origin-top-left cursor-crosshair touch-none select-none"
                />
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  onClick={() => zoomFromButton(0.8)}
                  disabled={zoomPct <= MIN_ZOOM * 100}
                  aria-label="Zoom out"
                >
                  <HugeiconsIcon icon={ZoomOutAreaIcon} aria-hidden />
                </Button>
                <span className="w-12 text-center text-sm text-muted-foreground">
                  {zoomPct}%
                </span>
                <Button
                  variant="ghost"
                  onClick={() => zoomFromButton(1.25)}
                  disabled={zoomPct >= MAX_ZOOM * 100}
                  aria-label="Zoom in"
                >
                  <HugeiconsIcon icon={ZoomInAreaIcon} aria-hidden />
                </Button>
                <Button variant="ghost" onClick={fitView} aria-label="Fit to screen">
                  <HugeiconsIcon icon={FitToScreenIcon} aria-hidden />
                </Button>
              </div>

              <div className="flex flex-1 items-center gap-3">
                <span className="text-sm text-muted-foreground">Blur</span>
                <Slider
                  value={[blur]}
                  onValueChange={([value]) => onBlurChange(value)}
                  min={1}
                  max={50}
                  step={1}
                  className="max-w-48"
                />
                <span className="w-8 text-right text-sm text-muted-foreground">
                  {blur}
                </span>
              </div>

              {pendingRect && (
                <Button variant="ghost" onClick={clearSelection}>
                  <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
                  Cancel selection
                </Button>
              )}
              <Button onClick={applyBlur} disabled={!pendingRect}>
                <HugeiconsIcon icon={BlurIcon} aria-hidden />
                Apply blur
              </Button>
              <Button
                variant="secondary"
                onClick={download}
                disabled={!hasEdits}
              >
                <HugeiconsIcon icon={Download04Icon} aria-hidden />
                Download
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <>
            <Attachment
              state="idle"
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  inputRef.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`w-full cursor-pointer transition-colors ${
                dragging ? "border-primary bg-accent/50" : "hover:bg-muted/50"
              }`}
            >
              <AttachmentMedia>
                <HugeiconsIcon icon={CloudUploadIcon} aria-hidden />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>
                  Drag &amp; drop an image, or click to browse
                </AttachmentTitle>
                <AttachmentDescription>
                  Blur any region · in-browser only
                </AttachmentDescription>
              </AttachmentContent>
            </Attachment>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </div>
    </ToolPage>
  )
}
