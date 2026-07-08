"use client"

import {
  AlertCircleIcon,
  ArrowDataTransferHorizontalIcon,
  Cancel01Icon,
  CloudUploadIcon,
  EraserAutoIcon,
  Image01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useJobQueue } from "@/hooks/use-job-queue"
import { encodeBmp, supportsWebp } from "@/lib/bmp"
import { removeBackgroundColor, sampleCanvasColorAtPoint } from "@/lib/canvas"
import { downloadFile, downloadStagger } from "@/lib/download"
import { loadImage } from "@/lib/image-file"
import { replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*,.svg,.ico,.avif,.tiff,.tif,.bmp"
const SUPPORTED_LABEL = "JPG, PNG, WebP, GIF, BMP, SVG, ICO, AVIF, TIFF"

type Format = "png" | "jpeg" | "webp" | "bmp"
type Status = "idle" | "converting" | "done" | "error"
type Result = { url: string; name: string; size: number }
type Job = {
  id: number
  file: File
  name: string
  size: number
  previewUrl: string
  status: Status
  error: string | null
  result: Result | null
}

const FORMAT_MIME: Record<Format, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  bmp: "image/bmp",
}

// Broader than the shared isImageFile — this tool also accepts container
// formats (TIFF, ICO, …) that browsers don't always report a MIME type for.
function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  return /\.(jpe?g|png|webp|gif|bmp|svg|ico|avif|tiff?)$/i.test(file.name)
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding produced no data."))),
      mime,
      quality,
    )
  })
}

export default function ImageConverterPage() {
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
          status: valid ? "idle" : "error",
          error: valid ? null : "This file doesn't look like a recognised image format.",
          result: null,
        }
      },
      cleanupJob: (job) => {
        if (job.previewUrl) URL.revokeObjectURL(job.previewUrl)
        if (job.result) URL.revokeObjectURL(job.result.url)
      },
    })
  const [activeId, setActiveId] = useState<number | null>(null)
  const [format, setFormat] = useState<Format>("png")
  const [quality, setQuality] = useState(92)
  // Fill for transparent PNGs; null keeps transparency (where the target
  // format supports it — JPEG/BMP fall back to the browser's own default).
  const [bgColor, setBgColor] = useState<string | null>(null)
  // Chroma-key removal of a solid background color, only meaningful for
  // targets that can actually hold the resulting transparency.
  const [removeBg, setRemoveBg] = useState(false)
  const [keyColor, setKeyColor] = useState("#ffffff")
  const [tolerance, setTolerance] = useState(32)
  // Which color control is waiting for a click on the Original preview.
  const [pickTarget, setPickTarget] = useState<"bg" | "key" | null>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)
  const originalCanvasRef = useRef<HTMLCanvasElement>(null)

  const activeJob = jobs.find((job) => job.id === activeId) ?? null
  const anyBusy = jobs.some((job) => job.status === "converting")
  const anyPng = jobs.some((job) => job.file.type === "image/png")
  const supportsAlpha = format === "png" || format === "webp"

  useEffect(() => {
    if (!pickTarget) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickTarget(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [pickTarget])

  // Paint the Original preview canvas whenever the active job's source
  // image changes — it only exists in the DOM once a valid image has been
  // picked, so this can't happen synchronously when a file is added.
  useEffect(() => {
    const canvas = originalCanvasRef.current
    const previewUrl = activeJob?.previewUrl
    if (!canvas || !previewUrl) return
    let cancelled = false
    loadImage(previewUrl).then((img) => {
      if (cancelled) return
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext("2d")?.drawImage(img, 0, 0)
    })
    return () => {
      cancelled = true
    }
  }, [activeJob?.previewUrl])

  function pickColorFromCanvas(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!pickTarget) return
    const color = sampleCanvasColorAtPoint(e.currentTarget, e.clientX, e.clientY)
    if (color) {
      if (pickTarget === "bg") setBgColor(color)
      else setKeyColor(color)
    }
    setPickTarget(null)
  }

  function addFiles(fileList: FileList | null | undefined) {
    const created = addFilesToQueue(fileList)
    if (created.length) setActiveId((prev) => prev ?? created[0].id)
  }

  function removeAndReselect(id: number) {
    removeJob(id)
    if (activeId !== id) return
    const remaining = jobs.filter((job) => job.id !== id)
    setActiveId(remaining.length ? remaining[0].id : null)
  }

  function clear() {
    clearQueue()
    setActiveId(null)
  }

  async function convertJob(
    job: Job,
    opts: {
      format: Format
      quality: number
      bgColor: string | null
      removeBg: boolean
      keyColor: string
      tolerance: number
    }
  ) {
    const { format: fmt, quality: q } = opts
    if (fmt === "webp" && !supportsWebp()) {
      updateJob(job.id, {
        status: "error",
        error: "Your browser does not support WebP output. Try Chrome or use PNG instead.",
      })
      return
    }

    updateJob(job.id, { status: "converting", error: null })

    try {
      const img = new Image()
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("This file couldn't be decoded as an image."))
      })
      img.src = job.previewUrl
      await loaded

      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas isn't supported in this browser.")
      if (opts.bgColor) {
        ctx.fillStyle = opts.bgColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0)
      if (opts.removeBg && (fmt === "png" || fmt === "webp")) {
        removeBackgroundColor(canvas, opts.keyColor, opts.tolerance)
      }

      const blob =
        fmt === "bmp"
          ? encodeBmp(ctx.getImageData(0, 0, canvas.width, canvas.height))
          : await canvasToBlob(canvas, FORMAT_MIME[fmt], q / 100)

      const name = replaceExtension(job.name, fmt === "jpeg" ? "jpg" : fmt)
      setJobs((prev) => {
        if (!prev.some((j) => j.id === job.id)) return prev // job was removed mid-convert
        const url = URL.createObjectURL(blob)
        return prev.map((j) => {
          if (j.id !== job.id) return j
          if (j.result) URL.revokeObjectURL(j.result.url)
          return {
            ...j,
            status: "done",
            error: null,
            result: { url, name, size: blob.size },
          }
        })
      })
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Something went wrong while converting the image.",
      })
    }
  }

  function convert() {
    jobs.forEach((job) => {
      if (job.status !== "converting")
        void convertJob(job, { format, quality, bgColor, removeBg, keyColor, tolerance })
    })
  }

  function downloadActive() {
    if (activeJob?.result) downloadFile(activeJob.result.url, activeJob.result.name)
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
      page="Image Converter"
      icon={Image01Icon}
      segments={{
        value: format,
        onValueChange: (value) => setFormat(value as Format),
        options: [
          { value: "png", label: "PNG", icon: Image01Icon },
          { value: "jpeg", label: "JPEG", icon: Image01Icon },
          { value: "webp", label: "WebP", icon: Image01Icon },
          { value: "bmp", label: "BMP", icon: Image01Icon },
        ],
        disabled: anyBusy,
      }}
      onAddFile={jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined}
      onClear={clear}
      footer={
        jobs.length > 0
          ? {
              color: anyPng
                ? {
                    label: "Background",
                    value: bgColor,
                    onChange: setBgColor,
                    fallback: "#ffffff",
                    onPickFromImage: () => setPickTarget("bg"),
                    nullLabel: "transparent",
                    clearLabel: "Transparent",
                    clearIcon: Cancel01Icon,
                  }
                : undefined,
              toggle: supportsAlpha
                ? {
                    label: "Remove background",
                    icon: EraserAutoIcon,
                    pressed: removeBg,
                    onPressedChange: setRemoveBg,
                    color: {
                      label: "Background color to remove",
                      value: keyColor,
                      onChange: setKeyColor,
                      onPickFromImage: () => setPickTarget("key"),
                    },
                    slider: {
                      label: "Tolerance",
                      value: tolerance,
                      onValueChange: setTolerance,
                      min: 0,
                      max: 100,
                    },
                  }
                : undefined,
              slider:
                format === "jpeg" || format === "webp"
                  ? {
                      label: "Quality",
                      value: quality,
                      onValueChange: setQuality,
                      min: 0,
                      max: 100,
                      disabled: anyBusy,
                    }
                  : undefined,
              actions: [
                { label: "Convert", icon: ArrowDataTransferHorizontalIcon, onClick: convert, disabled: anyBusy },
              ],
              download: {
                onDownload: downloadActive,
                disabled: !activeJob?.result,
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
            <JobStrip
              jobs={jobs}
              activeId={activeId}
              onSelect={setActiveId}
              onRemove={removeAndReselect}
            />

            {/* Original (left) and converted (right) preview, side by side. */}
            <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
              <PreviewCard
                fill
                checkerboard
                title={
                  pickTarget
                    ? "Click on the image to pick a color · Esc to cancel"
                    : "Original"
                }
                layer={
                  activeJob.previewUrl
                    ? {
                        ref: originalCanvasRef,
                        onClick: pickColorFromCanvas,
                        className: `relative max-h-full max-w-full ${pickTarget ? "cursor-crosshair" : ""}`,
                      }
                    : { kind: "status", icon: AlertCircleIcon, message: activeJob.error }
                }
              />

              <PreviewCard
                fill
                checkerboard
                title="Converted"
                layer={
                  activeJob.result
                    ? {
                        kind: "image",
                        src: activeJob.result.url,
                        alt: activeJob.result.name,
                        className: "relative max-h-full max-w-full",
                      }
                    : activeJob.status === "converting"
                      ? { kind: "status", icon: Loading03Icon, spin: true }
                      : activeJob.status === "error"
                        ? { kind: "status", icon: AlertCircleIcon, tone: "destructive", message: activeJob.error }
                        : { kind: "status", message: "Pick a format and hit Convert" }
                }
              />
            </div>
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one file has been added. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop an image to upload"
          description={`or, click to browse · ${SUPPORTED_LABEL} · in-browser only`}
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />
      </div>
    </ToolPage>
  )
}
