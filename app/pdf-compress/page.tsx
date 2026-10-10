"use client"

import {
  AlertCircleIcon,
  CloudUploadIcon,
  DartIcon,
  FileZipIcon,
  Loading03Icon,
  Pdf02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PdfPreview } from "@/components/pdf-preview"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { useFiles } from "@/hooks/use-files"
import {
  blobFromUrl,
  downloadAllJobs,
  downloadFile,
  downloadJobsAsZip,
  setBlobResult,
  type FileResult,
} from "@/lib/download"
import { isPdfFile } from "@/lib/pdf"
import { compressPdf, settingsForQuality } from "@/lib/pdf-compress"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "application/pdf,.pdf"

type Mode = "quality" | "size"
type Status = "idle" | "compressing" | "done" | "error"
type Job = {
  id: number
  file: File
  name: string
  size: number
  originalUrl: string
  status: Status
  error: string | null
  /** Soft caveat on an otherwise-done result (e.g. the target size was unreachable). */
  note: string | null
  result: FileResult | null
}

function compressedName(name: string): string {
  return name.toLowerCase().endsWith(".pdf")
    ? `${name.slice(0, -4)}-compressed.pdf`
    : `${name}-compressed.pdf`
}

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" })
}

async function compressOnce(
  file: File,
  opts: { mode: Mode; quality: number; targetBytes: number }
): Promise<{ blob: Blob; note: string | null }> {
  const bytes = await file.arrayBuffer()

  // Never hand back something bigger than what came in — a text-only or
  // already-optimized PDF has little to give, so keep the original instead.
  const noGain = {
    blob: file as Blob,
    note: "This PDF is already about as small as it gets.",
  }

  if (opts.mode === "quality") {
    const out = await compressPdf(bytes, settingsForQuality(opts.quality))
    return out.length < file.size ? { blob: toBlob(out), note: null } : noGain
  }

  // Target-size mode: binary-search the highest quality whose output fits.
  let lo = 1
  let hi = 100
  let best: Uint8Array | null = null
  let smallest: Uint8Array | null = null
  for (let i = 0; i < 6 && lo <= hi; i++) {
    const mid = Math.round((lo + hi) / 2)
    const out = await compressPdf(bytes, settingsForQuality(mid))
    if (!smallest || out.length < smallest.length) smallest = out
    if (out.length <= opts.targetBytes) {
      best = out
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (best) return { blob: toBlob(best), note: null }

  const floor = await compressPdf(bytes, settingsForQuality(1))
  if (!smallest || floor.length < smallest.length) smallest = floor
  if (smallest.length >= file.size) return noGain
  return {
    blob: toBlob(smallest),
    note: `Couldn't reach ${formatBytes(opts.targetBytes)} — ${formatBytes(
      smallest.length
    )} is the smallest this PDF compresses to.`,
  }
}

export default function PdfCompressPage() {
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
      if (!isPdfFile(file)) throw new Error("Not a PDF.")
      return file
    },
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      size: file.size,
      originalUrl: URL.createObjectURL(file),
      status: "idle",
      error: null,
      note: null,
      result: null,
    }),
    cleanupJob: (job) => {
      URL.revokeObjectURL(job.originalUrl)
      if (job.result) URL.revokeObjectURL(job.result.url)
    },
  })
  const [mode, setMode] = useState<Mode>("quality")
  const [quality, setQuality] = useState(70)
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
  // a stale result (re-encoding every image in a big PDF can take seconds).
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
        result: setBlobResult(j.result, blob, compressedName(job.name)),
      }))
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong while compressing the PDF.",
      })
    }
  }

  // Recompress automatically whenever a setting changes. Jobs already
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
        ? "None of the selected files are PDFs."
        : null
    )
    // Seed the target-size field (once) to roughly half the first PDF.
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

  function downloadZip() {
    return downloadJobsAsZip(
      jobs,
      (job) => !!job.result,
      async (job) =>
        job.result
          ? { name: job.result.name, blob: await blobFromUrl(job.result.url) }
          : null,
      "compressed-pdfs.zip"
    )
  }

  const savings = activeJob?.result
    ? Math.round((1 - activeJob.result.size / activeJob.size) * 100)
    : null

  return (
    <ToolPage
      page="PDF Compress"
      icon={FileZipIcon}
      onAddFile={jobs.length > 0 ? dropzoneRef : undefined}
      fileStrip={
        jobs.length > 0 && (
          <JobStrip
            jobs={jobs.map((job) => ({ ...job, icon: Pdf02Icon }))}
            activeId={activeId}
            onSelect={setActiveId}
            onRemove={removeJob}
          />
        )
      }
      segments={{
        value: mode,
        onValueChange: (value) => setMode(value as Mode),
        label: "Mode",
        options: [
          { value: "quality", label: "Quality", icon: SparklesIcon },
          { value: "size", label: "Target size", icon: DartIcon },
        ],
      }}
      sidebar={{
        disabled: jobs.length === 0,
        slider: {
          hidden: mode !== "quality",
          label: "Image Quality",
          value: quality,
          onValueChange: setQuality,
          min: 1,
          max: 100,
          unit: "%",
        },
        inputs: [
          {
            hidden: mode !== "size",
            label: "Target Size (KB)",
            type: "number",
            min: 1,
            value: targetKb,
            onChange: setTargetKb,
          },
        ],
        hint: sizeInvalid
          ? "Enter a target size of at least 1 KB."
          : (activeJob?.note ?? undefined),
        download: {
          onDownload: downloadActive,
          disabled: !activeJob?.result,
          onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
          downloadAllDisabled: !jobs.some((job) => job.result),
          onDownloadZip: jobs.length > 1 ? downloadZip : undefined,
          downloadZipDisabled: !jobs.some((job) => job.result),
        },
      }}
    >
      <div className="flex flex-1 flex-col gap-4">
        {activeJob && (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <PreviewCard
              fill
              half
              title={`Original · ${formatBytes(activeJob.size)}`}
            >
              <PdfPreview
                key={activeJob.originalUrl}
                url={activeJob.originalUrl}
              />
            </PreviewCard>

            <PreviewCard
              fill
              half
              title={
                activeJob.result && savings !== null
                  ? `Compressed · ${formatBytes(activeJob.result.size)} · ${
                      savings > 0 ? `${savings}% smaller` : "unchanged"
                    }`
                  : "Compressed"
              }
              layer={
                activeJob.result
                  ? false
                  : activeJob.status === "compressing"
                    ? {
                        kind: "status",
                        icon: Loading03Icon,
                        spin: true,
                        message: "Compressing…",
                      }
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
            >
              {activeJob.result && (
                <PdfPreview
                  key={activeJob.result.url}
                  url={activeJob.result.url}
                />
              )}
            </PreviewCard>
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one file has been added. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop PDFs to upload"
          description="or, click to browse · shrink embedded images · in-browser only"
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
