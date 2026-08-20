"use client"

import {
  BrowserIcon,
  Cancel01Icon,
  CircleIcon,
  CloudUploadIcon,
  Loading03Icon,
  Square01Icon,
  SquareIcon,
  SquareRoundCornerIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { useRef, useState } from "react"

import { useAutoRunEnabled } from "@/components/auto-run-preference"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { addFilesReportingErrors, useFiles } from "@/hooks/use-files"
import {
  blobFromUrl,
  downloadAllJobs,
  downloadFile,
  downloadJobsAsZip,
  setBlobResult,
  type FileResult,
  type ZipEntry,
} from "@/lib/download"
import { loadImage } from "@/lib/image-file"
import { buildIco, type IconShape } from "@/lib/ico"
import { replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*"
const FAVICON_SIZES = [16, 32, 48]
const APP_ICON_SIZES = [64, 128, 256]
const ALL_SIZES = [...FAVICON_SIZES, ...APP_ICON_SIZES]

const SHAPE_OPTIONS: {
  value: IconShape
  label: string
  icon: IconSvgElement
}[] = [
  { value: "square", label: "Square", icon: Square01Icon },
  { value: "rounded", label: "Rounded", icon: SquareRoundCornerIcon },
  { value: "circle", label: "Circle", icon: CircleIcon },
]

type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  status: "idle" | "generating" | "done" | "error"
  error: string | null
  result: FileResult | null
}

async function loadResource(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function FaviconCreatorPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles: addFilesToQueue,
    updateJob,
    removeJob,
    getResource,
  } = useFiles<Job, HTMLImageElement>({
    loadResource,
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "idle",
      error: null,
      result: null,
    }),
    cleanupJob: (job) => {
      URL.revokeObjectURL(job.previewUrl)
      if (job.result) URL.revokeObjectURL(job.result.url)
    },
  })
  const [error, setError] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState<string | null>(null)
  const [sizes, setSizes] = useState<number[]>(ALL_SIZES)
  const [shape, setShape] = useState<IconShape>("square")
  const { enabled: autoRunEnabled } = useAutoRunEnabled()

  const dropzoneRef = useRef<DropzoneHandle>(null)

  function toggleSize(size: number) {
    setSizes((prev) => {
      if (!prev.includes(size)) return [...prev, size].sort((a, b) => a - b)
      // Keep at least one size selected — an empty ICO isn't useful.
      if (prev.length === 1) return prev
      return prev.filter((s) => s !== size)
    })
  }

  function addFiles(fileList: FileList | null | undefined) {
    return addFilesReportingErrors(
      addFilesToQueue,
      fileList,
      "None of the selected files could be loaded as images.",
      setError
    )
  }

  async function generateJob(
    job: Job,
    targetSizes: number[],
    bg: string | null,
    targetShape: IconShape
  ) {
    const img = getResource(job.id)
    if (!img) return
    updateJob(job.id, { status: "generating", error: null })
    try {
      const blob = await buildIco(img, targetSizes, bg, targetShape)
      updateJob(job.id, (j) => ({
        status: "done",
        error: null,
        result: setBlobResult(
          j.result,
          blob,
          replaceExtension(job.name, "ico")
        ),
      }))
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong while generating the icon.",
      })
    }
  }

  function generate() {
    if (sizes.length === 0) return
    return Promise.all(
      jobs.map((job) => generateJob(job, sizes, bgColor, shape))
    )
  }

  // With "Run automatically" on, regenerate every queued icon whenever the
  // selected sizes, background, or shape change, instead of requiring an
  // explicit Generate click — debounced so toggling several sizes in a row
  // doesn't re-encode on every click.
  useDebouncedEffect(() => {
    if (!autoRunEnabled || jobs.length === 0) return
    void generate()
  }, [autoRunEnabled, sizes.join(","), bgColor, shape, jobs.length])

  function download() {
    if (activeJob?.result)
      downloadFile(activeJob.result.url, activeJob.result.name)
  }

  async function downloadJob(job: Job) {
    if (job.result) downloadFile(job.result.url, job.result.name)
  }

  function downloadAll() {
    return downloadAllJobs(jobs, (job) => !!job.result, downloadJob)
  }

  async function blobForJob(job: Job): Promise<ZipEntry | null> {
    if (!job.result) return null
    return { name: job.result.name, blob: await blobFromUrl(job.result.url) }
  }

  function downloadZip() {
    return downloadJobsAsZip(
      jobs,
      (job) => !!job.result,
      blobForJob,
      "favicons.zip"
    )
  }

  function sizeAction(size: number) {
    const selected = sizes.includes(size)
    return {
      label: `${size}px`,
      icon: SquareIcon,
      onClick: () => toggleSize(size),
      variant: selected ? ("secondary" as const) : ("outline" as const),
    }
  }

  return (
    <ToolPage
      page="Favicon Creator"
      icon={BrowserIcon}
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
        activeJob
          ? {
              segments: {
                label: "Shape",
                value: shape,
                onValueChange: (value) => setShape(value as IconShape),
                options: SHAPE_OPTIONS,
              },
              actions: [
                {
                  label: "Favicon sizes",
                  placement: "top",
                  actions: FAVICON_SIZES.map(sizeAction),
                },
                {
                  label: "App icon sizes",
                  placement: "top",
                  actions: APP_ICON_SIZES.map(sizeAction),
                },
                !autoRunEnabled && {
                  label: "Generate ICO",
                  icon: BrowserIcon,
                  onClick: () => void generate(),
                },
              ],
              color: {
                label: "Background",
                value: bgColor,
                onChange: setBgColor,
                fallback: "#ffffff",
                nullLabel: "transparent",
                clearLabel: "Transparent",
                clearIcon: Cancel01Icon,
              },
              hint: `Includes ${sizes.join(", ")}px. Works best with a square logo.`,
              download: {
                onDownload: download,
                disabled: !activeJob.result,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
                downloadAllDisabled: !jobs.some((job) => job.result),
                onDownloadZip: jobs.length > 1 ? downloadZip : undefined,
                downloadZipDisabled: !jobs.some((job) => job.result),
              },
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {activeJob && (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <PreviewCard
              fill
              half
              checkerboard
              title="Original"
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
              title="Icon preview"
              layer={
                activeJob.status === "generating"
                  ? { kind: "status", icon: Loading03Icon, spin: true }
                  : activeJob.status === "error"
                    ? {
                        kind: "status",
                        message:
                          activeJob.error ??
                          "Something went wrong while generating the icon.",
                      }
                    : activeJob.result
                      ? {
                          kind: "image",
                          src: activeJob.result.url,
                          alt: activeJob.result.name,
                          className: "h-full w-full object-contain",
                        }
                      : {
                          kind: "status",
                          message: autoRunEnabled
                            ? "Generating automatically…"
                            : "Pick sizes and hit Generate ICO",
                        }
              }
            />
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one file has been added. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop a logo to upload"
          description="or, click to browse · packs multiple resolutions into one .ico · in-browser only"
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
