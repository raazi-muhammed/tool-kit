"use client"

import {
  AlertCircleIcon,
  CloudUploadIcon,
  DartIcon,
  Gif01Icon,
  Loading03Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import gifsicle from "gifsicle-wasm-browser"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { useFiles } from "@/hooks/use-files"
import {
  downloadAllJobs,
  downloadFile,
  setBlobResult,
  type FileResult,
} from "@/lib/download"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "image/gif,.gif"

// Gifsicle's --lossy dial: quality mode maps the 1-100 slider onto 0-200
// (the documented useful range); target-size mode searches a wider 0-300
// before falling back to palette reduction.
const QUALITY_MAX_LOSSY = 200
const TARGET_MAX_LOSSY = 300
const FALLBACK_COLORS = [128, 64, 32]

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

function isGifFile(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name)
}

async function runGifsicle(file: File, args: string): Promise<Blob> {
  const out = await gifsicle.run({
    input: [{ file, name: "in.gif" }],
    command: [`${args} in.gif -o /out/out.gif`],
  })
  const result = out[0]
  if (!result || result.size === 0)
    throw new Error("This file couldn't be processed as a GIF.")
  return result
}

async function compressOnce(
  file: File,
  opts: { mode: Mode; quality: number; targetBytes: number }
): Promise<{ blob: Blob; note: string | null }> {
  if (opts.mode === "quality") {
    const lossy = Math.round(((100 - opts.quality) / 100) * QUALITY_MAX_LOSSY)
    const args = lossy > 0 ? `-O3 --lossy=${lossy}` : "-O3"
    return { blob: await runGifsicle(file, args), note: null }
  }

  // Target-size mode: lossless optimization first — if that already fits,
  // there's nothing to trade away.
  const full = await runGifsicle(file, "-O3")
  if (full.size <= opts.targetBytes) return { blob: full, note: null }

  // Find the lowest --lossy level (best quality) whose output still fits.
  let lo = 0
  let hi = TARGET_MAX_LOSSY
  let best: Blob | null = null
  for (let i = 0; i < 5; i++) {
    const mid = Math.round((lo + hi) / 2)
    const blob = await runGifsicle(file, `-O3 --lossy=${mid}`)
    if (blob.size <= opts.targetBytes) {
      best = blob
      hi = mid
    } else {
      lo = mid
    }
  }
  if (best) return { blob: best, note: null }

  // Even max lossy is too big — trade palette colors for size next.
  let smallest = await runGifsicle(file, `-O3 --lossy=${TARGET_MAX_LOSSY}`)
  for (const colors of FALLBACK_COLORS) {
    const blob = await runGifsicle(
      file,
      `-O3 --lossy=${TARGET_MAX_LOSSY} --colors ${colors}`
    )
    if (blob.size <= opts.targetBytes) return { blob, note: null }
    if (blob.size < smallest.size) smallest = blob
  }
  return {
    blob: smallest,
    note: `Couldn't reach ${formatBytes(opts.targetBytes)} — ${formatBytes(
      smallest.size
    )} is the smallest this GIF compresses to.`,
  }
}

export default function GifCompressPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles: addFilesToQueue,
    updateJob,
    removeJob,
  } = useFiles<Job, File>({
    loadResource: async (file) => {
      if (!isGifFile(file)) throw new Error("Not a GIF.")
      return file
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
  // a stale result (a gifsicle run can take seconds on a large GIF).
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
        ;({ blob, note } = await compressOnce(job.file, current))
      } while (settingsRef.current.key !== key)
      updateJob(job.id, (j) => ({
        status: "done",
        error: null,
        note,
        result: setBlobResult(j.result, blob, job.name),
      }))
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong while compressing the GIF.",
      })
    }
  }

  // Recompress automatically whenever a setting changes — debounced a bit
  // longer than usual since every run spins up gifsicle. Jobs already
  // compressing are skipped: they re-run themselves via the settings ref.
  useDebouncedEffect(
    () => {
      if (jobs.length === 0 || sizeInvalid) return
      jobs.forEach((job) => {
        if (job.status !== "compressing") void compressJob(job)
      })
    },
    [mode, quality, targetKb, jobs.length],
    500
  )

  async function addFiles(fileList: FileList | null | undefined) {
    const {
      jobs: created,
      addedCount,
      failedCount,
    } = await addFilesToQueue(fileList)
    setError(
      addedCount === 0 && failedCount > 0
        ? "None of the selected files are GIFs. For other images, use the Image Compress tool."
        : null
    )
    // Seed the target-size field (once) to roughly half the first GIF.
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
      page="GIF Compress"
      icon={Gif01Icon}
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
            {/* Original (left) and compressed (right) preview, side by side —
                both are <img> layers, so animated GIFs keep animating. */}
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
                    ? `Compressed · ${formatBytes(activeJob.result.size)} · ${
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
          title="Drag and drop GIFs to upload"
          description="or, click to browse · animations stay animated · in-browser only"
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
