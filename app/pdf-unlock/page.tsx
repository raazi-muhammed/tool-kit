"use client"

import { PDFDocument } from "@cantoo/pdf-lib"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Cancel01Icon,
  CloudUploadIcon,
  Download04Icon,
  FileUnlockedIcon,
  Loading03Icon,
  Pdf02Icon,
} from "@hugeicons/core-free-icons"
import { useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { ToolPage } from "@/components/tool-page"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "application/pdf,.pdf"

type Status = "idle" | "unlocking" | "done" | "error"
type Result = { url: string; name: string; size: number }

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
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const busy = status === "unlocking"

  function reset() {
    if (result) URL.revokeObjectURL(result.url)
    setFile(null)
    setPassword("")
    setStatus("idle")
    setError(null)
    setResult(null)
  }

  function addFile(picked: File | null | undefined) {
    if (!picked) return
    if (!isPdfFile(picked)) {
      reset()
      setError("This file doesn't look like a PDF.")
      setStatus("error")
      return
    }
    if (result) URL.revokeObjectURL(result.url)
    setFile(picked)
    setPassword("")
    setStatus("idle")
    setError(null)
    setResult(null)
  }

  async function unlock() {
    if (!file) return
    if (!password) {
      setStatus("error")
      setError("Enter the PDF's password.")
      return
    }

    setStatus("unlocking")
    setError(null)

    try {
      const bytes = await file.arrayBuffer()
      const doc = await PDFDocument.load(bytes, { password })
      const unlockedBytes = await doc.save()
      const blob = new Blob([unlockedBytes as BlobPart], {
        type: "application/pdf",
      })

      if (result) URL.revokeObjectURL(result.url)
      const url = URL.createObjectURL(blob)
      setResult({ url, name: unlockedName(file.name), size: blob.size })
      setStatus("done")
    } catch (err) {
      setStatus("error")
      setError(
        err instanceof Error && err.message === "Password incorrect"
          ? "That password doesn't unlock this PDF."
          : err instanceof Error
            ? err.message
            : "Something went wrong while unlocking the PDF."
      )
    }
  }

  return (
    <ToolPage
      page="PDF Unlock"
      icon={FileUnlockedIcon}
      actions={
        file && (
          <Button variant="outline" onClick={() => dropzoneRef.current?.open()}>
            <HugeiconsIcon icon={CloudUploadIcon} aria-hidden />
            Add file
          </Button>
        )
      }
      onClear={reset}
    >
      <div className="flex flex-1 flex-col gap-4">
        {file && (
          <div className="grid items-stretch gap-4 md:grid-cols-2">
            <Attachment className="h-full w-full">
              <AttachmentMedia>
                <HugeiconsIcon icon={Pdf02Icon} aria-hidden />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{file.name}</AttachmentTitle>
                <AttachmentDescription>
                  {formatBytes(file.size)}
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  aria-label={`Remove ${file.name}`}
                  onClick={reset}
                >
                  <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>

            {busy ? (
              <Attachment state="processing" className="h-full w-full">
                <AttachmentMedia>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    aria-hidden
                    className="animate-spin"
                  />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>Unlocking…</AttachmentTitle>
                  <AttachmentDescription>
                    Working in your browser…
                  </AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            ) : status === "error" ? (
              <Attachment state="error" className="h-full w-full">
                <AttachmentMedia>
                  <HugeiconsIcon icon={AlertCircleIcon} aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>Couldn&apos;t unlock</AttachmentTitle>
                  <AttachmentDescription className="whitespace-normal">
                    {error}
                  </AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            ) : result ? (
              <Attachment state="done" className="h-full w-full">
                <AttachmentMedia>
                  <HugeiconsIcon icon={FileUnlockedIcon} aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{result.name}</AttachmentTitle>
                  <AttachmentDescription>
                    {formatBytes(result.size)}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <Button asChild>
                    <a href={result.url} download={result.name}>
                      <HugeiconsIcon icon={Download04Icon} aria-hidden />
                      Download
                    </a>
                  </Button>
                </AttachmentActions>
              </Attachment>
            ) : (
              <Attachment state="idle" className="h-full w-full">
                <AttachmentMedia>
                  <HugeiconsIcon icon={FileUnlockedIcon} aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>Ready to unlock</AttachmentTitle>
                  <AttachmentDescription>
                    Enter the password, then hit Unlock
                  </AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            )}
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once a PDF has been picked. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop a PDF to upload"
          description="or, click to browse · remove the password from a PDF · in-browser only"
          accept={ACCEPTED}
          hidden={!!file}
          onFiles={(files) => addFile(files?.[0])}
        />

        {file && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Password</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                autoComplete="off"
                className="w-56"
                onKeyDown={(e) => {
                  if (e.key === "Enter") unlock()
                }}
              />
            </div>
            <Button onClick={unlock} disabled={busy} className="ml-auto">
              <HugeiconsIcon icon={FileUnlockedIcon} aria-hidden />
              Unlock
            </Button>
          </div>
        )}

        {!file && error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </ToolPage>
  )
}
