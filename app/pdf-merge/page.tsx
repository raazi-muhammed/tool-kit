"use client"

import { PDFDocument } from "@cantoo/pdf-lib"
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CloudUploadIcon,
  FileStackIcon,
  Loading03Icon,
  Pdf02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRef, useState } from "react"

import { useAutoRunEnabled } from "@/components/auto-run-preference"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
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
import { useOrderedFiles } from "@/hooks/use-ordered-files"
import { downloadFile } from "@/lib/download"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "application/pdf,.pdf"

type Job = {
  id: number
  file: File
  name: string
  size: number
  validFile: boolean
  error: string | null
}

type Status = "idle" | "merging" | "done" | "error"
type Result = { url: string; name: string; size: number }

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  )
}

export default function PdfMergePage() {
  const { jobs, orderedJobs, addFilesOrdered, removeOrdered, moveJob } =
    useOrderedFiles<Job>({
      createJob: (file, id) => {
        const valid = isPdfFile(file)
        return {
          id,
          file,
          name: file.name,
          size: file.size,
          validFile: valid,
          error: valid ? null : "This file doesn't look like a PDF.",
        }
      },
    })
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const { enabled: autoRunEnabled } = useAutoRunEnabled()
  const [previewJob, setPreviewJob] = useState<{
    id: number
    name: string
    url: string
  } | null>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  function openPreview(job: Job) {
    setPreviewJob({
      id: job.id,
      name: job.name,
      url: URL.createObjectURL(job.file),
    })
  }

  function closePreview() {
    setPreviewJob((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  const validCount = orderedJobs.filter((job) => job.validFile).length
  const busy = status === "merging"

  function remove(id: number) {
    removeOrdered(id)
    if (previewJob?.id === id) closePreview()
    if (result) {
      URL.revokeObjectURL(result.url)
      setResult(null)
      setStatus("idle")
    }
  }

  async function merge() {
    if (validCount < 2 || busy) return
    setStatus("merging")
    setError(null)

    try {
      const merged = await PDFDocument.create()
      for (const job of orderedJobs) {
        if (!job.validFile) continue
        const bytes = await job.file.arrayBuffer()
        const doc = await PDFDocument.load(bytes)
        const pages = await merged.copyPages(doc, doc.getPageIndices())
        pages.forEach((page) => merged.addPage(page))
      }
      const mergedBytes = await merged.save()
      const blob = new Blob([mergedBytes as BlobPart], {
        type: "application/pdf",
      })

      if (result) URL.revokeObjectURL(result.url)
      const url = URL.createObjectURL(blob)
      setResult({ url, name: "merged.pdf", size: blob.size })
      setStatus("done")
    } catch (err) {
      setStatus("error")
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while merging the PDFs."
      )
    }
  }

  function download() {
    if (result) downloadFile(result.url, result.name)
  }

  // With "Run automatically" on, re-merge whenever the file set or its order
  // changes, instead of requiring an explicit Merge click — debounced so
  // clicking the reorder arrows repeatedly doesn't re-read every PDF on each
  // click, only once the order settles. `merge` itself already no-ops while
  // a merge is in flight (`busy`) or there aren't 2 valid PDFs yet.
  const orderKey = orderedJobs.map((job) => job.id).join(",")
  useDebouncedEffect(
    () => {
      if (!autoRunEnabled || validCount < 2) return
      void merge()
    },
    [autoRunEnabled, orderKey, validCount],
    500
  )

  return (
    <ToolPage
      page="PDF Merge"
      icon={FileStackIcon}
      onAddFile={jobs.length > 0 ? dropzoneRef : undefined}
      sidebar={
        jobs.length > 0
          ? {
              actions: [
                !autoRunEnabled && {
                  label: "Merge",
                  icon: FileStackIcon,
                  onClick: merge,
                  disabled: busy || validCount < 2,
                },
              ],
              hint:
                validCount < 2 ? "Add at least 2 PDFs to merge." : undefined,
              download: {
                onDownload: download,
                disabled: !result,
              },
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {jobs.length > 0 && (
          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <span className="text-sm text-muted-foreground">Files</span>
              <Card className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
                {orderedJobs.map((job, index) => (
                  <Attachment
                    key={job.id}
                    state={job.validFile ? "done" : "error"}
                    className="w-full"
                  >
                    {job.validFile && (
                      <AttachmentTrigger
                        aria-label={`Preview ${job.name}`}
                        onClick={() => openPreview(job)}
                      />
                    )}
                    <AttachmentMedia>
                      <HugeiconsIcon icon={Pdf02Icon} aria-hidden />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{job.name}</AttachmentTitle>
                      <AttachmentDescription>
                        {job.validFile ? formatBytes(job.size) : job.error}
                      </AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      <AttachmentAction
                        aria-label={`Move ${job.name} up`}
                        disabled={busy || index === 0}
                        onClick={() => moveJob(job.id, -1)}
                      >
                        <HugeiconsIcon icon={ArrowUp01Icon} aria-hidden />
                      </AttachmentAction>
                      <AttachmentAction
                        aria-label={`Move ${job.name} down`}
                        disabled={busy || index === orderedJobs.length - 1}
                        onClick={() => moveJob(job.id, 1)}
                      >
                        <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden />
                      </AttachmentAction>
                      <AttachmentAction
                        aria-label={`Remove ${job.name}`}
                        disabled={busy}
                        onClick={() => remove(job.id)}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
                      </AttachmentAction>
                    </AttachmentActions>
                  </Attachment>
                ))}
              </Card>
            </div>

            <PreviewCard
              fill
              title="Merged"
              layer={
                busy
                  ? {
                      kind: "status",
                      icon: Loading03Icon,
                      spin: true,
                      message: "Merging…",
                    }
                  : status === "error"
                    ? {
                        kind: "status",
                        icon: AlertCircleIcon,
                        tone: "destructive",
                        message: error,
                      }
                    : false
              }
            >
              {result ? (
                <PdfPreview key={result.url} url={result.url} />
              ) : (
                <p className="px-6 text-center text-sm text-muted-foreground">
                  {autoRunEnabled
                    ? "Add at least 2 PDFs — they'll merge automatically"
                    : "Add PDFs, arrange their order, then hit Merge"}
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
          description="or, click to browse · combine multiple PDFs into one · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFilesOrdered}
        />
      </div>

      <Dialog
        open={!!previewJob}
        onOpenChange={(open) => !open && closePreview()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewJob?.name}</DialogTitle>
          </DialogHeader>
          {previewJob && (
            <PdfPreview key={previewJob.url} url={previewJob.url} />
          )}
        </DialogContent>
      </Dialog>
    </ToolPage>
  )
}
