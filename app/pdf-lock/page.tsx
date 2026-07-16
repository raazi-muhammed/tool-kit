"use client"

import { EncryptedPDFError, PDFDocument } from "@cantoo/pdf-lib"
import {
  AlertCircleIcon,
  CloudUploadIcon,
  FileLockedIcon,
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

type Status = "idle" | "locking" | "done" | "error"
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
  alreadyLocked: boolean | null
  /** Blob URL for the original file, set once it's confirmed to have no password. */
  originalUrl: string | null
}

function lockedName(name: string): string {
  return name.toLowerCase().endsWith(".pdf")
    ? `${name.slice(0, -4)}-locked.pdf`
    : `${name}-locked.pdf`
}

export default function PdfLockPage() {
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
        alreadyLocked: null,
        originalUrl: null,
      }
    },
    cleanupJob: (job) => {
      if (job.result) URL.revokeObjectURL(job.result.url)
      if (job.originalUrl) URL.revokeObjectURL(job.originalUrl)
    },
  })
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const { enabled: autoRunEnabled } = useAutoRunEnabled()
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const anyBusy = jobs.some((job) => job.status === "locking")

  async function checkAlreadyLocked(job: Job) {
    try {
      const bytes = await job.file.arrayBuffer()
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const alreadyLocked = doc.isEncrypted
      updateJob(job.id, (j) => ({
        alreadyLocked,
        originalUrl: alreadyLocked ? null : URL.createObjectURL(j.file),
      }))
    } catch {
      updateJob(job.id, { alreadyLocked: true })
    }
  }

  async function handleFiles(fileList: FileList | null | undefined) {
    const { jobs: created } = await addFiles(fileList)
    created.forEach((job) => {
      if (job.validFile) void checkAlreadyLocked(job)
    })
  }

  async function lockJob(job: Job, pwd: string) {
    updateJob(job.id, { status: "locking", error: null })

    try {
      const bytes = await job.file.arrayBuffer()
      const doc = await PDFDocument.load(bytes)
      doc.encrypt({ userPassword: pwd, ownerPassword: pwd })
      const lockedBytes = await doc.save()
      const blob = new Blob([lockedBytes as BlobPart], {
        type: "application/pdf",
      })

      updateJob(job.id, (j) => ({
        status: "done",
        error: null,
        result: setBlobResult(j.result, blob, lockedName(j.name)),
      }))
    } catch (err) {
      updateJob(job.id, {
        status: "error",
        error:
          err instanceof EncryptedPDFError
            ? "This PDF already has a password. Unlock it first."
            : err instanceof Error
              ? err.message
              : "Something went wrong while locking the PDF.",
      })
    }
  }

  function validatedPassword(): string | null {
    if (!password) {
      setFormError("Enter a password to lock the PDF with.")
      return null
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match.")
      return null
    }
    setFormError(null)
    return password
  }

  function lock() {
    const pwd = validatedPassword()
    if (!pwd) return
    if (
      !activeJob ||
      !activeJob.validFile ||
      activeJob.alreadyLocked === true ||
      activeJob.status === "locking"
    )
      return
    void lockJob(activeJob, pwd)
  }

  function lockAll() {
    const pwd = validatedPassword()
    if (!pwd) return
    jobs.forEach((job) => {
      if (
        job.validFile &&
        job.alreadyLocked !== true &&
        job.status !== "locking"
      )
        void lockJob(job, pwd)
    })
  }

  // With "Run automatically" on, attempt to lock the active job once both
  // password fields stop changing, instead of requiring an explicit Lock
  // click — debounced so it only fires once typing pauses, not on every
  // keystroke (which would otherwise flash a "don't match" error mid-type).
  useDebouncedEffect(
    () => {
      if (
        !autoRunEnabled ||
        !password ||
        password !== confirmPassword ||
        !activeJob?.validFile ||
        activeJob.alreadyLocked !== false ||
        activeJob.status === "locking"
      )
        return
      setFormError(null)
      void lockJob(activeJob, password)
    },
    [
      autoRunEnabled,
      password,
      confirmPassword,
      activeId,
      activeJob?.alreadyLocked,
    ],
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
      page="PDF Lock"
      icon={FileLockedIcon}
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
                  disabled: anyBusy || activeJob?.alreadyLocked === true,
                },
                {
                  label: "Confirm password",
                  type: "password",
                  value: confirmPassword,
                  onChange: setConfirmPassword,
                  disabled: anyBusy || activeJob?.alreadyLocked === true,
                  onEnter: lock,
                },
              ],
              actions: [
                !autoRunEnabled && {
                  label: "Lock",
                  icon: FileLockedIcon,
                  onClick: lock,
                  disabled:
                    anyBusy ||
                    !activeJob?.validFile ||
                    activeJob?.alreadyLocked === true,
                  more:
                    jobs.length > 1
                      ? {
                          label: "Lock all",
                          icon: FileLockedIcon,
                          onClick: lockAll,
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
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
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
                  : activeJob.alreadyLocked === true
                    ? {
                        kind: "status",
                        icon: FileLockedIcon,
                        message: "This PDF already has a password.",
                      }
                    : activeJob.alreadyLocked === false && activeJob.originalUrl
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
                activeJob.alreadyLocked === false &&
                activeJob.originalUrl && (
                  <PdfPreview
                    key={activeJob.originalUrl}
                    url={activeJob.originalUrl}
                  />
                )}
            </PreviewCard>

            <PreviewCard
              fill
              title="Locked"
              layer={
                formError
                  ? {
                      kind: "status",
                      icon: AlertCircleIcon,
                      tone: "destructive",
                      message: formError,
                    }
                  : activeJob.status === "locking"
                    ? {
                        kind: "status",
                        icon: Loading03Icon,
                        spin: true,
                        message: "Locking…",
                      }
                    : activeJob.status === "error"
                      ? {
                          kind: "status",
                          icon: AlertCircleIcon,
                          tone: "destructive",
                          message: activeJob.error,
                        }
                      : activeJob.result
                        ? {
                            kind: "status",
                            icon: FileLockedIcon,
                            message: (
                              <>
                                {activeJob.result.name}
                                <br />
                                {formatBytes(activeJob.result.size)}
                              </>
                            ),
                          }
                        : activeJob.alreadyLocked === true
                          ? {
                              kind: "status",
                              message:
                                "Unlock this PDF first, then lock it with a new password.",
                            }
                          : {
                              kind: "status",
                              message: autoRunEnabled
                                ? "Enter and confirm a password — it locks automatically"
                                : "Enter and confirm a password, then hit Lock",
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
          title="Drag and drop PDFs to upload"
          description="or, click to browse · add a password to a PDF · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={handleFiles}
        />
      </div>
    </ToolPage>
  )
}
