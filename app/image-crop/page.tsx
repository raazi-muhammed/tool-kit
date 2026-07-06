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

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { ToolPage } from "@/components/tool-page"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useEditorQueue } from "@/hooks/use-editor-queue"
import { useRectSelection } from "@/hooks/use-rect-selection"
import { drawSelectionRect, type Rect } from "@/lib/canvas"
import { imageToCanvas, loadImage } from "@/lib/image-file"
import { replaceExtension } from "@/lib/wav"

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

type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  // Background fill for transparent PNGs; null keeps transparency. It's
  // composited at render/export time (never baked into the image), so it
  // stays adjustable after cropping.
  bgColor: string | null
}

async function loadResource(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    return imageToCanvas(await loadImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function ImageCropPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles: addFilesToQueue,
    updateJob,
    removeJob,
    clear: clearQueue,
    getResource,
    setResource,
  } = useEditorQueue<Job, HTMLCanvasElement>({
    loadResource,
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      bgColor: null,
    }),
    cleanupJob: (job) => URL.revokeObjectURL(job.previewUrl),
  })
  const [error, setError] = useState<string | null>(null)
  const [aspect, setAspect] = useState<Aspect>("free")

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const isPng = activeJob?.file.type === "image/png"

  const { pendingRect, clearSelection, selectionHandlers } = useRectSelection({
    canvasRef: displayCanvasRef,
    ratio: ASPECT_RATIOS[aspect],
    render: (rect) => renderDisplay(rect),
  })

  function renderDisplay(
    rect?: Rect | null,
    color: string | null = activeJob?.bgColor ?? null
  ) {
    const image = getResource()
    const display = displayCanvasRef.current
    if (!image || !display) return
    const ctx = display.getContext("2d")
    if (!ctx) return

    // Keep the visible canvas's internal resolution in sync with the image —
    // it may have just mounted, switched jobs, or just been cropped.
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

  // Paint the visible canvas whenever the active job changes — it only
  // exists in the DOM once a file has been picked, so this can't happen
  // synchronously when a file is added.
  useEffect(() => {
    if (activeId != null) clearSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  function clear() {
    clearQueue()
    setError(null)
    clearSelection()
  }

  async function addFiles(fileList: FileList | null | undefined) {
    const { addedCount, failedCount } = await addFilesToQueue(fileList)
    setError(
      addedCount === 0 && failedCount > 0
        ? "None of the selected files could be loaded as images."
        : null
    )
  }

  function applyCrop() {
    if (activeId == null || !pendingRect) return
    const image = getResource()
    if (!image) return
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
    setResource(activeId, cropped)
    clearSelection()
  }

  function onColorChange(color: string | null) {
    if (activeId == null) return
    updateJob(activeId, { bgColor: color })
    renderDisplay(pendingRect, color)
  }

  // A pending selection made under the old ratio no longer matches the new
  // one, so drop it rather than silently distorting it.
  function onAspectChange(value: Aspect) {
    setAspect(value)
    clearSelection()
  }

  async function download() {
    if (!activeJob) return
    const image = getResource()
    if (!image) return
    const out = document.createElement("canvas")
    out.width = image.width
    out.height = image.height
    const ctx = out.getContext("2d")
    if (!ctx) return
    if (activeJob.bgColor) {
      ctx.fillStyle = activeJob.bgColor
      ctx.fillRect(0, 0, out.width, out.height)
    }
    ctx.drawImage(image, 0, 0)

    const mime =
      activeJob.file.type && activeJob.file.type.startsWith("image/")
        ? activeJob.file.type
        : "image/png"
    const blob: Blob | null = await new Promise((resolve) =>
      out.toBlob(resolve, mime)
    )
    if (!blob) return
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "png"
    const name = replaceExtension(activeJob.name, ext)
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
      actions={
        jobs.length > 0 && (
          <Button variant="outline" onClick={() => dropzoneRef.current?.open()}>
            <HugeiconsIcon icon={CloudUploadIcon} aria-hidden />
            Add file
          </Button>
        )
      }
      onClear={clear}
    >
      <div className="flex flex-1 flex-col gap-4">
        {activeJob && (
          <div className="flex flex-col gap-4">
            <JobStrip
              jobs={jobs}
              activeId={activeId}
              onSelect={setActiveId}
              onRemove={removeJob}
            />

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

            <div className="flex flex-wrap items-center gap-4">
              {isPng && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Background
                  </span>
                  <input
                    type="color"
                    value={activeJob.bgColor ?? "#ffffff"}
                    onChange={(e) => onColorChange(e.target.value)}
                    aria-label="Background color"
                    className="size-8 cursor-pointer rounded-md border bg-transparent p-1"
                  />
                  {activeJob.bgColor ? (
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
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one image has been picked. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop images to upload"
          description="or, click to browse · set a background colour on PNGs · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </ToolPage>
  )
}
