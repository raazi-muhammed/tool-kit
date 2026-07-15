"use client"

import {
  AlertCircleIcon,
  CloudUploadIcon,
  ComputerIcon,
  Download04Icon,
  Image02Icon,
  ImageDownloadIcon,
  Loading03Icon,
  Pdf02Icon,
  PrinterIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRef, useState } from "react"

import { useAutoRunEnabled } from "@/components/auto-run-preference"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PdfPreview } from "@/components/pdf-preview"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { useFiles } from "@/hooks/use-files"
import { downloadFile, downloadStagger } from "@/lib/download"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "application/pdf,.pdf"

type Format = "png" | "jpeg"
type Resolution = "screen" | "standard" | "high"
type Status = "idle" | "converting" | "done" | "error"
type PageImage = { pageNumber: number; url: string; size: number }
type Job = {
  id: number
  file: File
  name: string
  size: number
  previewUrl: string
  validFile: boolean
  status: Status
  error: string | null
  pages: PageImage[]
}

const FORMAT_MIME: Record<Format, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
}

// A PDF page's own coordinate space is 72 units/inch, so a pdfjs render
// `scale` of 1 is 72 DPI — these map each resolution option to the scale
// that produces it.
const RESOLUTION_SCALE: Record<Resolution, number> = {
  screen: 1,
  standard: 150 / 72,
  high: 300 / 72,
}

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  )
}

function pageFileName(job: Job, page: PageImage, format: Format): string {
  const base = job.name.toLowerCase().endsWith(".pdf")
    ? job.name.slice(0, -4)
    : job.name
  const ext = format === "jpeg" ? "jpg" : "png"
  return `${base}-page-${String(page.pageNumber).padStart(2, "0")}.${ext}`
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

// react-pdf wraps pdfjs-dist in browser-only canvas rendering, so it's
// loaded client-side only, memoized after the first call — mirrors
// components/pdf-preview.tsx's worker setup, needed here too since this
// page renders pages imperatively (to export them) rather than declaratively.
let pdfjsPromise: Promise<(typeof import("react-pdf"))["pdfjs"]> | null = null

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("react-pdf").then((mod) => {
      mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      return mod.pdfjs
    })
  }
  return pdfjsPromise
}

export default function PdfToImagesPage() {
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
      const valid = isPdfFile(file)
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        validFile: valid,
        status: valid ? "idle" : "error",
        error: valid ? null : "This file doesn't look like a PDF.",
        pages: [],
      }
    },
    cleanupJob: (job) => {
      URL.revokeObjectURL(job.previewUrl)
      job.pages.forEach((page) => URL.revokeObjectURL(page.url))
    },
  })
  const [format, setFormat] = useState<Format>("png")
  const [quality, setQuality] = useState(92)
  const [resolution, setResolution] = useState<Resolution>("standard")
  const [previewPage, setPreviewPage] = useState<PageImage | null>(null)
  const { enabled: autoRunEnabled } = useAutoRunEnabled()
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const anyBusy = jobs.some((job) => job.status === "converting")

  function selectJob(id: number) {
    setActiveId(id)
    setPreviewPage(null)
  }

  function remove(id: number) {
    removeJob(id)
    setPreviewPage(null)
  }

  async function convertJob(job: Job, fmt: Format, q: number, res: Resolution) {
    updateJob(job.id, { status: "converting", error: null })

    try {
      const pdfjs = await loadPdfjs()
      const doc = await pdfjs.getDocument(job.previewUrl).promise
      const pages: PageImage[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const viewport = page.getViewport({ scale: RESOLUTION_SCALE[res] })
        const canvas = document.createElement("canvas")
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas isn't supported in this browser.")
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        const blob = await canvasToBlob(canvas, FORMAT_MIME[fmt], q / 100)
        pages.push({
          pageNumber: i,
          url: URL.createObjectURL(blob),
          size: blob.size,
        })
      }

      updateJob(job.id, (j) => {
        j.pages.forEach((page) => URL.revokeObjectURL(page.url))
        return { status: "done", error: null, pages }
      })
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong while converting the PDF.",
      })
    }
  }

  function convert() {
    if (!activeJob || !activeJob.validFile || activeJob.status === "converting")
      return
    void convertJob(activeJob, format, quality, resolution)
  }

  function convertAll() {
    jobs.forEach((job) => {
      if (job.validFile && job.status !== "converting")
        void convertJob(job, format, quality, resolution)
    })
  }

  // With "Run automatically" on, re-render every queued PDF's pages
  // whenever the shared format/quality/resolution settings change, instead
  // of requiring an explicit Convert click — debounced so dragging the
  // quality slider doesn't re-render on every tick, only once it settles.
  useDebouncedEffect(
    () => {
      if (!autoRunEnabled) return
      jobs.forEach((job) => {
        if (job.validFile && job.status !== "converting")
          void convertJob(job, format, quality, resolution)
      })
    },
    [autoRunEnabled, format, quality, resolution, jobs.length]
  )

  async function downloadPages(job: Job) {
    for (const page of job.pages) {
      downloadFile(page.url, pageFileName(job, page, format))
      await downloadStagger()
    }
  }

  function download() {
    if (activeJob) void downloadPages(activeJob)
  }

  async function downloadAll() {
    for (const job of jobs) await downloadPages(job)
  }

  return (
    <ToolPage
      page="PDF to Images"
      icon={ImageDownloadIcon}
      onAddFile={jobs.length > 0 ? dropzoneRef : undefined}
      fileStrip={
        jobs.length > 0 && (
          <JobStrip
            jobs={jobs.map((job) => ({ ...job, icon: Pdf02Icon }))}
            activeId={activeId}
            onSelect={selectJob}
            onRemove={remove}
          />
        )
      }
      sidebar={
        jobs.length > 0
          ? {
              segments: {
                value: format,
                onValueChange: (value) => setFormat(value as Format),
                label: "Format",
                options: [
                  { value: "png", label: "PNG", icon: Image02Icon },
                  { value: "jpeg", label: "JPEG", icon: Image02Icon },
                ],
                disabled: anyBusy,
              },
              groups: [
                {
                  label: "Resolution",
                  value: resolution,
                  onValueChange: (value) => setResolution(value as Resolution),
                  disabled: anyBusy,
                  variant: "select",
                  options: [
                    {
                      value: "screen",
                      label: "Screen (72 DPI)",
                      icon: ComputerIcon,
                    },
                    {
                      value: "standard",
                      label: "Standard (150 DPI)",
                      icon: Image02Icon,
                    },
                    {
                      value: "high",
                      label: "High (300 DPI)",
                      icon: PrinterIcon,
                    },
                  ],
                },
              ],
              slider:
                format === "jpeg"
                  ? {
                      label: "Quality",
                      value: quality,
                      onValueChange: setQuality,
                      min: 1,
                      max: 100,
                      unit: "%",
                    }
                  : undefined,
              actions: [
                !autoRunEnabled && {
                  label: "Convert",
                  icon: ImageDownloadIcon,
                  onClick: convert,
                  disabled: anyBusy || !activeJob?.validFile,
                  more:
                    jobs.length > 1
                      ? {
                          label: "Convert all",
                          icon: ImageDownloadIcon,
                          onClick: convertAll,
                          disabled: anyBusy,
                        }
                      : undefined,
                },
              ],
              download: {
                onDownload: download,
                disabled: !activeJob?.pages.length,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
                downloadAllDisabled: !jobs.some((job) => job.pages.length),
              },
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {activeJob && (
          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
            <PreviewCard
              fill
              title="Original"
              layer={
                activeJob.validFile
                  ? false
                  : {
                      kind: "status",
                      icon: AlertCircleIcon,
                      tone: "destructive",
                      message: activeJob.error,
                    }
              }
            >
              {activeJob.validFile && (
                <PdfPreview
                  key={activeJob.previewUrl}
                  url={activeJob.previewUrl}
                />
              )}
            </PreviewCard>

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <span className="text-sm text-muted-foreground">Images</span>
              <Card className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
                {activeJob.status === "converting" ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      className="size-8 animate-spin"
                      aria-hidden
                    />
                    <p className="text-sm">Converting…</p>
                  </div>
                ) : activeJob.status === "error" ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-destructive">
                    <HugeiconsIcon
                      icon={AlertCircleIcon}
                      className="size-8"
                      aria-hidden
                    />
                    <p className="text-sm">{activeJob.error}</p>
                  </div>
                ) : activeJob.pages.length > 0 ? (
                  activeJob.pages.map((page) => (
                    <Attachment key={page.pageNumber} className="w-full">
                      <AttachmentTrigger
                        aria-label={`Preview page ${page.pageNumber}`}
                        onClick={() => setPreviewPage(page)}
                      />
                      <AttachmentMedia variant="image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={page.url} alt="" />
                      </AttachmentMedia>
                      <AttachmentContent>
                        <AttachmentTitle>
                          Page {page.pageNumber}
                        </AttachmentTitle>
                        <AttachmentDescription>
                          {formatBytes(page.size)}
                        </AttachmentDescription>
                      </AttachmentContent>
                      <AttachmentActions>
                        <AttachmentAction
                          aria-label={`Download page ${page.pageNumber}`}
                          onClick={() =>
                            downloadFile(
                              page.url,
                              pageFileName(activeJob, page, format)
                            )
                          }
                        >
                          <HugeiconsIcon icon={Download04Icon} aria-hidden />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  ))
                ) : (
                  <p className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    {autoRunEnabled
                      ? "Pick a format — pages convert automatically"
                      : "Pick a format, then hit Convert"}
                  </p>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one file has been added. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop PDFs to upload"
          description="or, click to browse · export each page as an image · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />
      </div>

      <Dialog
        open={!!previewPage}
        onOpenChange={(open) => !open && setPreviewPage(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {previewPage ? `Page ${previewPage.pageNumber}` : ""}
            </DialogTitle>
          </DialogHeader>
          {previewPage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewPage.url}
              alt=""
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </ToolPage>
  )
}
