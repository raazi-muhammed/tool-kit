"use client"

import {
  Cancel01Icon,
  CloudUploadIcon,
  SquareIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { addFilesReportingErrors, useFiles } from "@/hooks/use-files"
import { prepareDisplayCanvas } from "@/lib/canvas"
import { downloadAllJobs, downloadCanvas, outputMime } from "@/lib/download"
import { loadImageAsCanvas } from "@/lib/image-file"

const ACCEPTED = "image/*"

type Result = { canvas: HTMLCanvasElement; size: number; transparent: boolean }
type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  // Set once generated, from the original resource so repeated generations
  // never compound quality loss; null means still showing the original.
  result: Result | null
}

export default function SquareImageGeneratorPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles: addFilesToQueue,
    updateJob,
    removeJob,
    getResource,
  } = useFiles<Job, HTMLCanvasElement>({
    loadResource: loadImageAsCanvas,
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      result: null,
    }),
    cleanupJob: (job) => URL.revokeObjectURL(job.previewUrl),
  })
  const [error, setError] = useState<string | null>(null)
  const [size, setSize] = useState("")
  // Fill behind the padded image; null keeps it transparent (forcing PNG
  // output on download, since the source format may not support alpha).
  const [bgColor, setBgColor] = useState<string | null>("#ffffff")

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  // The target size applies to every queued image; seeded once from the
  // active image's own dimensions, purely as a convenient starting point.
  const activeOriginal = activeJob ? getResource(activeJob.id) : undefined
  // Purely derived from `size`, so it doesn't need its own state — shown
  // inline instead of gating the (removed) explicit apply button.
  const parsedSize = Math.round(Number(size))
  const sizeError =
    size !== "" && (!Number.isFinite(parsedSize) || parsedSize < 1)
      ? "Enter a size of at least 1 pixel."
      : null

  function renderDisplay(
    source: HTMLCanvasElement | undefined = activeJob?.result?.canvas ??
      getResource()
  ) {
    const display = displayCanvasRef.current
    if (!source || !display) return
    const ctx = prepareDisplayCanvas(display, source)
    if (!ctx) return
    ctx.drawImage(source, 0, 0)
  }

  function squareJob(job: Job, targetSize: number): HTMLCanvasElement | null {
    const base = getResource(job.id)
    if (!base) return null
    const canvas = document.createElement("canvas")
    canvas.width = targetSize
    canvas.height = targetSize
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    // Fit the whole image inside the square, centered, padding the rest
    // with the background color.
    if (bgColor) {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, targetSize, targetSize)
    }
    const scale = targetSize / Math.max(base.width, base.height)
    const dw = base.width * scale
    const dh = base.height * scale
    ctx.drawImage(
      base,
      0,
      0,
      base.width,
      base.height,
      (targetSize - dw) / 2,
      (targetSize - dh) / 2,
      dw,
      dh
    )
    return canvas
  }

  // Paint the visible canvas whenever the active job changes, seed the size
  // field from the first image's larger dimension once (never again, since
  // the target size is shared across every queued image) — it only exists
  // in the DOM once a file has been picked, so this can't happen
  // synchronously when a file is added.
  useEffect(() => {
    if (activeId == null) return
    renderDisplay()
    if (!size && activeOriginal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSize(String(Math.max(activeOriginal.width, activeOriginal.height)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Regenerate every queued image automatically whenever the size or
  // background changes (or a new file is added), instead of requiring an
  // explicit Generate click. Debounced so dragging the color picker or
  // typing a size (many updates a second) doesn't redraw on every tick —
  // only once the value settles.
  useDebouncedEffect(() => {
    if (jobs.length === 0 || sizeError || !parsedSize) return
    const transparent = !bgColor
    let activeCanvas: HTMLCanvasElement | null = null
    jobs.forEach((job) => {
      const canvas = squareJob(job, parsedSize)
      if (!canvas) return
      updateJob(job.id, { result: { canvas, size: parsedSize, transparent } })
      if (job.id === activeId) activeCanvas = canvas
    })
    if (activeCanvas) renderDisplay(activeCanvas)
  }, [parsedSize, sizeError, bgColor, jobs.length])

  function addFiles(fileList: FileList | null | undefined) {
    return addFilesReportingErrors(
      addFilesToQueue,
      fileList,
      "None of the selected files could be loaded as images.",
      setError
    )
  }

  async function downloadJob(job: Job) {
    if (!job.result) return
    const mime = job.result.transparent
      ? "image/png"
      : outputMime(job.file.type)
    await downloadCanvas(job.result.canvas, job.name, mime)
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  // Skips ungenerated images — downloading them would just hand back the
  // original file.
  function downloadAll() {
    return downloadAllJobs(jobs, (job) => !!job.result, downloadJob)
  }

  return (
    <ToolPage
      page="Square Image Generator"
      icon={SquareIcon}
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
              color: {
                label: "Background",
                value: bgColor,
                onChange: setBgColor,
                fallback: "#ffffff",
              },
              inputs: [
                {
                  label: "Size",
                  type: "number",
                  min: 1,
                  value: size,
                  onChange: setSize,
                },
              ],
              download: {
                onDownload: download,
                disabled: !activeJob.result,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
                downloadAllDisabled: !jobs.some((job) => job.result),
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
                className: "h-full w-full object-contain",
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
          description="or, click to browse · fit any image to a square · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {sizeError && <p className="text-sm text-destructive">{sizeError}</p>}
      </div>
    </ToolPage>
  )
}
