"use client"

import {
  AlertCircleIcon,
  CloudUploadIcon,
  Download04Icon,
  Image01Icon,
  LinkIcon,
  Resize02Icon,
} from "@hugeicons/core-free-icons"
import { useRef, useState } from "react"

import { BatchJobRow } from "@/components/batch-job-row"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { ToolPage } from "@/components/tool-page"
import { useJobQueue } from "@/hooks/use-job-queue"
import { downloadFile, downloadStagger } from "@/lib/download"
import { isImageFile, loadImage } from "@/lib/image-file"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "image/*"

type Status = "idle" | "resizing" | "done" | "error"
type Result = {
  url: string
  name: string
  size: number
  width: number
  height: number
}
type Dimensions = { width: number; height: number }
type Job = {
  id: number
  file: File
  name: string
  size: number
  previewUrl: string
  original: Dimensions | null
  status: Status
  error: string | null
  result: Result | null
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Encoding produced no data.")),
      mime
    )
  })
}

export default function ImageResizePage() {
  const { jobs, setJobs, addFiles: addFilesToQueue, updateJob, removeJob, clear: clearQueue } =
    useJobQueue<Job>({
      createJob: (file, id) => {
        const valid = isImageFile(file)
        return {
          id,
          file,
          name: file.name,
          size: file.size,
          previewUrl: valid ? URL.createObjectURL(file) : "",
          original: null,
          status: valid ? "idle" : "error",
          error: valid ? null : "This file doesn't look like an image.",
          result: null,
        }
      },
      cleanupJob: (job) => {
        if (job.previewUrl) URL.revokeObjectURL(job.previewUrl)
        if (job.result) URL.revokeObjectURL(job.result.url)
      },
    })
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [lockAspect, setLockAspect] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const anyBusy = jobs.some((job) => job.status === "resizing")
  // The target width/height apply to every queued image; the aspect lock is
  // derived from the first image added, purely as a convenient reference.
  const referenceOriginal = jobs[0]?.original ?? null

  function addFiles(fileList: FileList | null | undefined) {
    const created = addFilesToQueue(fileList)
    created.forEach((job) => {
      if (job.status === "error") return
      loadImage(job.previewUrl)
        .then((img) => {
          const original = { width: img.naturalWidth, height: img.naturalHeight }
          updateJob(job.id, { original })
          setWidth((w) => w || String(original.width))
          setHeight((h) => h || String(original.height))
        })
        .catch(() => {
          updateJob(job.id, {
            status: "error",
            error: "This file couldn't be decoded as an image.",
          })
        })
    })
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

  async function resizeJob(job: Job, targetWidth: number, targetHeight: number) {
    updateJob(job.id, { status: "resizing", error: null })

    try {
      const img = await loadImage(job.previewUrl)
      const canvas = document.createElement("canvas")
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas isn't supported in this browser.")
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

      const mime =
        job.file.type && job.file.type.startsWith("image/")
          ? job.file.type
          : "image/png"
      const blob = await canvasToBlob(canvas, mime)

      setJobs((prev) => {
        if (!prev.some((j) => j.id === job.id)) return prev
        const url = URL.createObjectURL(blob)
        return prev.map((j) => {
          if (j.id !== job.id) return j
          if (j.result) URL.revokeObjectURL(j.result.url)
          return {
            ...j,
            status: "done",
            error: null,
            result: { url, name: j.name, size: blob.size, width: targetWidth, height: targetHeight },
          }
        })
      })
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong while resizing the image.",
      })
    }
  }

  function resize() {
    const targetWidth = Math.round(Number(width))
    const targetHeight = Math.round(Number(height))
    if (!targetWidth || !targetHeight || targetWidth < 1 || targetHeight < 1) {
      setFormError("Enter a width and height of at least 1 pixel.")
      return
    }
    setFormError(null)
    jobs.forEach((job) => {
      if (job.status !== "resizing" && job.original) void resizeJob(job, targetWidth, targetHeight)
    })
  }

  function clear() {
    clearQueue()
    setWidth("")
    setHeight("")
    setFormError(null)
  }

  async function downloadAll() {
    for (const job of jobs) {
      if (!job.result) continue
      downloadFile(job.result.url, job.result.name)
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
        jobs.length > 0
          ? {
              inputs: [
                {
                  label: "Width",
                  type: "number",
                  min: 1,
                  value: width,
                  onChange: onWidthChange,
                  disabled: anyBusy,
                },
                {
                  label: "Height",
                  type: "number",
                  min: 1,
                  value: height,
                  onChange: onHeightChange,
                  disabled: anyBusy,
                },
              ],
              actions: [
                {
                  label: lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio",
                  icon: LinkIcon,
                  onClick: toggleLockAspect,
                  disabled: anyBusy,
                  variant: lockAspect ? "secondary" : "outline",
                },
                jobs.some((job) => job.result) && {
                  label: "Download all",
                  icon: Download04Icon,
                  onClick: downloadAll,
                  variant: "outline",
                },
                { label: "Resize", icon: Resize02Icon, onClick: resize, disabled: anyBusy },
              ],
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {/* One row per file: source (left) and its output (right), side by side. */}
        {jobs.map((job) => (
          <BatchJobRow
            key={job.id}
            name={job.name}
            onRemove={() => removeJob(job.id)}
            sourceIcon={AlertCircleIcon}
            sourceImageUrl={job.previewUrl || undefined}
            sourceDescription={
              <>
                {job.original ? `${job.original.width} × ${job.original.height} · ` : ""}
                {formatBytes(job.size)}
              </>
            }
            status={
              job.status === "resizing"
                ? { state: "processing", title: "Resizing…" }
                : job.status === "error"
                  ? { state: "error", title: "Couldn't resize", description: job.error }
                  : job.result
                    ? {
                        state: "done",
                        icon: Image01Icon,
                        title: job.result.name,
                        description: `${job.result.width} × ${job.result.height} · ${formatBytes(job.result.size)}`,
                        download: { url: job.result.url, name: job.result.name },
                      }
                    : {
                        state: "idle",
                        icon: Image01Icon,
                        title: "Ready to resize",
                        description: "Set a width and height, then hit Resize",
                      }
            }
          />
        ))}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one file has been added. */}
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

        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </div>
    </ToolPage>
  )
}
