"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Cancel01Icon,
  CloudUploadIcon,
  Download04Icon,
  Image01Icon,
  LinkIcon,
  Loading03Icon,
  Resize02Icon,
} from "@hugeicons/core-free-icons"
import { useRef, useState } from "react"

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

const ACCEPTED = "image/*"

type Status = "idle" | "resizing" | "done" | "error"
type Result = {
  url: string
  name: string
  size: number
  width: number
  height: number
}
type Dimensions = { width: number; height: number }

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error("This file couldn't be decoded as an image."))
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Encoding produced no data.")),
      mime
    )
  })
}

export default function ImageResizePage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [original, setOriginal] = useState<Dimensions | null>(null)
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [lockAspect, setLockAspect] = useState(true)
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const busy = status === "resizing"

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (result) URL.revokeObjectURL(result.url)
    setFile(null)
    setPreviewUrl(null)
    setOriginal(null)
    setWidth("")
    setHeight("")
    setStatus("idle")
    setError(null)
    setResult(null)
  }

  async function addFile(picked: File | null | undefined) {
    if (!picked) return
    if (!isImageFile(picked)) {
      reset()
      setError("This file doesn't look like an image.")
      setStatus("error")
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (result) URL.revokeObjectURL(result.url)
    const url = URL.createObjectURL(picked)
    try {
      const img = await loadImage(url)
      setFile(picked)
      setPreviewUrl(url)
      setOriginal({ width: img.naturalWidth, height: img.naturalHeight })
      setWidth(String(img.naturalWidth))
      setHeight(String(img.naturalHeight))
      setStatus("idle")
      setError(null)
      setResult(null)
    } catch (err) {
      reset()
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading the image."
      )
      setStatus("error")
    }
  }

  function onWidthChange(value: string) {
    setWidth(value)
    const parsed = Number(value)
    if (lockAspect && original && parsed > 0) {
      setHeight(
        String(
          Math.max(1, Math.round(parsed * (original.height / original.width)))
        )
      )
    }
  }

  function onHeightChange(value: string) {
    setHeight(value)
    const parsed = Number(value)
    if (lockAspect && original && parsed > 0) {
      setWidth(
        String(
          Math.max(1, Math.round(parsed * (original.width / original.height)))
        )
      )
    }
  }

  function toggleLockAspect() {
    // Re-derive height from the current width so re-locking snaps back to
    // the original ratio instead of carrying over a distorted size.
    if (!lockAspect && original) {
      const parsedWidth = Number(width)
      if (parsedWidth > 0) {
        setHeight(
          String(
            Math.max(
              1,
              Math.round(parsedWidth * (original.height / original.width))
            )
          )
        )
      }
    }
    setLockAspect(!lockAspect)
  }

  async function resize() {
    if (!file || !previewUrl) return
    const targetWidth = Math.round(Number(width))
    const targetHeight = Math.round(Number(height))
    if (!targetWidth || !targetHeight || targetWidth < 1 || targetHeight < 1) {
      setStatus("error")
      setError("Enter a width and height of at least 1 pixel.")
      return
    }

    setStatus("resizing")
    setError(null)

    try {
      const img = await loadImage(previewUrl)
      const canvas = document.createElement("canvas")
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas isn't supported in this browser.")
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

      const mime =
        file.type && file.type.startsWith("image/") ? file.type : "image/png"
      const blob = await canvasToBlob(canvas, mime)

      if (result) URL.revokeObjectURL(result.url)
      const url = URL.createObjectURL(blob)
      setResult({
        url,
        name: file.name,
        size: blob.size,
        width: targetWidth,
        height: targetHeight,
      })
      setStatus("done")
    } catch (err) {
      setStatus("error")
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while resizing the image."
      )
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    addFile(e.target.files?.[0])
    e.target.value = ""
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFile(e.dataTransfer.files?.[0])
  }

  return (
    <ToolPage page="Image Resize" icon={Resize02Icon} onClear={reset}>
      <div className="flex flex-1 flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onPick}
          className="hidden"
        />

        {/* Source (left) and its output (right), side by side — only once a
            file has been picked. */}
        {file && (
          <div className="grid items-stretch gap-4 md:grid-cols-2">
            <Attachment className="h-full w-full">
              <AttachmentMedia variant="image">
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={file.name} />
                )}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{file.name}</AttachmentTitle>
                <AttachmentDescription>
                  {original ? `${original.width} × ${original.height} · ` : ""}
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
                  <AttachmentTitle>Resizing…</AttachmentTitle>
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
                  <AttachmentTitle>Couldn&apos;t resize</AttachmentTitle>
                  <AttachmentDescription className="whitespace-normal">
                    {error}
                  </AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            ) : result ? (
              <Attachment state="done" className="h-full w-full">
                <AttachmentMedia>
                  <HugeiconsIcon icon={Image01Icon} aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{result.name}</AttachmentTitle>
                  <AttachmentDescription>
                    {result.width} × {result.height} ·{" "}
                    {formatBytes(result.size)}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <Button asChild size="sm">
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
                  <HugeiconsIcon icon={Image01Icon} aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>Ready to resize</AttachmentTitle>
                  <AttachmentDescription>
                    Set a width and height, then hit Resize
                  </AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            )}
          </div>
        )}

        {/* Drop area (always available to replace the image). */}
        <Attachment
          state="idle"
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`w-full cursor-pointer transition-colors ${
            dragging ? "border-primary bg-accent/50" : "hover:bg-muted/50"
          }`}
        >
          <AttachmentMedia>
            <HugeiconsIcon icon={CloudUploadIcon} aria-hidden />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>
              Drag &amp; drop an image, or click to browse
            </AttachmentTitle>
            <AttachmentDescription>
              Resize to any resolution · in-browser only
            </AttachmentDescription>
          </AttachmentContent>
        </Attachment>

        {/* Width/height, aspect-ratio lock, and the explicit Resize trigger. */}
        {file && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Width</span>
              <Input
                type="number"
                min={1}
                value={width}
                onChange={(e) => onWidthChange(e.target.value)}
                disabled={busy}
                className="w-28"
              />
            </div>
            <Button
              size="icon"
              variant={lockAspect ? "secondary" : "ghost"}
              aria-pressed={lockAspect}
              aria-label={
                lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio"
              }
              title={lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio"}
              onClick={toggleLockAspect}
              disabled={busy}
            >
              <HugeiconsIcon icon={LinkIcon} aria-hidden />
            </Button>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Height</span>
              <Input
                type="number"
                min={1}
                value={height}
                onChange={(e) => onHeightChange(e.target.value)}
                disabled={busy}
                className="w-28"
              />
            </div>
            <Button onClick={resize} disabled={busy} className="ml-auto">
              <HugeiconsIcon icon={Resize02Icon} aria-hidden />
              Resize
            </Button>
          </div>
        )}

        {!file && error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </ToolPage>
  )
}
