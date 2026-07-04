"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AspectRatioIcon,
  Cancel01Icon,
  CloudUploadIcon,
  CropIcon,
  Download04Icon,
  ImageCropIcon,
  RectangularIcon,
  SmartPhone01Icon,
  SquareIcon,
  Tv01Icon,
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
import { useRectSelection } from "@/hooks/use-rect-selection"
import { drawSelectionRect, type Rect } from "@/lib/canvas"
import { formatBytes, replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*"

type Aspect = "free" | "1:1" | "4:3" | "16:9" | "9:16"

// width / height for each locked aspect; free-form has no ratio.
const ASPECT_RATIOS: Record<Aspect, number | null> = {
  free: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
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

export default function ImageCropPage() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [aspect, setAspect] = useState<Aspect>("free")
  const [size, setSize] = useState({ width: 0, height: 0 })
  // Background fill for transparent PNGs; null keeps transparency. It's
  // composited at render/export time (never baked into the image), so it
  // stays adjustable after cropping.
  const [bgColor, setBgColor] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  // `imageCanvas` holds the current image (cropped so far, alpha intact);
  // `displayCanvas` is what's on screen, including the selection preview.
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)

  const isPng = file?.type === "image/png"

  const { pendingRect, clearSelection, selectionHandlers } = useRectSelection({
    canvasRef: displayCanvasRef,
    ratio: ASPECT_RATIOS[aspect],
    render: (rect) => renderDisplay(rect),
  })

  function renderDisplay(rect?: Rect | null, color: string | null = bgColor) {
    const image = imageCanvasRef.current
    const display = displayCanvasRef.current
    if (!image || !display) return
    const ctx = display.getContext("2d")
    if (!ctx) return

    // Keep the visible canvas's internal resolution in sync with the image —
    // it may have just mounted, or the image may have just been cropped.
    if (display.width !== image.width || display.height !== image.height) {
      display.width = image.width
      display.height = image.height
    }

    ctx.clearRect(0, 0, display.width, display.height)
    if (color) {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, display.width, display.height)
    }
    ctx.drawImage(image, 0, 0)

    if (rect && rect.width > 0 && rect.height > 0) {
      // Dim everything outside the selection.
      ctx.save()
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
      ctx.beginPath()
      ctx.rect(0, 0, display.width, display.height)
      ctx.rect(rect.x, rect.y, rect.width, rect.height)
      ctx.fill("evenodd")
      ctx.restore()
      drawSelectionRect(display, rect)
    }
  }

  // Paint the visible canvas after it mounts — it only exists in the DOM
  // once a file has been picked, so this can't happen in addFile itself.
  useEffect(() => {
    if (file) renderDisplay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  function reset() {
    setFile(null)
    setError(null)
    setBgColor(null)
    setSize({ width: 0, height: 0 })
    imageCanvasRef.current = null
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
      const image = document.createElement("canvas")
      image.width = img.naturalWidth
      image.height = img.naturalHeight
      const ctx = image.getContext("2d")
      if (!ctx) throw new Error("Canvas isn't supported in this browser.")
      ctx.drawImage(img, 0, 0)
      imageCanvasRef.current = image

      // The visible canvas mounts on this state change; the effect above
      // paints it once it exists.
      setFile(picked)
      setError(null)
      setBgColor(null)
      setSize({ width: image.width, height: image.height })
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

  function applyCrop() {
    const image = imageCanvasRef.current
    if (!image || !pendingRect) return
    const rect = {
      x: Math.round(pendingRect.x),
      y: Math.round(pendingRect.y),
      width: Math.max(1, Math.round(pendingRect.width)),
      height: Math.max(1, Math.round(pendingRect.height)),
    }
    const cropped = document.createElement("canvas")
    cropped.width = rect.width
    cropped.height = rect.height
    const ctx = cropped.getContext("2d")
    if (!ctx) return
    ctx.drawImage(
      image,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height
    )
    imageCanvasRef.current = cropped
    setSize({ width: cropped.width, height: cropped.height })
    clearSelection()
  }

  function onColorChange(color: string | null) {
    setBgColor(color)
    renderDisplay(pendingRect, color)
  }

  // A pending selection made under the old ratio no longer matches the new
  // one, so drop it rather than silently distorting it.
  function onAspectChange(value: Aspect) {
    setAspect(value)
    clearSelection()
  }

  async function download() {
    const image = imageCanvasRef.current
    if (!image || !file) return
    const out = document.createElement("canvas")
    out.width = image.width
    out.height = image.height
    const ctx = out.getContext("2d")
    if (!ctx) return
    if (bgColor) {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, out.width, out.height)
    }
    ctx.drawImage(image, 0, 0)

    const mime =
      file.type && file.type.startsWith("image/") ? file.type : "image/png"
    const blob: Blob | null = await new Promise((resolve) =>
      out.toBlob(resolve, mime)
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

  return (
    <ToolPage
      page="Image Crop"
      icon={ImageCropIcon}
      segments={{
        value: aspect,
        onValueChange: (value) => onAspectChange(value as Aspect),
        options: [
          { value: "free", label: "Free", icon: AspectRatioIcon },
          { value: "1:1", label: "1:1", icon: SquareIcon },
          { value: "4:3", label: "4:3", icon: Tv01Icon },
          { value: "16:9", label: "16:9", icon: RectangularIcon },
          { value: "9:16", label: "9:16", icon: SmartPhone01Icon },
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
              <div className="flex max-h-[60vh] items-center justify-center">
                {/* Checkerboard behind the canvas so PNG transparency (and
                    the effect of the background colour) is visible. */}
                <div className="max-h-full rounded-md bg-[length:16px_16px] [background-image:repeating-conic-gradient(#00000014_0%_25%,transparent_0%_50%)]">
                  <canvas
                    ref={displayCanvasRef}
                    {...selectionHandlers}
                    className="block max-h-[calc(60vh-1rem)] max-w-full cursor-crosshair touch-none select-none"
                  />
                </div>
              </div>
            </Card>
            <p className="text-sm text-muted-foreground">
              {file.name} · {size.width} × {size.height} ·{" "}
              {formatBytes(file.size)} · drag a rectangle to select the crop
              area · drag inside the selection to move it, or its edges to
              resize
            </p>

            <div className="flex flex-wrap items-center gap-4">
              {isPng && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Background
                  </span>
                  <input
                    type="color"
                    value={bgColor ?? "#ffffff"}
                    onChange={(e) => onColorChange(e.target.value)}
                    aria-label="Background color"
                    className="size-8 cursor-pointer rounded-md border bg-transparent p-1"
                  />
                  {bgColor ? (
                    <Button variant="ghost" onClick={() => onColorChange(null)}>
                      <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
                      Transparent
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      transparent
                    </span>
                  )}
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                {pendingRect && (
                  <Button variant="ghost" onClick={clearSelection}>
                    <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
                    Cancel selection
                  </Button>
                )}
                <Button onClick={applyCrop} disabled={!pendingRect}>
                  <HugeiconsIcon icon={CropIcon} aria-hidden />
                  Crop
                </Button>
                <Button variant="secondary" onClick={download}>
                  <HugeiconsIcon icon={Download04Icon} aria-hidden />
                  Download
                </Button>
              </div>
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
                  Crop any image · set a background colour on PNGs ·
                  in-browser only
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
