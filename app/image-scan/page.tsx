"use client"

import {
  CloudUploadIcon,
  ReloadIcon,
  ScanIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useEditorQueue } from "@/hooks/use-editor-queue"
import { useQuadSelection } from "@/hooks/use-quad-selection"
import {
  defaultQuad,
  drawQuadSelection,
  quadOutputSize,
  scaleQuad,
  warpQuadToRect,
  type Quad,
} from "@/lib/canvas"
import { downloadFile, downloadStagger } from "@/lib/download"
import { imageToCanvas, loadImage } from "@/lib/image-file"
import { replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*"

type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
}

async function loadResource(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    return imageToCanvas(await loadImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function ImageScanPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles: addFilesToQueue,
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
    }),
    cleanupJob: (job) => URL.revokeObjectURL(job.previewUrl),
  })
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const { quad, resetQuad, quadHandlers } = useQuadSelection({
    canvasRef: displayCanvasRef,
    render: (quad) => renderDisplay(quad),
  })

  function renderDisplay(quad: Quad | null) {
    const image = getResource()
    const display = displayCanvasRef.current
    if (!image || !display) return
    const ctx = display.getContext("2d")
    if (!ctx) return

    if (display.width !== image.width || display.height !== image.height) {
      display.width = image.width
      display.height = image.height
    }

    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(image, 0, 0)
    if (quad) drawQuadSelection(display, quad)
  }

  // Seed a fresh default quad whenever the active image changes — either a
  // newly picked/switched job, or the same job right after its resource was
  // just replaced by a warped result.
  function reseedQuad(id: number | null) {
    const image = getResource(id ?? undefined)
    if (!image) {
      resetQuad(null)
      return
    }
    resetQuad(defaultQuad(image.width, image.height))
  }

  useEffect(() => {
    reseedQuad(activeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  function clear() {
    clearQueue()
    setError(null)
    setProcessingId(null)
  }

  async function addFiles(fileList: FileList | null | undefined) {
    const { addedCount, failedCount } = await addFilesToQueue(fileList)
    setError(
      addedCount === 0 && failedCount > 0
        ? "None of the selected files could be loaded as images."
        : null
    )
  }

  function scanJob(id: number, cornerQuad: Quad) {
    const image = getResource(id)
    if (!image) return
    const { width, height } = quadOutputSize(cornerQuad)
    const warped = warpQuadToRect(image, cornerQuad, width, height)
    setResource(id, warped)
  }

  async function applyScan() {
    if (activeId == null || !quad) return
    setProcessingId(activeId)
    // Yield a frame so the "Scanning…" state actually paints before the
    // (synchronous, potentially slow) per-pixel warp runs.
    await new Promise((resolve) => setTimeout(resolve, 0))
    scanJob(activeId, quad)
    reseedQuad(activeId)
    setProcessingId(null)
  }

  // Applies the active job's quad to every other queued image, scaled to
  // each image's own dimensions since they aren't necessarily the same size
  // (see Image Crop's "Crop all", which does the same with scaleRect).
  async function applyScanToAll() {
    if (activeId == null || !quad) return
    const activeImage = getResource(activeId)
    if (!activeImage) return

    setProcessingId(activeId)
    await new Promise((resolve) => setTimeout(resolve, 0))
    jobs.forEach((job) => {
      const image = getResource(job.id)
      if (!image) return
      const jobQuad = job.id === activeId ? quad : scaleQuad(quad, activeImage, image)
      scanJob(job.id, jobQuad)
    })
    reseedQuad(activeId)
    setProcessingId(null)
  }

  function resetCorners() {
    reseedQuad(activeId)
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

  async function downloadAll() {
    for (const job of jobs) {
      await downloadJob(job)
      await downloadStagger()
    }
  }

  const anyProcessing = processingId != null

  return (
    <ToolPage
      page="Image Scan"
      icon={ScanIcon}
      onAddFile={jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined}
      onClear={clear}
      footer={
        activeJob
          ? {
              actions: [
                {
                  label: "Reset corners",
                  icon: ReloadIcon,
                  onClick: resetCorners,
                  variant: "ghost",
                  disabled: anyProcessing,
                },
                {
                  label: anyProcessing ? "Scanning…" : "Scan",
                  icon: ScanIcon,
                  onClick: applyScan,
                  disabled: !quad || anyProcessing,
                  more:
                    jobs.length > 1
                      ? {
                          label: "Scan all",
                          icon: ScanIcon,
                          onClick: applyScanToAll,
                          disabled: !quad || anyProcessing,
                        }
                      : undefined,
                },
              ],
              download: {
                onDownload: download,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
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
            <PreviewCard
              jobStrip={jobs.length > 1}
              layer={{
                ref: displayCanvasRef,
                ...quadHandlers,
                className: "touch-none",
              }}
            />
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one image has been picked. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop a photo of a document to upload"
          description="or, click to browse · drag the corners onto the document's edges · in-browser only"
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
