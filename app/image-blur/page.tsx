"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  BlurIcon,
  Cancel01Icon,
  CloudUploadIcon,
  Download04Icon,
  GridViewIcon,
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
import {
  blurRegion,
  clampRect,
  rectFromPoints,
  type BlurMode,
  type Rect,
} from "@/lib/canvas"
import { formatBytes, replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*"

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
  const [pendingRect, setPendingRect] = useState<Rect | null>(null)
  const [hasEdits, setHasEdits] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  // `baseCanvas` is the committed ground truth (applied blurs only).
  // `displayCanvas` is what's on screen, and also shows the live preview.
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  function toCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = displayCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const box = canvas.getBoundingClientRect()
    const scaleX = canvas.width / box.width
    const scaleY = canvas.height / box.height
    return {
      x: (e.clientX - box.left) * scaleX,
      y: (e.clientY - box.top) * scaleY,
    }
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
      ctx.save()
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = Math.max(1, display.width / 400)
      ctx.setLineDash([ctx.lineWidth * 4, ctx.lineWidth * 3])
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      ctx.restore()
    }
  }

  // Paint the visible canvas after it mounts — it only exists in the DOM once
  // a file has been picked, so drawing can't happen inside addFile itself.
  useEffect(() => {
    if (file) renderDisplay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  function reset() {
    setFile(null)
    setError(null)
    setBlur(20)
    setPendingRect(null)
    setHasEdits(false)
    baseCanvasRef.current = null
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
      setPendingRect(null)
      setHasEdits(false)
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

  // Drag tracking lives entirely in a ref — pointerdown/move/up can all fire
  // before React flushes a state update, so state isn't reliable here.
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!baseCanvasRef.current) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Untrusted/synthetic events have no active pointer to capture.
    }
    dragStartRef.current = toCanvasPoint(e)
    setPendingRect(null)
  }

  function dragRect(e: React.PointerEvent<HTMLCanvasElement>): Rect | null {
    const start = dragStartRef.current
    const base = baseCanvasRef.current
    if (!start || !base) return null
    const point = toCanvasPoint(e)
    return clampRect(
      rectFromPoints(start.x, start.y, point.x, point.y),
      base.width,
      base.height
    )
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = dragRect(e)
    if (rect) renderDisplay(rect)
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = dragRect(e)
    if (!rect) return
    dragStartRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Capture may already be gone; nothing to clean up.
    }
    if (rect.width < 2 || rect.height < 2) {
      renderDisplay()
      return
    }
    setPendingRect(rect)
    renderDisplay(rect)
  }

  function onPointerCancel() {
    dragStartRef.current = null
    renderDisplay()
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
    setPendingRect(null)
    setHasEdits(true)
    renderDisplay()
  }

  function cancelSelection() {
    setPendingRect(null)
    renderDisplay()
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
            <Card className="items-center overflow-hidden p-2">
              <canvas
                ref={displayCanvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                className="max-h-[70vh] max-w-full cursor-crosshair touch-none rounded-md select-none"
              />
            </Card>
            <p className="text-sm text-muted-foreground">
              {file.name} · {formatBytes(file.size)} · drag a rectangle over the
              image to select an area
            </p>

            <div className="flex flex-wrap items-center gap-4">
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
                <Button variant="ghost" onClick={cancelSelection}>
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
