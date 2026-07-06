"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowDataTransferHorizontalIcon,
  CloudUploadIcon,
  Download04Icon,
  Image01Icon,
} from "@hugeicons/core-free-icons"
import { useRef, useState } from "react"

import { BatchJobRow } from "@/components/batch-job-row"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { ToolPage } from "@/components/tool-page"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useJobQueue } from "@/hooks/use-job-queue"
import { encodeBmp, supportsWebp } from "@/lib/bmp"
import { downloadFile, downloadStagger } from "@/lib/download"
import { formatBytes, replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*,.svg,.ico,.avif,.tiff,.tif,.bmp"
const SUPPORTED_LABEL = "JPG, PNG, WebP, GIF, BMP, SVG, ICO, AVIF, TIFF"

type Format = "png" | "jpeg" | "webp" | "bmp"
type Status = "idle" | "converting" | "done" | "error"
type Dimensions = { width: number; height: number }
type Result = { url: string; name: string; size: number }
type Job = {
  id: number
  file: File
  name: string
  size: number
  previewUrl: string
  dimensions: Dimensions | null
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
  const { jobs, setJobs, addFiles, updateJob, removeJob, clear } = useJobQueue<Job>({
    createJob: (file, id) => {
      const valid = isImageFile(file)
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        previewUrl: valid ? URL.createObjectURL(file) : "",
        dimensions: null,
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
  const [format, setFormat] = useState<Format>("png")
  const [quality, setQuality] = useState(92)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const anyBusy = jobs.some((job) => job.status === "converting")

  async function convertJob(job: Job, fmt: Format, q: number) {
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
      ctx.drawImage(img, 0, 0)

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
            dimensions: { width: canvas.width, height: canvas.height },
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
      if (job.status !== "converting") void convertJob(job, format, quality)
    })
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
      actions={
        jobs.length > 0 && (
          <Button variant="outline" onClick={() => dropzoneRef.current?.open()}>
            <HugeiconsIcon icon={CloudUploadIcon} aria-hidden />
            Add file
          </Button>
        )
      }
      onClear={clear}
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
                {job.dimensions ? `${job.dimensions.width} × ${job.dimensions.height} · ` : ""}
                {formatBytes(job.size)}
              </>
            }
            status={
              job.status === "converting"
                ? { state: "processing", title: "Converting…" }
                : job.status === "error"
                  ? { state: "error", title: "Couldn't convert", description: job.error }
                  : job.result
                    ? {
                        state: "done",
                        icon: Image01Icon,
                        title: job.result.name,
                        description: formatBytes(job.result.size),
                        download: { url: job.result.url, name: job.result.name },
                      }
                    : {
                        state: "idle",
                        icon: Image01Icon,
                        title: "Ready to convert",
                        description: "Pick a format and hit Convert",
                      }
            }
          />
        ))}

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

        {/* Quality (JPEG/WebP only) and the explicit Convert trigger. */}
        {jobs.length > 0 && (
          <div className="flex items-center gap-4">
            {(format === "jpeg" || format === "webp") && (
              <div className="flex flex-1 items-center gap-3">
                <span className="text-sm text-muted-foreground">Quality</span>
                <Slider
                  value={[quality]}
                  onValueChange={([value]) => setQuality(value)}
                  min={0}
                  max={100}
                  step={1}
                  disabled={anyBusy}
                  className="max-w-48"
                />
                <span className="w-8 text-right text-sm text-muted-foreground">{quality}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              {jobs.some((job) => job.result) && (
                <Button variant="outline" onClick={downloadAll}>
                  <HugeiconsIcon icon={Download04Icon} aria-hidden />
                  Download all
                </Button>
              )}
              <Button onClick={convert} disabled={anyBusy}>
                <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} aria-hidden />
                Convert
              </Button>
            </div>
          </div>
        )}
      </div>
    </ToolPage>
  )
}
