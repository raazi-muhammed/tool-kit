"use client"

import {
  BracesIcon,
  Cancel01Icon,
  CircleIcon,
  CloudUploadIcon,
  Download04Icon,
  Loading03Icon,
  SmartPhone01Icon,
  Square01Icon,
  SquareRoundCornerIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { useRef, useState } from "react"

import { useAutoRunEnabled } from "@/components/auto-run-preference"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import {
  Attachment,
  AttachmentActions,
  AttachmentAction,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { addFilesReportingErrors, useFiles } from "@/hooks/use-files"
import {
  downloadAllJobs,
  downloadFile,
  setBlobResult,
  zipEntriesToBlob,
  type FileResult,
} from "@/lib/download"
import { loadImage } from "@/lib/image-file"
import type { IconShape } from "@/lib/ico"
import { PWA_ICON_SPECS, buildPwaIconSet } from "@/lib/pwa-icons"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "image/*"

const SHAPE_OPTIONS: {
  value: IconShape
  label: string
  icon: IconSvgElement
}[] = [
  { value: "square", label: "Square", icon: Square01Icon },
  { value: "rounded", label: "Rounded", icon: SquareRoundCornerIcon },
  { value: "circle", label: "Circle", icon: CircleIcon },
]

// A dimension hint for each generated file's `AttachmentDescription` — the
// manifest gets none since it has no pixel size.
const DIMENSION_LABEL: Record<string, string> = Object.fromEntries(
  PWA_ICON_SPECS.map((spec) => [spec.name, `${spec.size}×${spec.size}`])
)
DIMENSION_LABEL["favicon.ico"] = "16, 32, 48px"

type GeneratedFile = { name: string; url: string; size: number }

type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  status: "idle" | "generating" | "done" | "error"
  error: string | null
  files: GeneratedFile[]
  zip: FileResult | null
}

function zipFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "icons"
  return `${base}-pwa-icons.zip`
}

async function loadResource(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function PwaIconGeneratorPage() {
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
      files: [],
      zip: null,
    }),
    cleanupJob: (job) => {
      URL.revokeObjectURL(job.previewUrl)
      job.files.forEach((f) => URL.revokeObjectURL(f.url))
      if (job.zip) URL.revokeObjectURL(job.zip.url)
    },
  })
  const [error, setError] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState<string | null>(null)
  const [shape, setShape] = useState<IconShape>("square")
  const [appName, setAppName] = useState("My App")
  const { enabled: autoRunEnabled } = useAutoRunEnabled()

  const dropzoneRef = useRef<DropzoneHandle>(null)

  function addFiles(fileList: FileList | null | undefined) {
    return addFilesReportingErrors(
      addFilesToQueue,
      fileList,
      "None of the selected files could be loaded as images.",
      setError
    )
  }

  async function generateJob(job: Job, bg: string | null, targetShape: IconShape, name: string) {
    const img = getResource(job.id)
    if (!img) return
    updateJob(job.id, { status: "generating", error: null })
    try {
      const entries = await buildPwaIconSet(img, bg, targetShape, name)
      const files: GeneratedFile[] = entries.map((entry) => ({
        name: entry.name,
        url: URL.createObjectURL(entry.blob),
        size: entry.blob.size,
      }))
      const zipBlob = await zipEntriesToBlob(entries)
      updateJob(job.id, (j) => {
        j.files.forEach((f) => URL.revokeObjectURL(f.url))
        return {
          status: "done",
          error: null,
          files,
          zip: zipBlob
            ? setBlobResult(j.zip, zipBlob, zipFileName(job.name))
            : null,
        }
      })
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong while generating the icon set.",
      })
    }
  }

  function generate() {
    return Promise.all(jobs.map((job) => generateJob(job, bgColor, shape, appName)))
  }

  // With "Run automatically" on, regenerate every queued icon set whenever
  // the background, shape, or app name changes, instead of requiring an
  // explicit Generate click — debounced so typing the app name doesn't
  // re-encode on every keystroke.
  useDebouncedEffect(() => {
    if (!autoRunEnabled || jobs.length === 0) return
    void generate()
  }, [autoRunEnabled, bgColor, shape, appName, jobs.length])

  function download() {
    if (activeJob?.zip) downloadFile(activeJob.zip.url, activeJob.zip.name)
  }

  async function downloadJob(job: Job) {
    if (job.zip) downloadFile(job.zip.url, job.zip.name)
  }

  function downloadAll() {
    return downloadAllJobs(jobs, (job) => !!job.zip, downloadJob)
  }

  return (
    <ToolPage
      page="PWA Icon Generator"
      icon={SmartPhone01Icon}
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
              inputs: [
                { label: "App name", value: appName, onChange: setAppName },
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
              actions: [
                !autoRunEnabled && {
                  label: "Generate icon set",
                  icon: SmartPhone01Icon,
                  onClick: () => void generate(),
                },
              ],
              hint: "Includes favicon.ico, favicon PNGs, an apple-touch-icon, Android Chrome icons, and a web app manifest.",
              download: {
                onDownload: download,
                disabled: !activeJob.zip,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
                downloadAllDisabled: !jobs.some((job) => job.zip),
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
              title="Icon set"
              layer={
                activeJob.status === "generating"
                  ? { kind: "status", icon: Loading03Icon, spin: true }
                  : activeJob.status === "error"
                    ? {
                        kind: "status",
                        message:
                          activeJob.error ??
                          "Something went wrong while generating the icon set.",
                      }
                    : activeJob.files.length > 0
                      ? {
                          kind: "list",
                          children: activeJob.files.map((f) => (
                            <Attachment key={f.name} className="w-full">
                              <AttachmentMedia
                                variant={
                                  f.name === "site.webmanifest"
                                    ? "icon"
                                    : "image"
                                }
                              >
                                {f.name === "site.webmanifest" ? (
                                  <HugeiconsIcon icon={BracesIcon} aria-hidden />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={f.url} alt="" />
                                )}
                              </AttachmentMedia>
                              <AttachmentContent>
                                <AttachmentTitle>{f.name}</AttachmentTitle>
                                <AttachmentDescription>
                                  {f.name === "site.webmanifest"
                                    ? `Web app manifest · ${formatBytes(f.size)}`
                                    : `${DIMENSION_LABEL[f.name] ?? ""} · ${formatBytes(f.size)}`}
                                </AttachmentDescription>
                              </AttachmentContent>
                              <AttachmentActions>
                                <AttachmentAction
                                  aria-label={`Download ${f.name}`}
                                  onClick={() => downloadFile(f.url, f.name)}
                                >
                                  <HugeiconsIcon
                                    icon={Download04Icon}
                                    aria-hidden
                                  />
                                </AttachmentAction>
                              </AttachmentActions>
                            </Attachment>
                          )),
                        }
                      : {
                          kind: "status",
                          message: autoRunEnabled
                            ? "Generating automatically…"
                            : "Set an app name and hit Generate icon set",
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
          description="or, click to browse · generates the full PWA icon set · in-browser only"
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
