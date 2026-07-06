"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  CloudUploadIcon,
  Download04Icon,
  Image01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { ToolPage } from "@/components/tool-page"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { useJobQueue } from "@/hooks/use-job-queue"
import { encodeBmp, supportsWebp } from "@/lib/bmp"
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
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const activeJob = jobs.find((job) => job.id === activeId) ?? null
  const anyBusy = jobs.some((job) => job.status === "converting")

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
        {activeJob && (
          <div className="flex flex-col gap-4">
            <JobStrip
              jobs={jobs}
              activeId={activeId}
              onSelect={setActiveId}
              onRemove={removeAndReselect}
            />

            {/* Original (left) and converted (right) preview, side by side. */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">Original</span>
                <Card className="overflow-hidden p-2">
                  <div className="flex h-[60vh] items-center justify-center overflow-hidden rounded-md bg-muted/20">
                    {activeJob.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeJob.previewUrl}
                        alt={activeJob.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 px-6 text-center text-muted-foreground">
                        <HugeiconsIcon icon={AlertCircleIcon} className="size-8" aria-hidden />
                        <p className="text-sm">{activeJob.error}</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">Converted</span>
                <Card className="overflow-hidden p-2">
                  <div className="flex h-[60vh] items-center justify-center overflow-hidden rounded-md bg-muted/20">
                    {activeJob.status === "converting" ? (
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        className="size-8 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                    ) : activeJob.status === "error" ? (
                      <div className="flex flex-col items-center gap-2 px-6 text-center text-destructive">
                        <HugeiconsIcon icon={AlertCircleIcon} className="size-8" aria-hidden />
                        <p className="text-sm">{activeJob.error}</p>
                      </div>
                    ) : activeJob.result ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeJob.result.url}
                        alt={activeJob.result.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Pick a format and hit Convert
                      </p>
                    )}
                  </div>
                </Card>
              </div>
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

        {/* Quality (JPEG/WebP only), download, and the explicit Convert trigger. */}
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
              <ButtonGroup>
                <Button
                  variant="secondary"
                  onClick={downloadActive}
                  disabled={!activeJob?.result}
                >
                  <HugeiconsIcon icon={Download04Icon} aria-hidden />
                  Download
                </Button>
                {jobs.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label="More download options"
                      >
                        <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={downloadAll}
                        disabled={!jobs.some((job) => job.result)}
                      >
                        <HugeiconsIcon icon={Download04Icon} aria-hidden />
                        Download all
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </ButtonGroup>
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
