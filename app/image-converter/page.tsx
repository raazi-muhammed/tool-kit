"use client"

import {
  AlertCircleIcon,
  CloudUploadIcon,
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
import { canvasToBlob, removeBackgroundColor } from "@/lib/canvas"
import {
  downloadAllJobs,
  downloadFile,
  setBlobResult,
  type FileResult,
} from "@/lib/download"
import { replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*,.svg,.ico,.avif,.tiff,.tif,.bmp"
const SUPPORTED_LABEL = "JPG, PNG, WebP, GIF, BMP, SVG, ICO, AVIF, TIFF"

type Format = "png" | "jpeg" | "webp" | "bmp"
type Status = "idle" | "converting" | "done" | "error"
type Job = {
  id: number
  file: File
  name: string
  size: number
  previewUrl: string
  status: Status
  error: string | null
  result: FileResult | null
  // Independent per file, like image-crop's bgColor or image-rotate's rotation.
  format: Format
}

type FormatSpec = {
  label: string
  extension: string
  // Whether this format can hold transparency — gates the background-color
  // fill and "Remove background" controls.
  supportsAlpha: boolean
  supportsQuality: boolean
  // Missing browser support (currently only WebP) — checked before encoding.
  supported?: () => boolean
  encode: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    quality: number
  ) => Promise<Blob>
}

// Adding a format only means adding an entry here — everything else (type
// picker options, alpha/quality gating, the actual encode call) reads from it.
const FORMATS: Record<Format, FormatSpec> = {
  png: {
    label: "PNG",
    extension: "png",
    supportsAlpha: true,
    supportsQuality: false,
    encode: (canvas) => canvasToBlob(canvas, "image/png"),
  },
  jpeg: {
    label: "JPEG",
    extension: "jpg",
    supportsAlpha: false,
    supportsQuality: true,
    encode: (canvas, _ctx, quality) =>
      canvasToBlob(canvas, "image/jpeg", quality / 100),
  },
  webp: {
    label: "WebP",
    extension: "webp",
    supportsAlpha: true,
    supportsQuality: true,
    supported: supportsWebp,
    encode: (canvas, _ctx, quality) =>
      canvasToBlob(canvas, "image/webp", quality / 100),
  },
  bmp: {
    label: "BMP",
    extension: "bmp",
    supportsAlpha: false,
    supportsQuality: false,
    encode: async (canvas, ctx) =>
      encodeBmp(ctx.getImageData(0, 0, canvas.width, canvas.height)),
  },
}

// Broader than the shared isImageFile — this tool also accepts container
// formats (TIFF, ICO, …) that browsers don't always report a MIME type for.
function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  return /\.(jpe?g|png|webp|gif|bmp|svg|ico|avif|tiff?)$/i.test(file.name)
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
  const supportsAlpha = activeJob
    ? FORMATS[activeJob.format].supportsAlpha
    : false

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
    const fmt = FORMATS[job.format]
    if (fmt.supported && !fmt.supported()) {
      updateJob(job.id, {
        status: "error",
        error: `Your browser does not support ${fmt.label} output. Try Chrome or use PNG instead.`,
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
      if (opts.removeBg && fmt.supportsAlpha) {
        removeBackgroundColor(canvas, opts.keyColor, opts.tolerance)
      }

      const blob = await fmt.encode(canvas, ctx, opts.quality)
      const name = replaceExtension(job.name, fmt.extension)
      updateJob(job.id, (j) => ({
        status: "done",
        error: null,
        result: setBlobResult(j.result, blob, name),
      }))
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

  function downloadAll() {
    return downloadAllJobs(
      jobs,
      (job) => !!job.result,
      async (job) => {
        if (job.result) downloadFile(job.result.url, job.result.name)
      }
    )
  }

  return (
    <ToolPage
      page="Image Converter"
      icon={Image01Icon}
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
        jobs.length > 0
          ? {
              segments: activeJob
                ? {
                    value: activeJob.format,
                    onValueChange: (value) =>
                      updateJob(activeJob.id, { format: value as Format }),
                    label: "Format",
                    options: (Object.keys(FORMATS) as Format[]).map(
                      (value) => ({
                        value,
                        label: FORMATS[value].label,
                        icon: Image01Icon,
                      })
                    ),
                    disabled: anyBusy,
                  }
                : undefined,
              color: anyPng
                ? {
                    label: "Background",
                    value: bgColor,
                    onChange: setBgColor,
                    fallback: "#ffffff",
                  }
                : undefined,
              toggle: supportsAlpha
                ? {
                    label: "Remove background",
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
                activeJob && FORMATS[activeJob.format].supportsQuality
                  ? {
                      label: "Quality",
                      value: quality,
                      onValueChange: setQuality,
                      min: 0,
                      max: 100,
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
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
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
                        className: "h-full w-full object-contain",
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
                        className: "h-full w-full object-contain",
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
