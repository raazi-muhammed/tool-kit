"use client"

import { Cancel01Icon, CloudUploadIcon, SquareRoundCornerIcon } from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { addFilesReportingErrors, useFiles } from "@/hooks/use-files"
import { roundCorners } from "@/lib/canvas"
import { downloadCanvas, downloadStagger, outputMime } from "@/lib/download"
import { loadImageAsCanvas } from "@/lib/image-file"

const ACCEPTED = "image/*"

type Result = { canvas: HTMLCanvasElement; radiusPercent: number; transparent: boolean }
type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  // Set once generated, from the original resource so repeated generations
  // never compound quality loss; null means still showing the original.
  result: Result | null
}

export default function ImageRoundCornersPage() {
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
  // A percentage of each image's own smaller dimension (so the same value
  // reads the same way regardless of the image's pixel size) — 100% rounds
  // all the way to a pill/circle.
  const [radiusPercent, setRadiusPercent] = useState(6)
  // Fill behind the cut-away corners; null keeps them transparent (forcing
  // PNG output on download, since the source format may not support alpha).
  const [bgColor, setBgColor] = useState<string | null>(null)

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

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

  // Paint the visible canvas whenever the active job changes.
  useEffect(() => {
    if (activeId == null) return
    renderDisplay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Regenerate every queued image automatically whenever the radius or
  // background changes (or a new file is added), instead of requiring an
  // explicit apply click. Debounced so dragging the slider or color picker
  // (many updates a second) doesn't redraw on every tick — only once the
  // value settles.
  useDebouncedEffect(() => {
    if (jobs.length === 0) return
    const transparent = !bgColor
    let activeCanvas: HTMLCanvasElement | null = null
    jobs.forEach((job) => {
      const base = getResource(job.id)
      if (!base) return
      const radiusPx = ((radiusPercent / 100) * Math.min(base.width, base.height)) / 2
      const canvas = roundCorners(base, radiusPx, bgColor)
      updateJob(job.id, { result: { canvas, radiusPercent, transparent } })
      if (job.id === activeId) activeCanvas = canvas
    })
    if (activeCanvas) renderDisplay(activeCanvas)
  }, [radiusPercent, bgColor, jobs.length])

  function clear() {
    clearQueue()
    setRadiusPercent(6)
    setError(null)
  }

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
    const mime = job.result.transparent ? "image/png" : outputMime(job.file.type)
    await downloadCanvas(job.result.canvas, job.name, mime)
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  // Skips ungenerated images — downloading them would just hand back the
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
      page="Image Round Corners"
      icon={SquareRoundCornerIcon}
      onAddFile={jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined}
      onClear={clear}
      fileStrip={
        jobs.length > 1 && (
          <JobStrip jobs={jobs} activeId={activeId} onSelect={setActiveId} onRemove={removeJob} />
        )
      }
      footer={
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
              slider: {
                label: "Radius",
                value: radiusPercent,
                onValueChange: setRadiusPercent,
                min: 0,
                max: 100,
                unit: "%",
              },
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
          description="or, click to browse · round any image's corners · in-browser only"
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
