"use client"

import { CloudUploadIcon, LinkIcon, Resize02Icon } from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useEditorQueue } from "@/hooks/use-editor-queue"
import { downloadFile, downloadStagger } from "@/lib/download"
import { imageToCanvas, loadImage } from "@/lib/image-file"
import { replaceExtension } from "@/lib/wav"

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

async function loadResource(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    return imageToCanvas(await loadImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
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
    clear: clearQueue,
    getResource,
  } = useEditorQueue<Job, HTMLCanvasElement>({
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
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [lockAspect, setLockAspect] = useState(true)
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
    if (!width && !height && referenceOriginal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(String(referenceOriginal.width))
      setHeight(String(referenceOriginal.height))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  function clear() {
    clearQueue()
    setWidth("")
    setHeight("")
    setFormError(null)
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

  function onWidthChange(value: string) {
    setWidth(value)
    const parsed = Number(value)
    if (lockAspect && referenceOriginal && parsed > 0) {
      setHeight(
        String(
          Math.max(
            1,
            Math.round(parsed * (referenceOriginal.height / referenceOriginal.width))
          )
        )
      )
    }
  }

  function onHeightChange(value: string) {
    setHeight(value)
    const parsed = Number(value)
    if (lockAspect && referenceOriginal && parsed > 0) {
      setWidth(
        String(
          Math.max(
            1,
            Math.round(parsed * (referenceOriginal.width / referenceOriginal.height))
          )
        )
      )
    }
  }

  function toggleLockAspect() {
    // Re-derive height from the current width so re-locking snaps back to
    // the reference ratio instead of carrying over a distorted size.
    if (!lockAspect && referenceOriginal) {
      const parsedWidth = Number(width)
      if (parsedWidth > 0) {
        setHeight(
          String(
            Math.max(
              1,
              Math.round(
                parsedWidth * (referenceOriginal.height / referenceOriginal.width)
              )
            )
          )
        )
      }
    }
    setLockAspect(!lockAspect)
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
    const mime =
      job.file.type && job.file.type.startsWith("image/")
        ? job.file.type
        : "image/png"
    const blob: Blob | null = await new Promise((resolve) =>
      job.result!.canvas.toBlob(resolve, mime)
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
      onClear={clear}
      footer={
        activeJob
          ? {
              inputs: [
                { label: "", type: "number", min: 1, value: width, onChange: onWidthChange },
                { label: "", type: "number", min: 1, value: height, onChange: onHeightChange },
              ],
              actions: [
                {
                  label: lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio",
                  icon: LinkIcon,
                  onClick: toggleLockAspect,
                  variant: lockAspect ? "secondary" : "outline",
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
            <JobStrip
              jobs={jobs}
              activeId={activeId}
              onSelect={setActiveId}
              onRemove={removeJob}
            />

            <PreviewCard checkerboard jobStrip={jobs.length > 1} layer={{ ref: displayCanvasRef }} />
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
