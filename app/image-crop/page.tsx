"use client"

import {
  AspectRatioIcon,
  Cancel01Icon,
  CloudUploadIcon,
  CropIcon,
  Image02Icon,
  ImageCropIcon,
  RectangularIcon,
  SmartPhone01Icon,
  SquareIcon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { useEngine } from "@/components/auto-run-preference"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { addFilesReportingErrors, useFiles } from "@/hooks/use-files"
import { useRectSelection } from "@/hooks/use-rect-selection"
import {
  drawSelectionRect,
  prepareDisplayCanvas,
  scaleRect,
  type Rect,
} from "@/lib/canvas"
import {
  canvasBlobNamed,
  downloadAllJobs,
  downloadFile,
  downloadJobsAsZip,
  outputMime,
  type ZipEntry,
} from "@/lib/download"
import { loadImageAsCanvas } from "@/lib/image-file"
import { getTool } from "@/lib/tools"

const ACCEPTED = "image/*"
type Aspect = "free" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16"

// width / height for each locked aspect; free-form has no ratio.
const ASPECT_RATIOS: Record<Aspect, number | null> = {
  free: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
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
  // Independent per file, like Image Converter's format.
  aspect: Aspect
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
    getResource,
    setResource,
  } = useFiles<Job, HTMLCanvasElement>({
    loadResource: loadImageAsCanvas,
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      bgColor: null,
      aspect: "free",
    }),
    cleanupJob: (job) => URL.revokeObjectURL(job.previewUrl),
  })
  const [error, setError] = useState<string | null>(null)

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const isPng = activeJob?.file.type === "image/png"

  const { pendingRect, clearSelection, selectionHandlers } = useRectSelection({
    canvasRef: displayCanvasRef,
    ratio: ASPECT_RATIOS[activeJob?.aspect ?? "free"],
    render: (rect) => renderDisplay(rect),
  })

  function renderDisplay(
    rect?: Rect | null,
    color: string | null = activeJob?.bgColor ?? null
  ) {
    const image = getResource()
    const display = displayCanvasRef.current
    if (!image || !display) return
    const ctx = prepareDisplayCanvas(display, image)
    if (!ctx) return

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

  // The "Run automatically" engine — whether this tool defers baking
  // instead of the default eager bake-on-settle is declared once, in this
  // tool's own lib/tools.ts entry, and read back here rather than
  // duplicated as a literal. Deferred keeps a drawn rectangle movable
  // indefinitely; `applyCrop` both bakes and clears the current selection,
  // so it doubles as the "commit before switching away" fallback in that
  // mode. See `useEngine` in auto-run-preference.tsx.
  const { autoRunEnabled, commitBeforeSwitch } = useEngine({
    activeId,
    pendingRect,
    hasPending: () => !!pendingRect,
    commit: applyCrop,
    defersBake: getTool("/image-crop").autoRunDefersBake,
  })

  // Paint the visible canvas whenever the active job changes — it only
  // exists in the DOM once a file has been picked, so this can't happen
  // synchronously when a file is added.
  useEffect(() => {
    commitBeforeSwitch(activeId)
    if (activeId != null) clearSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  function addFiles(fileList: FileList | null | undefined) {
    return addFilesReportingErrors(
      addFilesToQueue,
      fileList,
      "None of the selected files could be loaded as images.",
      setError
    )
  }

  function buildCroppedCanvas(
    image: HTMLCanvasElement,
    rect: Rect
  ): HTMLCanvasElement | null {
    const clamped = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    }
    const cropped = document.createElement("canvas")
    cropped.width = clamped.width
    cropped.height = clamped.height
    const ctx = cropped.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(
      image,
      clamped.x,
      clamped.y,
      clamped.width,
      clamped.height,
      0,
      0,
      clamped.width,
      clamped.height
    )
    return cropped
  }

  function cropJob(id: number, rect: Rect) {
    const image = getResource(id)
    if (!image) return
    const cropped = buildCroppedCanvas(image, rect)
    if (cropped) setResource(id, cropped)
  }

  // Bakes (and clears) whatever's pending for `id` — the active job by
  // default, for the manual "Crop" button, but also callable for a job
  // other than the active one (see `useEngine` above).
  function applyCrop(id: number | null = activeId) {
    if (id == null || !pendingRect) return
    cropJob(id, pendingRect)
    clearSelection()
  }

  // Applies the current selection to every queued image, scaled to each
  // image's own dimensions since they aren't necessarily the same size.
  function applyCropToAll() {
    if (activeId == null || !pendingRect) return
    const activeImage = getResource(activeId)
    if (!activeImage) return

    jobs.forEach((job) => {
      const image = getResource(job.id)
      if (!image) return
      cropJob(job.id, scaleRect(pendingRect, activeImage, image))
    })
    clearSelection()
  }

  // Renders a job's export image without mutating its stored resource: for
  // the active job with a pending (not-yet-applied) selection, the crop is
  // resolved onto a scratch canvas so the on-screen rectangle stays exactly
  // as movable after downloading as it was before.
  function exportCanvasForJob(job: Job): HTMLCanvasElement | null {
    const image = getResource(job.id)
    if (!image) return null
    if (job.id !== activeId || !pendingRect) return image
    return buildCroppedCanvas(image, pendingRect) ?? image
  }

  function onColorChange(color: string | null) {
    if (activeId == null) return
    updateJob(activeId, { bgColor: color })
    renderDisplay(pendingRect, color)
  }

  // A pending selection made under the old ratio no longer matches the new
  // one, so drop it rather than silently distorting it. Only the active
  // job's own aspect changes — other queued files keep theirs.
  function onAspectChange(value: Aspect) {
    if (activeId == null) return
    updateJob(activeId, { aspect: value })
    clearSelection()
  }

  function blobForJob(job: Job): Promise<ZipEntry | null> {
    const image = exportCanvasForJob(job)
    if (!image) return Promise.resolve(null)
    const out = document.createElement("canvas")
    out.width = image.width
    out.height = image.height
    const ctx = out.getContext("2d")
    if (!ctx) return Promise.resolve(null)
    if (job.bgColor) {
      ctx.fillStyle = job.bgColor
      ctx.fillRect(0, 0, out.width, out.height)
    }
    ctx.drawImage(image, 0, 0)

    return canvasBlobNamed(out, job.name, outputMime(job.file.type))
  }

  async function downloadJob(job: Job) {
    const entry = await blobForJob(job)
    if (!entry) return
    const url = URL.createObjectURL(entry.blob)
    downloadFile(url, entry.name)
    URL.revokeObjectURL(url)
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  function downloadAll() {
    return downloadAllJobs(jobs, () => true, downloadJob)
  }

  function downloadZip() {
    return downloadJobsAsZip(jobs, () => true, blobForJob, "cropped-images.zip")
  }

  return (
    <ToolPage
      page="Image Crop"
      icon={ImageCropIcon}
      onAddFile={jobs.length > 0 ? dropzoneRef : undefined}
      fileStrip={
        jobs.length > 0 && (
          <JobStrip
            jobs={jobs}
            activeId={activeId}
            onSelect={setActiveId}
            onRemove={removeJob}
          />
        )
      }
      sidebar={
        activeJob
          ? {
              segments: {
                value: activeJob.aspect,
                onValueChange: (value) => onAspectChange(value as Aspect),
                label: "Aspect ratio",
                options: [
                  { value: "free", label: "Free", icon: AspectRatioIcon },
                  { value: "1:1", label: "1:1", icon: SquareIcon },
                  { value: "4:3", label: "4:3", icon: Tv01Icon },
                  { value: "3:4", label: "3:4", icon: Image02Icon },
                  { value: "16:9", label: "16:9", icon: RectangularIcon },
                  { value: "9:16", label: "9:16", icon: SmartPhone01Icon },
                ],
              },
              color: isPng
                ? {
                    label: "Background",
                    value: activeJob.bgColor,
                    onChange: onColorChange,
                    fallback: "#ffffff",
                    nullLabel: "transparent",
                    clearLabel: "Transparent",
                    clearIcon: Cancel01Icon,
                  }
                : undefined,
              actions: [
                pendingRect && {
                  label: "Cancel selection",
                  icon: Cancel01Icon,
                  onClick: clearSelection,
                  variant: "outline",
                },
                !autoRunEnabled && {
                  label: "Crop",
                  icon: CropIcon,
                  onClick: () => applyCrop(),
                  disabled: !pendingRect,
                  more:
                    jobs.length > 1
                      ? {
                          label: "Crop all",
                          icon: CropIcon,
                          onClick: applyCropToAll,
                          disabled: !pendingRect,
                        }
                      : undefined,
                },
              ],
              download: {
                onDownload: download,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
                onDownloadZip: jobs.length > 1 ? downloadZip : undefined,
              },
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {activeJob && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <PreviewCard
              fill
              checkerboard
              layer={{
                ref: displayCanvasRef,
                ...selectionHandlers,
                className:
                  "h-full w-full cursor-crosshair touch-none object-contain",
              }}
            />
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
