"use client"

import { PDFDocument } from "@cantoo/pdf-lib"
import {
  CloudUploadIcon,
  Download04Icon,
  FileUnlockedIcon,
  Pdf02Icon,
} from "@hugeicons/core-free-icons"
import { useRef, useState } from "react"

import { BatchJobRow } from "@/components/batch-job-row"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { ToolPage } from "@/components/tool-page"
import { useFiles } from "@/hooks/use-files"
import { downloadFile, downloadStagger } from "@/lib/download"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "application/pdf,.pdf"

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
  const { jobs, addFiles, updateJob, removeJob, clear: clearQueue } = useFiles<Job>({
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
    setFormError(null)
    jobs.forEach((job) => {
      if (job.validFile && job.status !== "unlocking") void unlockJob(job, password)
    })
  }

  function clear() {
    clearQueue()
    setPassword("")
    setFormError(null)
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
      page="PDF Unlock"
      icon={FileUnlockedIcon}
      onAddFile={jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined}
      onClear={clear}
      footer={
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
                jobs.some((job) => job.result) && {
                  label: "Download all",
                  icon: Download04Icon,
                  onClick: downloadAll,
                  variant: "outline",
                  emphasis: "secondary",
                },
                { label: "Unlock", icon: FileUnlockedIcon, onClick: unlock, disabled: anyBusy },
              ],
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {jobs.map((job) => (
          <BatchJobRow
            key={job.id}
            name={job.name}
            onRemove={() => removeJob(job.id)}
            sourceIcon={Pdf02Icon}
            sourceDescription={formatBytes(job.size)}
            status={
              job.status === "unlocking"
                ? { state: "processing", title: "Unlocking…" }
                : job.status === "error"
                  ? { state: "error", title: "Couldn't unlock", description: job.error }
                  : job.result
                    ? {
                        state: "done",
                        icon: FileUnlockedIcon,
                        title: job.result.name,
                        description: formatBytes(job.result.size),
                        download: { url: job.result.url, name: job.result.name },
                      }
                    : {
                        state: "idle",
                        icon: FileUnlockedIcon,
                        title: "Ready to unlock",
                        description: "Enter the password, then hit Unlock",
                      }
            }
          />
        ))}

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
