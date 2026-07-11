"use client"

import {
  AlertCircleIcon,
  Cancel01Icon,
  CloudUploadIcon,
  EraserAutoIcon,
  Image01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { useFiles } from "@/hooks/use-files"
import { encodeBmp, supportsWebp } from "@/lib/bmp"
import { removeBackgroundColor } from "@/lib/canvas"
import { downloadFile, downloadStagger } from "@/lib/download"
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
  // Independent per file, like image-crop's bgColor or image-rotate's rotation.
  format: Format
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

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Encoding produced no data.")),
      mime,
      quality
    )
  })
}

export default function ImageConverterPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles,
    updateJob,
    removeJob,
  } = useFiles<Job>({
    createJob: (file, id) => {
      const valid = isImageFile(file)
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        previewUrl: valid ? URL.createObjectURL(file) : "",
        status: valid ? "idle" : "error",
        error: valid
          ? null
          : "This file doesn't look like a recognised image format.",
        result: null,
        format: "png",
      }
    },
    cleanupJob: (job) => {
      if (job.previewUrl) URL.revokeObjectURL(job.previewUrl)
      if (job.result) URL.revokeObjectURL(job.result.url)
    },
  })
  const [quality, setQuality] = useState(92)
  // Fill for transparent PNGs; null keeps transparency (where the target
  // format supports it — JPEG/BMP fall back to the browser's own default).
  const [bgColor, setBgColor] = useState<string | null>(null)
  // Chroma-key removal of a solid background color, only meaningful for
  // targets that can actually hold the resulting transparency.
  const [removeBg, setRemoveBg] = useState(false)
  const [keyColor, setKeyColor] = useState("#ffffff")
  const [tolerance, setTolerance] = useState(32)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const anyBusy = jobs.some((job) => job.status === "converting")
  const anyPng = jobs.some((job) => job.file.type === "image/png")
  const supportsAlpha =
    activeJob?.format === "png" || activeJob?.format === "webp"

  async function convertJob(
    job: Job,
    opts: {
      quality: number
      bgColor: string | null
      removeBg: boolean
      keyColor: string
      tolerance: number
    }
  ) {
    const fmt = job.format
    const { quality: q } = opts
    if (fmt === "webp" && !supportsWebp()) {
      updateJob(job.id, {
        status: "error",
        error:
          "Your browser does not support WebP output. Try Chrome or use PNG instead.",
      })
      return
    }

    updateJob(job.id, { status: "converting", error: null })

    try {
      const img = new Image()
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () =>
          reject(new Error("This file couldn't be decoded as an image."))
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
      updateJob(job.id, (j) => {
        if (j.result) URL.revokeObjectURL(j.result.url)
        const url = URL.createObjectURL(blob)
        return {
          status: "done",
          error: null,
          result: { url, name, size: blob.size },
        }
      })
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong while converting the image.",
      })
    }
  }

  // Each job carries its own target format, so `jobs.length` alone (the
  // usual dep for this effect elsewhere in the codebase) won't notice an
  // existing job's format changing. This key changes only when a job is
  // added/removed or a format actually changes, not on every status/result
  // write `updateJob` makes during conversion — which would otherwise loop.
  const formatsKey = jobs.map((job) => `${job.id}:${job.format}`).join(",")

  // Re-run the conversion automatically whenever a job's format or any
  // shared setting changes, instead of requiring an explicit Convert click.
  // Debounced so dragging the quality/tolerance sliders (many onValueChange
  // updates a second) doesn't re-encode on every tick — only once the value
  // settles.
  useDebouncedEffect(() => {
    if (jobs.length === 0) return
    jobs.forEach((job) => {
      if (job.status !== "converting")
        void convertJob(job, {
          quality,
          bgColor,
          removeBg,
          keyColor,
          tolerance,
        })
    })
  }, [formatsKey, quality, bgColor, removeBg, keyColor, tolerance])

  function downloadActive() {
    if (activeJob?.result)
      downloadFile(activeJob.result.url, activeJob.result.name)
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
        jobs.length > 0
          ? {
              segments: activeJob
                ? {
                    value: activeJob.format,
                    onValueChange: (value) =>
                      updateJob(activeJob.id, { format: value as Format }),
                    label: "Format",
                    options: [
                      { value: "png", label: "PNG", icon: Image01Icon },
                      { value: "jpeg", label: "JPEG", icon: Image01Icon },
                      { value: "webp", label: "WebP", icon: Image01Icon },
                      { value: "bmp", label: "BMP", icon: Image01Icon },
                    ],
                    disabled: anyBusy,
                  }
                : undefined,
              color: anyPng
                ? {
                    label: "Background",
                    value: bgColor,
                    onChange: setBgColor,
                    fallback: "#ffffff",
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
                    },
                    slider: {
                      label: "Tolerance",
                      value: tolerance,
                      onValueChange: setTolerance,
                      min: 0,
                      max: 100,
                      unit: "%",
                    },
                  }
                : undefined,
              slider:
                activeJob?.format === "jpeg" || activeJob?.format === "webp"
                  ? {
                      label: "Quality",
                      value: quality,
                      onValueChange: setQuality,
                      min: 0,
                      max: 100,
                      disabled: anyBusy,
                      unit: "%",
                    }
                  : undefined,
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
            {/* Original (left) and converted (right) preview, side by side. */}
            <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
              <PreviewCard
                fill
                checkerboard
                title="Original"
                layer={
                  activeJob.previewUrl
                    ? {
                        kind: "image",
                        src: activeJob.previewUrl,
                        alt: activeJob.name,
                        className: "relative max-h-full max-w-full",
                      }
                    : {
                        kind: "status",
                        icon: AlertCircleIcon,
                        message: activeJob.error,
                      }
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
                        ? {
                            kind: "status",
                            icon: AlertCircleIcon,
                            tone: "destructive",
                            message: activeJob.error,
                          }
                        : {
                            kind: "status",
                            message: "Pick a format to convert it",
                          }
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
