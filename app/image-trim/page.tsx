"use client"

import { CloudUploadIcon, ScissorRectangleIcon } from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useEditorQueue } from "@/hooks/use-editor-queue"
import { drawSelectionRect, findOpaqueBounds, type Rect } from "@/lib/canvas"
import { downloadFile, downloadStagger } from "@/lib/download"
import { imageToCanvas, loadImage } from "@/lib/image-file"
import { replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*"

type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  // Whether trim has been applied to this job's resource — drives the
  // Download button, since an untrimmed job would just hand back the
  // original file.
  trimmed: boolean
}

async function loadResource(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    return imageToCanvas(await loadImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Null once the image is already tight to its content — nothing to trim. */
function marginRect(image: HTMLCanvasElement): Rect | null {
  const bounds = findOpaqueBounds(image)
  if (!bounds) return null
  if (bounds.width === image.width && bounds.height === image.height) return null
  return bounds
}

export default function ImageTrimPage() {
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
      trimmed: false,
    }),
    cleanupJob: (job) => URL.revokeObjectURL(job.previewUrl),
  })
  const [error, setError] = useState<string | null>(null)

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  // Derived from the active resource, not stored state — it's just a pure
  // read of the current canvas, and re-deriving it after a trim (rather than
  // tracking it separately) is what makes the Trim button disable itself
  // once there's nothing left to trim.
  const pendingRect = activeId == null ? null : computePendingRect()

  function computePendingRect(): Rect | null {
    const image = getResource()
    return image ? marginRect(image) : null
  }

  function renderDisplay(rect: Rect | null) {
    const image = getResource()
    const display = displayCanvasRef.current
    if (!image || !display) return
    if (display.width !== image.width || display.height !== image.height) {
      display.width = image.width
      display.height = image.height
    }
    const ctx = display.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(image, 0, 0)

    if (rect) {
      // Dim the margin that'll be discarded, matching Image Crop's preview.
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
    if (activeId != null) renderDisplay(pendingRect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  function clear() {
    clearQueue()
    setError(null)
  }

  async function addFiles(fileList: FileList | null | undefined) {
    const { addedCount, failedCount } = await addFilesToQueue(fileList)
    setError(
      addedCount === 0 && failedCount > 0
        ? "None of the selected files could be loaded as images."
        : null
    )
  }

  function trimJob(id: number): boolean {
    const image = getResource(id)
    if (!image) return false
    const rect = marginRect(image)
    if (!rect) return false
    const trimmed = document.createElement("canvas")
    trimmed.width = rect.width
    trimmed.height = rect.height
    const ctx = trimmed.getContext("2d")
    if (!ctx) return false
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
    setResource(id, trimmed)
    updateJob(id, { trimmed: true })
    return true
  }

  function applyTrim() {
    if (activeId == null || !trimJob(activeId)) return
    renderDisplay(null)
  }

  // Trims every queued image that has a transparent margin — after this,
  // the active job's resource (if it had one) is tight, so the display
  // needs no dimmed rect.
  function applyTrimToAll() {
    jobs.forEach((job) => trimJob(job.id))
    if (activeId != null) renderDisplay(null)
  }

  async function downloadJob(job: Job) {
    const image = getResource(job.id)
    if (!image) return
    const mime =
      job.file.type && job.file.type.startsWith("image/")
        ? job.file.type
        : "image/png"
    const blob: Blob | null = await new Promise((resolve) =>
      image.toBlob(resolve, mime)
    )
    if (!blob) return
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "png"
    const name = replaceExtension(job.name, ext)
    const url = URL.createObjectURL(blob)
    downloadFile(url, name)
    URL.revokeObjectURL(url)
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  // Skips untrimmed images — downloading them would just hand back the
  // original file.
  async function downloadAll() {
    for (const job of jobs) {
      if (!job.trimmed) continue
      await downloadJob(job)
      await downloadStagger()
    }
  }

  return (
    <ToolPage
      page="Image Trim"
      icon={ScissorRectangleIcon}
      onAddFile={jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined}
      onClear={clear}
      footer={
        activeJob
          ? {
              actions: [
                {
                  label: "Trim",
                  icon: ScissorRectangleIcon,
                  onClick: applyTrim,
                  disabled: !pendingRect,
                },
                jobs.length > 1 && {
                  label: "Trim all",
                  icon: ScissorRectangleIcon,
                  onClick: applyTrimToAll,
                  variant: "outline",
                },
              ],
              download: {
                onDownload: download,
                disabled: !activeJob.trimmed,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
                downloadAllDisabled: !jobs.some((job) => job.trimmed),
              },
            }
          : undefined
      }
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

            <PreviewCard checkerboard layer={{ ref: displayCanvasRef }} />
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one image has been picked. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop images to upload"
          description="or, click to browse · trims transparent margins automatically · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {activeJob && !pendingRect && !activeJob.trimmed && (
          <p className="text-sm text-muted-foreground">
            No transparent margin to trim.
          </p>
        )}
      </div>
    </ToolPage>
  )
}
