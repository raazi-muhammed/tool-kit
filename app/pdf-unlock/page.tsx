"use client"

import { PDFDocument } from "@cantoo/pdf-lib"
import {
  AlertCircleIcon,
  CloudUploadIcon,
  FileUnlockedIcon,
  Loading03Icon,
  Pdf02Icon,
} from "@hugeicons/core-free-icons"
import { useRef, useState } from "react"

import { useAutoRunEnabled } from "@/components/auto-run-preference"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PdfPreview } from "@/components/pdf-preview"
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
import { isPdfFile } from "@/lib/pdf"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "application/pdf,.pdf"

type Status = "idle" | "unlocking" | "done" | "error"
type Job = {
  id: number
  file: File
  name: string
  size: number
  validFile: boolean
  status: Status
  error: string | null
  result: FileResult | null
  /** `null` until the async encryption check (below) resolves. */
  locked: boolean | null
  /** Blob URL for the original file, set once it's confirmed to have no password. */
  originalUrl: string | null
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
        locked: null,
        originalUrl: null,
      }
    },
    cleanupJob: (job) => {
      if (job.result) URL.revokeObjectURL(job.result.url)
      if (job.originalUrl) URL.revokeObjectURL(job.originalUrl)
    },
  })
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const { enabled: autoRunEnabled } = useAutoRunEnabled()
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const anyBusy = jobs.some((job) => job.status === "unlocking")

  async function checkLocked(job: Job) {
    try {
      const bytes = await job.file.arrayBuffer()
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const locked = doc.isEncrypted
      updateJob(job.id, (j) => ({
        locked,
        originalUrl: locked ? null : URL.createObjectURL(j.file),
      }))
    } catch {
      updateJob(job.id, { locked: true })
    }
  }

  async function handleFiles(fileList: FileList | null | undefined) {
    const { jobs: created } = await addFiles(fileList)
    created.forEach((job) => {
      if (job.validFile) void checkLocked(job)
    })
  }

  async function unlockJob(job: Job, pwd: string) {
    updateJob(job.id, { status: "unlocking", error: null })

    try {
      const bytes = await job.file.arrayBuffer()
      const doc = await PDFDocument.load(bytes, { password: pwd })
      const unlockedBytes = await doc.save()
      const blob = new Blob([unlockedBytes as BlobPart], {
        type: "application/pdf",
      })

      updateJob(job.id, (j) => ({
        status: "done",
        error: null,
        result: setBlobResult(j.result, blob, unlockedName(j.name)),
      }))
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

  // With "Run automatically" on, attempt to unlock the active job once the
  // password stops changing, instead of requiring an explicit Unlock click —
  // debounced so it only fires once typing pauses, not on every keystroke
  // (which would otherwise flash a wrong-password error mid-type).
  useDebouncedEffect(
    () => {
      if (
        !autoRunEnabled ||
        !password ||
        !activeJob?.validFile ||
        activeJob.locked === false ||
        activeJob.status === "unlocking"
      )
        return
      void unlockJob(activeJob, password)
    },
    [autoRunEnabled, password, activeId, activeJob?.locked],
    600
  )

  async function downloadJob(job: Job) {
    if (job.result) downloadFile(job.result.url, job.result.name)
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  function downloadAll() {
    return downloadAllJobs(jobs, (job) => !!job.result, downloadJob)
  }

  return (
    <ToolPage
      page="PDF Unlock"
      icon={FileUnlockedIcon}
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
      sidebar={
        jobs.length > 0
          ? {
              inputs: [
                {
                  label: "Password",
                  type: "password",
                  value: password,
                  onChange: setPassword,
                  disabled: anyBusy || activeJob?.locked === false,
                  onEnter: unlock,
                },
              ],
              actions: [
                !autoRunEnabled && {
                  label: "Unlock",
                  icon: FileUnlockedIcon,
                  onClick: unlock,
                  disabled:
                    anyBusy ||
                    !activeJob?.validFile ||
                    activeJob?.locked === false,
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
                !activeJob.validFile
                  ? {
                      kind: "status",
                      icon: AlertCircleIcon,
                      tone: "destructive",
                      message: activeJob.error,
                    }
                  : activeJob.locked === false && activeJob.originalUrl
                    ? false
                    : {
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
              }
            >
              {activeJob.validFile &&
                activeJob.locked === false &&
                activeJob.originalUrl && (
                  <PdfPreview
                    key={activeJob.originalUrl}
                    url={activeJob.originalUrl}
                  />
                )}
            </PreviewCard>

            <PreviewCard
              fill
              title="Unlocked"
              layer={
                formError
                  ? {
                      kind: "status",
                      icon: AlertCircleIcon,
                      tone: "destructive",
                      message: formError,
                    }
                  : activeJob.status === "unlocking"
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
                      : activeJob.locked === false && !activeJob.result
                        ? {
                            kind: "status",
                            icon: FileUnlockedIcon,
                            message: "This PDF doesn't have a password.",
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
                  {autoRunEnabled
                    ? "Enter the password — it unlocks automatically"
                    : "Enter the password, then hit Unlock"}
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
          onFiles={handleFiles}
        />
      </div>
    </ToolPage>
  )
}
