"use client"

import {
  AlertCircleIcon,
  ArrowShrink02Icon,
  CloudUploadIcon,
  DartIcon,
  Loading03Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { useFiles } from "@/hooks/use-files"
import { supportsWebp } from "@/lib/bmp"
import { canvasToBlob } from "@/lib/canvas"
import {
  downloadAllJobs,
  downloadFile,
  setBlobResult,
  type FileResult,
} from "@/lib/download"
import { loadImageAsCanvas } from "@/lib/image-file"
import { formatBytes, replaceExtension } from "@/lib/wav"

const ACCEPTED =
  "image/jpeg,image/png,image/webp,image/bmp,image/avif,.jpg,.jpeg,.png,.webp,.bmp,.avif"

type Mode = "quality" | "size"
type Status = "idle" | "compressing" | "done" | "error"
type Job = {
  id: number
  file: File
  name: string
  size: number
  previewUrl: string
  status: Status
  error: string | null
  /** Soft caveat on an otherwise-done result (e.g. the target size was unreachable). */
  note: string | null
  result: FileResult | null
}

/**
 * The format a source compresses to: JPEG re-encodes to itself; everything
 * else (PNG, WebP, BMP, …) goes to WebP, which keeps transparency and has a
 * quality dial — falling back to JPEG where WebP encoding isn't supported.
 */
function outputFormat(file: File): {
  mime: string
  ext: string
  label: string
} {
  if (file.type === "image/jpeg")
    return { mime: "image/jpeg", ext: "jpg", label: "JPEG" }
  if (supportsWebp()) return { mime: "image/webp", ext: "webp", label: "WebP" }
  return { mime: "image/jpeg", ext: "jpg", label: "JPEG" }
}

/** JPEG can't hold alpha — flatten onto white so transparency doesn't turn black. */
function flattenForJpeg(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas isn't supported in this browser.")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0)
  return canvas
}

async function compressOnce(
  source: HTMLCanvasElement,
  file: File,
  opts: { mode: Mode; quality: number; targetBytes: number }
): Promise<{ blob: Blob; note: string | null }> {
  const { mime } = outputFormat(file)
  const canvas = mime === "image/jpeg" ? flattenForJpeg(source) : source

  if (opts.mode === "quality") {
    const blob = await canvasToBlob(canvas, mime, opts.quality / 100)
    return { blob, note: null }
  }

  // Target-size mode: find the highest quality whose encoding still fits.
  const full = await canvasToBlob(canvas, mime, 1)
  if (full.size <= opts.targetBytes) return { blob: full, note: null }

  let lo = 0.01
  let hi = 1
  let best: Blob | null = null
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2
    const blob = await canvasToBlob(canvas, mime, mid)
    if (blob.size <= opts.targetBytes) {
      best = blob
      lo = mid
    } else {
      hi = mid
    }
  }
  if (best) return { blob: best, note: null }

  const smallest = await canvasToBlob(canvas, mime, 0.01)
  if (smallest.size <= opts.targetBytes) return { blob: smallest, note: null }
  return {
    blob: smallest,
    note: `Couldn't reach ${formatBytes(opts.targetBytes)} — ${formatBytes(
      smallest.size
    )} is the smallest this image compresses to.`,
  }
}

export default function ImageCompressPage() {
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
    loadResource: (file) => {
      // Animated GIFs would silently flatten to their first frame here — the
      // GIF Compress tool handles those.
      if (file.type === "image/gif" || /\.gif$/i.test(file.name))
        return Promise.reject(new Error("GIFs aren't supported here."))
      return loadImageAsCanvas(file)
    },
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      status: "idle",
      error: null,
      note: null,
      result: null,
    }),
    cleanupJob: (job) => {
      URL.revokeObjectURL(job.previewUrl)
      if (job.result) URL.revokeObjectURL(job.result.url)
    },
  })
  const [mode, setMode] = useState<Mode>("quality")
  const [quality, setQuality] = useState(75)
  const [targetKb, setTargetKb] = useState("")
  const [error, setError] = useState<string | null>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const parsedKb = Number(targetKb)
  const sizeInvalid =
    mode === "size" && (!Number.isFinite(parsedKb) || parsedKb < 1)
  // Clamped so a mid-run settings read never sees a nonsense target — the
  // effect below still skips starting runs while the field is invalid.
  const targetBytes = Math.max(
    1024,
    Math.round((Number.isFinite(parsedKb) ? parsedKb : 0) * 1024)
  )

  // Latest settings, re-read by an in-flight compression after each pass so
  // a mid-run settings change re-runs with the new values instead of landing
  // a stale result (a target-size run encodes several times).
  const settings = {
    key: `${mode}:${quality}:${targetKb}`,
    mode,
    quality,
    targetBytes,
  }
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  })

  async function compressJob(job: Job) {
    const source = getResource(job.id)
    if (!source) return
    updateJob(job.id, { status: "compressing", error: null })
    try {
      let blob: Blob
      let note: string | null
      let key: string
      // Re-check the settings after each pass — if they changed mid-run,
      // compress again so the finished result always reflects the latest.
      do {
        const current = settingsRef.current
        key = current.key
        ;({ blob, note } = await compressOnce(source, job.file, current))
      } while (settingsRef.current.key !== key)
      const { ext } = outputFormat(job.file)
      updateJob(job.id, (j) => ({
        status: "done",
        error: null,
        note,
        result: setBlobResult(j.result, blob, replaceExtension(job.name, ext)),
      }))
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong while compressing the image.",
      })
    }
  }

  // Recompress automatically whenever a setting changes — debounced so
  // dragging the quality slider doesn't re-encode on every tick. Jobs already
  // compressing are skipped: they re-run themselves via the settings ref.
  useDebouncedEffect(() => {
    if (jobs.length === 0 || sizeInvalid) return
    jobs.forEach((job) => {
      if (job.status !== "compressing") void compressJob(job)
    })
  }, [mode, quality, targetKb, jobs.length])

  async function addFiles(fileList: FileList | null | undefined) {
    const {
      jobs: created,
      addedCount,
      failedCount,
    } = await addFilesToQueue(fileList)
    setError(
      addedCount === 0 && failedCount > 0
        ? "None of the selected files could be loaded — pick JPEG, PNG, or WebP images. For GIFs, use the GIF Compress tool."
        : null
    )
    // Seed the target-size field (once) to roughly half the first image.
    if (created.length > 0 && targetKb === "")
      setTargetKb(String(Math.max(1, Math.round(created[0].file.size / 2048))))
  }

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

  const savings = activeJob?.result
    ? Math.round((1 - activeJob.result.size / activeJob.size) * 100)
    : null

  return (
    <ToolPage
      page="Image Compress"
      icon={ArrowShrink02Icon}
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
      segments={
        jobs.length > 0
          ? {
              value: mode,
              onValueChange: (value) => setMode(value as Mode),
              label: "Mode",
              options: [
                { value: "quality", label: "Quality", icon: SparklesIcon },
                { value: "size", label: "Target size", icon: DartIcon },
              ],
            }
          : undefined
      }
      sidebar={
        jobs.length > 0
          ? {
              slider:
                mode === "quality"
                  ? {
                      label: "Quality",
                      value: quality,
                      onValueChange: setQuality,
                      min: 1,
                      max: 100,
                      unit: "%",
                    }
                  : undefined,
              inputs:
                mode === "size"
                  ? [
                      {
                        label: "Target size (KB)",
                        type: "number",
                        min: 1,
                        value: targetKb,
                        onChange: setTargetKb,
                      },
                    ]
                  : undefined,
              hint: sizeInvalid
                ? "Enter a target size of at least 1 KB."
                : (activeJob?.note ?? undefined),
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
            {/* Original (left) and compressed (right) preview, side by side. */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
              <PreviewCard
                fill
                half
                checkerboard
                title={`Original · ${formatBytes(activeJob.size)}`}
                layer={{
                  kind: "image",
                  src: activeJob.previewUrl,
                  alt: activeJob.name,
                  className: "h-full w-full object-contain",
                }}
              />

              <PreviewCard
                fill
                half
                checkerboard
                title={
                  activeJob.result && savings !== null
                    ? `Compressed · ${outputFormat(activeJob.file).label} · ${formatBytes(
                        activeJob.result.size
                      )} · ${
                        savings >= 0
                          ? `${savings}% smaller`
                          : `${-savings}% larger`
                      }`
                    : "Compressed"
                }
                layer={
                  activeJob.result
                    ? {
                        kind: "image",
                        src: activeJob.result.url,
                        alt: activeJob.result.name,
                        className: "h-full w-full object-contain",
                      }
                    : activeJob.status === "compressing"
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
                            message: "Compression runs automatically",
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
          title="Drag and drop images to upload"
          description="or, click to browse · JPEG, PNG, WebP · in-browser only"
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
