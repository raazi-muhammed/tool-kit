"use client"

import {
  CloudUploadIcon,
  ImageRotationClockwiseIcon,
  RotateCcwSquareIcon,
  RotateCwSquareIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { addFilesReportingErrors, useFiles } from "@/hooks/use-files"
import { rotateCanvas } from "@/lib/canvas"
import { downloadCanvas, downloadStagger, outputMime } from "@/lib/download"
import { loadImageAsCanvas } from "@/lib/image-file"

const ACCEPTED = "image/*"

type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  // Clockwise degrees, composited at render/export time (never baked into
  // the resource), so it stays adjustable after rotating.
  rotation: 0 | 90 | 180 | 270
}

function normalizeRotation(degrees: number): 0 | 90 | 180 | 270 {
  return (((degrees % 360) + 360) % 360) as 0 | 90 | 180 | 270
}

export default function ImageRotatePage() {
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
      rotation: 0,
    }),
    cleanupJob: (job) => URL.revokeObjectURL(job.previewUrl),
  })
  const [error, setError] = useState<string | null>(null)

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  function renderDisplay(rotation: number = activeJob?.rotation ?? 0) {
    const base = getResource()
    const display = displayCanvasRef.current
    if (!base || !display) return
    const rotated = rotateCanvas(base, rotation)
    if (display.width !== rotated.width || display.height !== rotated.height) {
      display.width = rotated.width
      display.height = rotated.height
    }
    const ctx = display.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(rotated, 0, 0)
  }

  // Paint the visible canvas whenever the active job changes — it only
  // exists in the DOM once a file has been picked, so this can't happen
  // synchronously when a file is added.
  useEffect(() => {
    if (activeId == null) return
    renderDisplay()
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

  function rotate(delta: number) {
    if (activeId == null || !activeJob) return
    const next = normalizeRotation(activeJob.rotation + delta)
    updateJob(activeId, { rotation: next })
    renderDisplay(next)
  }

  // Rotates every queued image by the same delta, independent of its
  // current orientation.
  function rotateAll(delta: number) {
    if (!jobs.length) return
    jobs.forEach((job) =>
      updateJob(job.id, { rotation: normalizeRotation(job.rotation + delta) })
    )
    if (activeJob) renderDisplay(normalizeRotation(activeJob.rotation + delta))
  }

  async function downloadJob(job: Job) {
    const base = getResource(job.id)
    if (!base) return
    const rotated = rotateCanvas(base, job.rotation)
    await downloadCanvas(rotated, job.name, outputMime(job.file.type))
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  // Skips unrotated images — downloading them would just hand back the
  // original file.
  async function downloadAll() {
    for (const job of jobs) {
      if (job.rotation === 0) continue
      await downloadJob(job)
      await downloadStagger()
    }
  }

  return (
    <ToolPage
      page="Image Rotate"
      icon={ImageRotationClockwiseIcon}
      onAddFile={
        jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined
      }
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
              actions: [
                {
                  label: "Rotate left",
                  icon: RotateCcwSquareIcon,
                  onClick: () => rotate(-90),
                  more:
                    jobs.length > 1
                      ? {
                          label: "Rotate all left",
                          icon: RotateCcwSquareIcon,
                          onClick: () => rotateAll(-90),
                        }
                      : undefined,
                },
                {
                  label: "Rotate right",
                  icon: RotateCwSquareIcon,
                  onClick: () => rotate(90),
                  more:
                    jobs.length > 1
                      ? {
                          label: "Rotate all right",
                          icon: RotateCwSquareIcon,
                          onClick: () => rotateAll(90),
                        }
                      : undefined,
                },
              ],
              download: {
                onDownload: download,
                disabled: activeJob.rotation === 0,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
                downloadAllDisabled: !jobs.some((job) => job.rotation !== 0),
              },
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {activeJob && (
          <div className="flex flex-col gap-4">
            <PreviewCard layer={{ ref: displayCanvasRef }} />
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one image has been picked. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop images to upload"
          description="or, click to browse · rotate in 90° steps · in-browser only"
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
