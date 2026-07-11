"use client"

import { PDFDocument } from "@cantoo/pdf-lib"
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  BorderAll01Icon,
  BorderAll02Icon,
  BorderNone01Icon,
  Cancel01Icon,
  CloudUploadIcon,
  FitToScreenIcon,
  LegalDocument01Icon,
  Loading03Icon,
  Note01Icon,
  Pdf01Icon,
  SmartPhone01Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRef, useState } from "react"

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
import { addFilesReportingErrors } from "@/hooks/use-files"
import { useOrderedFiles } from "@/hooks/use-ordered-files"
import { downloadFile } from "@/lib/download"
import { loadImageAsCanvas } from "@/lib/image-file"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "image/*"

type Orientation = "portrait" | "landscape"
type PageSize = "fit" | "a4" | "letter"
type Margin = "none" | "small" | "big"

type Job = {
  id: number
  file: File
  name: string
  size: number
  previewUrl: string
}

type Status = "idle" | "converting" | "done" | "error"
type Result = { url: string; name: string; size: number }

// A4/Letter in PDF points (72 pt/in), portrait orientation.
const PAGE_SIZES_PT: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}
const MARGIN_PT: Record<Margin, number> = { none: 0, small: 24, big: 56 }

function pageDimensions(
  pageSize: PageSize,
  orientation: Orientation,
  canvas: HTMLCanvasElement,
  marginPt: number
): [number, number] {
  if (pageSize === "fit")
    return [canvas.width + marginPt * 2, canvas.height + marginPt * 2]
  const [portraitWidth, portraitHeight] = PAGE_SIZES_PT[pageSize]
  return orientation === "landscape"
    ? [portraitHeight, portraitWidth]
    : [portraitWidth, portraitHeight]
}

async function canvasToPngBytes(
  canvas: HTMLCanvasElement
): Promise<Uint8Array> {
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  )
  if (!blob) throw new Error("Couldn't encode an image for the PDF.")
  return new Uint8Array(await blob.arrayBuffer())
}

// Adds one page for `canvas` to `pdfDoc` — sized to the image itself under
// "Fit to image", or to the chosen page size/orientation with the image
// scaled down (preserving aspect ratio) to fit inside the margin.
async function addImagePage(
  pdfDoc: PDFDocument,
  canvas: HTMLCanvasElement,
  pageSize: PageSize,
  orientation: Orientation,
  margin: Margin
) {
  const marginPt = MARGIN_PT[margin]
  const [pageWidth, pageHeight] = pageDimensions(
    pageSize,
    orientation,
    canvas,
    marginPt
  )
  const page = pdfDoc.addPage([pageWidth, pageHeight])
  const pngBytes = await canvasToPngBytes(canvas)
  const image = await pdfDoc.embedPng(pngBytes)

  if (pageSize === "fit") {
    page.drawImage(image, {
      x: marginPt,
      y: marginPt,
      width: canvas.width,
      height: canvas.height,
    })
    return
  }

  const availWidth = pageWidth - marginPt * 2
  const availHeight = pageHeight - marginPt * 2
  const scale = Math.min(availWidth / canvas.width, availHeight / canvas.height)
  const drawWidth = canvas.width * scale
  const drawHeight = canvas.height * scale
  page.drawImage(image, {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  })
}

export default function ImageToPdfPage() {
  const {
    jobs,
    orderedJobs,
    addFilesOrdered: addFilesToQueue,
    removeOrdered,
    moveJob,
    getResource,
  } = useOrderedFiles<Job, HTMLCanvasElement>({
    loadResource: loadImageAsCanvas,
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    }),
    cleanupJob: (job) => URL.revokeObjectURL(job.previewUrl),
  })
  const [orientation, setOrientation] = useState<Orientation>("portrait")
  const [pageSize, setPageSize] = useState<PageSize>("fit")
  const [margin, setMargin] = useState<Margin>("none")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [previewJob, setPreviewJob] = useState<Job | null>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const busy = status === "converting"

  function addFiles(fileList: FileList | null | undefined) {
    return addFilesReportingErrors(
      addFilesToQueue,
      fileList,
      "None of the selected files could be loaded as images.",
      setFormError
    )
  }

  function remove(id: number) {
    removeOrdered(id)
    if (previewJob?.id === id) setPreviewJob(null)
    if (result) {
      URL.revokeObjectURL(result.url)
      setResult(null)
      setStatus("idle")
    }
  }

  async function convert() {
    if (orderedJobs.length < 1 || busy) return
    setStatus("converting")
    setError(null)

    try {
      const pdfDoc = await PDFDocument.create()
      for (const job of orderedJobs) {
        const canvas = getResource(job.id)
        if (!canvas) continue
        await addImagePage(pdfDoc, canvas, pageSize, orientation, margin)
      }
      const bytes = await pdfDoc.save()
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })

      if (result) URL.revokeObjectURL(result.url)
      const url = URL.createObjectURL(blob)
      setResult({ url, name: "images.pdf", size: blob.size })
      setStatus("done")
    } catch (err) {
      setStatus("error")
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while creating the PDF."
      )
    }
  }

  function download() {
    if (result) downloadFile(result.url, result.name)
  }

  return (
    <ToolPage
      page="Image to PDF"
      icon={Pdf01Icon}
      onAddFile={
        jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined
      }
      sidebar={
        jobs.length > 0
          ? {
              groups: [
                {
                  label: "Page orientation",
                  value: orientation,
                  onValueChange: (value) =>
                    setOrientation(value as Orientation),
                  disabled: busy || pageSize === "fit",
                  options: [
                    {
                      value: "portrait",
                      label: "Portrait",
                      icon: SmartPhone01Icon,
                    },
                    { value: "landscape", label: "Landscape", icon: Tv01Icon },
                  ],
                },
                {
                  label: "Page size",
                  value: pageSize,
                  onValueChange: (value) => setPageSize(value as PageSize),
                  disabled: busy,
                  variant: "select",
                  options: [
                    {
                      value: "fit",
                      label: "Fit to image",
                      icon: FitToScreenIcon,
                    },
                    { value: "a4", label: "A4", icon: Note01Icon },
                    {
                      value: "letter",
                      label: "US Letter",
                      icon: LegalDocument01Icon,
                    },
                  ],
                },
                {
                  label: "Margin",
                  value: margin,
                  onValueChange: (value) => setMargin(value as Margin),
                  disabled: busy,
                  options: [
                    {
                      value: "none",
                      label: "No margin",
                      icon: BorderNone01Icon,
                    },
                    { value: "small", label: "Small", icon: BorderAll01Icon },
                    { value: "big", label: "Big", icon: BorderAll02Icon },
                  ],
                },
              ],
              actions: [
                {
                  label: "Convert",
                  icon: Pdf01Icon,
                  onClick: convert,
                  disabled: busy || orderedJobs.length < 1,
                },
              ],
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
              <span className="text-sm text-muted-foreground">Images</span>
              <Card className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
                {orderedJobs.map((job, index) => (
                  <Attachment key={job.id} className="w-full">
                    <AttachmentTrigger
                      aria-label={`Preview ${job.name}`}
                      onClick={() => setPreviewJob(job)}
                    />
                    <AttachmentMedia variant="image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={job.previewUrl} alt="" />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{job.name}</AttachmentTitle>
                      <AttachmentDescription>
                        {formatBytes(job.size)}
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
              title="PDF"
              layer={
                busy
                  ? {
                      kind: "status",
                      icon: Loading03Icon,
                      spin: true,
                      message: "Creating PDF…",
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
                  Add images, arrange their order, then hit Convert
                </p>
              )}
            </PreviewCard>
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one image has been picked. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop images to upload"
          description="or, click to browse · combine images into one PDF · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />

        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </div>

      <Dialog
        open={!!previewJob}
        onOpenChange={(open) => !open && setPreviewJob(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewJob?.name}</DialogTitle>
          </DialogHeader>
          {previewJob && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewJob.previewUrl}
              alt=""
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </ToolPage>
  )
}
