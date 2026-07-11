"use client"

import { PDFDocument } from "@cantoo/pdf-lib"
import {
  AlertCircleIcon,
  CloudUploadIcon,
  FileUnlockedIcon,
  Loading03Icon,
  Pdf02Icon,
} from "@hugeicons/core-free-icons"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useFiles } from "@/hooks/use-files"
import { downloadFile, downloadStagger } from "@/lib/download"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "application/pdf,.pdf"

// react-pdf wraps pdfjs-dist in browser-only canvas rendering, so both are
// loaded client-side only (`ssr: false`) — a top-level import crashes Next's
// server-side prerendering the same way a bare pdfjs-dist import would.
const PdfDocument = dynamic(
  () =>
    import("react-pdf").then((mod) => {
      mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      return mod.Document
    }),
  { ssr: false }
)
const PdfPage = dynamic(() => import("react-pdf").then((mod) => mod.Page), {
  ssr: false,
})

// One unlocked result, rendered as a scrollable stack of pages — keyed by
// its blob URL in the parent so switching jobs remounts with fresh state
// instead of carrying over the previous file's page count.
function PdfPreview({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  // Pages render at this pixel width (react-pdf scales the PDF to fit) so
  // wide pages shrink to the panel instead of overflowing it horizontally.
  const [pageWidth, setPageWidth] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setPageWidth(entry.contentRect.width)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex max-h-[calc(100dvh-220px)] w-full flex-col items-center gap-4 overflow-y-auto p-4"
    >
      <PdfDocument
        file={url}
        onLoadSuccess={({ numPages }: { numPages: number }) =>
          setNumPages(numPages)
        }
      >
        {Array.from({ length: numPages }, (_, index) => (
          <PdfPage
            key={index}
            pageNumber={index + 1}
            width={pageWidth || undefined}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-md"
          />
        ))}
      </PdfDocument>
    </div>
  )
}

type Status = "idle" | "unlocking" | "done" | "error"
type Result = { url: string; name: string; size: number }
type Job = {
  id: number
  file: File
  name: string
  size: number
  validFile: boolean
  status: Status
  error: string | null
  result: Result | null
}

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  )
}

function unlockedName(name: string): string {
  return name.toLowerCase().endsWith(".pdf")
    ? `${name.slice(0, -4)}-unlocked.pdf`
    : `${name}-unlocked.pdf`
}

export default function PdfUnlockPage() {
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
        validFile: valid,
        status: valid ? "idle" : "error",
        error: valid ? null : "This file doesn't look like a PDF.",
        result: null,
      }
    },
    cleanupJob: (job) => {
      if (job.result) URL.revokeObjectURL(job.result.url)
    },
  })
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const anyBusy = jobs.some((job) => job.status === "unlocking")

  async function unlockJob(job: Job, pwd: string) {
    updateJob(job.id, { status: "unlocking", error: null })

    try {
      const bytes = await job.file.arrayBuffer()
      const doc = await PDFDocument.load(bytes, { password: pwd })
      const unlockedBytes = await doc.save()
      const blob = new Blob([unlockedBytes as BlobPart], {
        type: "application/pdf",
      })

      updateJob(job.id, (j) => {
        if (j.result) URL.revokeObjectURL(j.result.url)
        const url = URL.createObjectURL(blob)
        return {
          status: "done",
          error: null,
          result: { url, name: unlockedName(j.name), size: blob.size },
        }
      })
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof Error && err.message === "Password incorrect"
            ? "That password doesn't unlock this PDF."
            : err instanceof Error
              ? err.message
              : "Something went wrong while unlocking the PDF.",
      })
    }
  }

  function unlock() {
    if (!password) {
      setFormError("Enter the PDF's password.")
      return
    }
    if (!activeJob || !activeJob.validFile || activeJob.status === "unlocking")
      return
    setFormError(null)
    void unlockJob(activeJob, password)
  }

  function unlockAll() {
    if (!password) {
      setFormError("Enter the PDF's password.")
      return
    }
    setFormError(null)
    jobs.forEach((job) => {
      if (job.validFile && job.status !== "unlocking")
        void unlockJob(job, password)
    })
  }

  async function downloadJob(job: Job) {
    if (job.result) downloadFile(job.result.url, job.result.name)
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  async function downloadAll() {
    for (const job of jobs) {
      if (!job.result) continue
      await downloadJob(job)
      await downloadStagger()
    }
  }

  return (
    <ToolPage
      page="PDF Unlock"
      icon={FileUnlockedIcon}
      onAddFile={
        jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined
      }
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
      sidebar={
        jobs.length > 0
          ? {
              inputs: [
                {
                  label: "Password",
                  type: "password",
                  value: password,
                  onChange: setPassword,
                  disabled: anyBusy,
                  onEnter: unlock,
                },
              ],
              actions: [
                {
                  label: "Unlock",
                  icon: FileUnlockedIcon,
                  onClick: unlock,
                  disabled: anyBusy || !activeJob?.validFile,
                  more:
                    jobs.length > 1
                      ? {
                          label: "Unlock all",
                          icon: FileUnlockedIcon,
                          onClick: unlockAll,
                          disabled: anyBusy,
                        }
                      : undefined,
                },
              ],
              download: {
                onDownload: download,
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
          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
            <PreviewCard
              fill
              title="Original"
              layer={
                activeJob.validFile
                  ? {
                      kind: "status",
                      icon: Pdf02Icon,
                      message: (
                        <>
                          {activeJob.name}
                          <br />
                          {formatBytes(activeJob.size)}
                        </>
                      ),
                    }
                  : {
                      kind: "status",
                      icon: AlertCircleIcon,
                      tone: "destructive",
                      message: activeJob.error,
                    }
              }
            />

            <PreviewCard
              fill
              title="Unlocked"
              layer={
                activeJob.status === "unlocking"
                  ? {
                      kind: "status",
                      icon: Loading03Icon,
                      spin: true,
                      message: "Unlocking…",
                    }
                  : activeJob.status === "error"
                    ? {
                        kind: "status",
                        icon: AlertCircleIcon,
                        tone: "destructive",
                        message: activeJob.error,
                      }
                    : false
              }
            >
              {activeJob.result ? (
                <PdfPreview
                  key={activeJob.result.url}
                  url={activeJob.result.url}
                />
              ) : (
                <p className="px-6 text-center text-sm text-muted-foreground">
                  Enter the password, then hit Unlock
                </p>
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
          description="or, click to browse · remove the password from a PDF · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />

        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </div>
    </ToolPage>
  )
}
