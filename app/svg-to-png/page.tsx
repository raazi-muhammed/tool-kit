"use client"

import {
  Cancel01Icon,
  CloudUploadIcon,
  LinkIcon,
  Png01Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { useAutoRunEnabled } from "@/components/auto-run-preference"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { addFilesReportingErrors, useFiles } from "@/hooks/use-files"
import { useLockedSize } from "@/hooks/use-locked-size"
import { downloadCanvas, downloadStagger } from "@/lib/download"
import { loadImage } from "@/lib/image-file"

const ACCEPTED = "image/svg+xml,.svg"

type Result = { canvas: HTMLCanvasElement; width: number; height: number }
type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  // Set once converted, from the original SVG resource so repeated
  // conversions never compound quality loss; null means not converted yet.
  result: Result | null
}

async function loadResource(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function SvgToPngPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles: addFilesToQueue,
    updateJob,
    removeJob,
    getResource,
  } = useFiles<Job, HTMLImageElement>({
    loadResource,
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
  const [bgColor, setBgColor] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { enabled: autoRunEnabled } = useAutoRunEnabled()

  const convertedCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  // The target width/height apply to every queued SVG; the aspect lock is
  // derived from the active SVG's intrinsic size, purely as a convenient
  // reference.
  const activeResource = activeJob ? getResource(activeJob.id) : undefined
  const referenceOriginal = activeResource
    ? {
        width: activeResource.naturalWidth,
        height: activeResource.naturalHeight,
      }
    : null
  const {
    width,
    height,
    lockAspect,
    onWidthChange,
    onHeightChange,
    toggleLockAspect,
    seed,
  } = useLockedSize(referenceOriginal)

  function paintConverted(
    source: HTMLCanvasElement | HTMLImageElement | undefined
  ) {
    const canvas = convertedCanvasRef.current
    if (!source || !canvas) return
    const w =
      source instanceof HTMLImageElement ? source.naturalWidth : source.width
    const h =
      source instanceof HTMLImageElement ? source.naturalHeight : source.height
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(source, 0, 0)
  }

  // Paint the visible canvas whenever the active job changes, seed the
  // width/height fields from the first SVG's intrinsic size once (never
  // again, since the target size is shared across every queued SVG) — it
  // only exists in the DOM once a file has been picked, so this can't happen
  // synchronously when a file is added.
  useEffect(() => {
    if (activeId == null) return
    paintConverted(activeJob?.result?.canvas ?? activeResource)
    seed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  function addFiles(fileList: FileList | null | undefined) {
    return addFilesReportingErrors(
      addFilesToQueue,
      fileList,
      "None of the selected files could be loaded as SVGs.",
      setError
    )
  }

  function convertJob(
    job: Job,
    targetWidth: number,
    targetHeight: number,
    bg: string | null
  ): HTMLCanvasElement | null {
    const img = getResource(job.id)
    if (!img) return null
    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, targetWidth, targetHeight)
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
    return canvas
  }

  function convert() {
    const targetWidth = Math.round(Number(width))
    const targetHeight = Math.round(Number(height))
    if (!targetWidth || !targetHeight || targetWidth < 1 || targetHeight < 1) {
      setFormError("Enter a width and height of at least 1 pixel.")
      return
    }
    setFormError(null)

    let activeCanvas: HTMLCanvasElement | null = null
    jobs.forEach((job) => {
      const canvas = convertJob(job, targetWidth, targetHeight, bgColor)
      if (!canvas) return
      updateJob(job.id, {
        result: { canvas, width: targetWidth, height: targetHeight },
      })
      if (job.id === activeId) activeCanvas = canvas
    })
    if (activeCanvas) paintConverted(activeCanvas)
  }

  // With "Run automatically" on, re-convert every queued SVG whenever the
  // target width/height/background changes, instead of requiring an
  // explicit Convert click — debounced so typing a new value doesn't
  // redraw on every keystroke, only once it settles.
  useDebouncedEffect(
    () => {
      if (!autoRunEnabled || jobs.length === 0) return
      convert()
    },
    [autoRunEnabled, width, height, bgColor, jobs.length]
  )

  async function downloadJob(job: Job) {
    if (!job.result) return
    await downloadCanvas(job.result.canvas, job.name, "image/png")
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  // Skips unconverted SVGs — downloading them would just hand back an empty result.
  async function downloadAll() {
    for (const job of jobs) {
      if (!job.result) continue
      await downloadJob(job)
      await downloadStagger()
    }
  }

  return (
    <ToolPage
      page="SVG to PNG"
      icon={Png01Icon}
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
                nullLabel: "transparent",
                clearLabel: "Transparent",
                clearIcon: Cancel01Icon,
              },
              inputs: [
                {
                  label: "Width",
                  type: "number",
                  min: 1,
                  value: width,
                  onChange: onWidthChange,
                },
                {
                  label: "Height",
                  type: "number",
                  min: 1,
                  value: height,
                  onChange: onHeightChange,
                },
              ],
              actions: [
                {
                  label: lockAspect
                    ? "Unlock aspect ratio"
                    : "Lock aspect ratio",
                  icon: LinkIcon,
                  onClick: toggleLockAspect,
                  variant: lockAspect ? "secondary" : "outline",
                },
                !autoRunEnabled && {
                  label: "Convert",
                  icon: Png01Icon,
                  onClick: convert,
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
            {/* Original SVG (left) and rasterized PNG preview (right), side by
                side. The converted canvas is rendered at the user's target
                width/height (which can be far bigger than the viewport), so
                the layer stretches to the fill container (`h-full w-full`)
                and lets `object-contain` scale its content down to fit
                without cropping — more robust than `max-h-full`/`max-w-full`
                alone, since it doesn't depend on the container having settled
                on a definite height first. */}
            <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
              <PreviewCard
                fill
                checkerboard
                title="Original"
                layer={{
                  kind: "image",
                  src: activeJob.previewUrl,
                  alt: activeJob.name,
                  className: "h-full w-full object-contain",
                }}
              />

              <PreviewCard
                fill
                checkerboard
                title="Converted"
                layer={{
                  ref: convertedCanvasRef,
                  className: "h-full w-full object-contain",
                }}
              />
            </div>
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one file has been added. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop an SVG to upload"
          description="or, click to browse · convert to PNG at any resolution · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </div>
    </ToolPage>
  )
}
