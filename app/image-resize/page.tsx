"use client"

import { CloudUploadIcon, LinkIcon, Resize02Icon } from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { addFilesReportingErrors, useFiles } from "@/hooks/use-files"
import { useLockedSize } from "@/hooks/use-locked-size"
import { downloadCanvas, downloadStagger, outputMime } from "@/lib/download"
import { loadImageAsCanvas } from "@/lib/image-file"

const ACCEPTED = "image/*"

type Result = { canvas: HTMLCanvasElement; width: number; height: number }
type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  // Set once resized, from the original resource so repeated resizes never
  // compound quality loss; null means still showing the original size.
  result: Result | null
}

export default function ImageResizePage() {
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
  const [formError, setFormError] = useState<string | null>(null)

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  // The target width/height apply to every queued image; the aspect lock is
  // derived from the active image's original resource, purely as a
  // convenient reference.
  const activeOriginal = activeJob ? getResource(activeJob.id) : undefined
  const referenceOriginal = activeOriginal
    ? { width: activeOriginal.width, height: activeOriginal.height }
    : null
  const { width, height, lockAspect, onWidthChange, onHeightChange, toggleLockAspect, seed } =
    useLockedSize(referenceOriginal)

  function renderDisplay(source: HTMLCanvasElement | undefined = activeJob?.result?.canvas ?? getResource()) {
    const display = displayCanvasRef.current
    if (!source || !display) return
    if (display.width !== source.width || display.height !== source.height) {
      display.width = source.width
      display.height = source.height
    }
    const ctx = display.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(source, 0, 0)
  }

  // Paint the visible canvas whenever the active job changes, seed the
  // width/height fields from the first image's size once (never again, since
  // the target size is shared across every queued image) — it only exists in
  // the DOM once a file has been picked, so this can't happen synchronously
  // when a file is added.
  useEffect(() => {
    if (activeId == null) return
    renderDisplay()
    seed()
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

  function resizeJob(job: Job, targetWidth: number, targetHeight: number): HTMLCanvasElement | null {
    const base = getResource(job.id)
    if (!base) return null
    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(base, 0, 0, targetWidth, targetHeight)
    return canvas
  }

  function resize() {
    const targetWidth = Math.round(Number(width))
    const targetHeight = Math.round(Number(height))
    if (!targetWidth || !targetHeight || targetWidth < 1 || targetHeight < 1) {
      setFormError("Enter a width and height of at least 1 pixel.")
      return
    }
    setFormError(null)

    let activeCanvas: HTMLCanvasElement | null = null
    jobs.forEach((job) => {
      const canvas = resizeJob(job, targetWidth, targetHeight)
      if (!canvas) return
      updateJob(job.id, { result: { canvas, width: targetWidth, height: targetHeight } })
      if (job.id === activeId) activeCanvas = canvas
    })
    if (activeCanvas) renderDisplay(activeCanvas)
  }

  async function downloadJob(job: Job) {
    if (!job.result) return
    await downloadCanvas(job.result.canvas, job.name, outputMime(job.file.type))
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  // Skips unresized images — downloading them would just hand back the
  // original file.
  async function downloadAll() {
    for (const job of jobs) {
      if (!job.result) continue
      await downloadJob(job)
      await downloadStagger()
    }
  }

  return (
    <ToolPage
      page="Image Resize"
      icon={Resize02Icon}
      onAddFile={jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined}
      fileStrip={
        jobs.length > 0 && (
          <JobStrip jobs={jobs} activeId={activeId} onSelect={setActiveId} onRemove={removeJob} />
        )
      }
      footer={
        activeJob
          ? {
              inputs: [
                { label: "Width", type: "number", min: 1, value: width, onChange: onWidthChange },
                { label: "Height", type: "number", min: 1, value: height, onChange: onHeightChange },
              ],
              actions: [
                {
                  label: lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio",
                  icon: LinkIcon,
                  onClick: toggleLockAspect,
                  variant: lockAspect ? "secondary" : "outline",
                  emphasis: "secondary",
                },
                { label: "Resize", icon: Resize02Icon, onClick: resize },
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
          <div className="flex flex-col gap-4">
            <PreviewCard checkerboard layer={{ ref: displayCanvasRef }} />
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one image has been picked. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop images to upload"
          description="or, click to browse · resize to any resolution · in-browser only"
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
