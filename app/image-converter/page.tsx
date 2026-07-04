"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Cancel01Icon,
  CloudUploadIcon,
  Download04Icon,
  Image01Icon,
  Loading03Icon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { encodeBmp, supportsWebp } from "@/lib/bmp"
import { formatBytes, replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*,.svg,.ico,.avif,.tiff,.tif,.bmp"
const SUPPORTED_LABEL = "JPG, PNG, WebP, GIF, BMP, SVG, ICO, AVIF, TIFF"

type Format = "png" | "jpeg" | "webp" | "bmp"
type Status = "idle" | "converting" | "done" | "error"
type Result = { url: string; name: string; size: number }

const FORMAT_MIME: Record<Format, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  bmp: "image/bmp",
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  return /\.(jpe?g|png|webp|gif|bmp|svg|ico|avif|tiff?)$/i.test(file.name)
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding produced no data."))),
      mime,
      quality,
    )
  })
}

export default function ImageConverterPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [format, setFormat] = useState<Format>("png")
  const [quality, setQuality] = useState(92)
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const busy = status === "converting"

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (result) URL.revokeObjectURL(result.url)
    setFile(null)
    setPreviewUrl(null)
    setDimensions(null)
    setStatus("idle")
    setError(null)
    setResult(null)
  }

  function addFile(picked: File | null | undefined) {
    if (!picked) return
    if (!isImageFile(picked)) {
      reset()
      setError("This file doesn't look like a recognised image format.")
      setStatus("error")
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (result) URL.revokeObjectURL(result.url)
    const url = URL.createObjectURL(picked)
    setFile(picked)
    setPreviewUrl(url)
    setDimensions(null)
    setStatus("idle")
    setError(null)
    setResult(null)
  }

  async function convert() {
    if (!file || !previewUrl) return

    if (format === "webp" && !supportsWebp()) {
      setStatus("error")
      setError("Your browser does not support WebP output. Try Chrome or use PNG instead.")
      return
    }

    setStatus("converting")
    setError(null)

    try {
      const img = new Image()
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("This file couldn't be decoded as an image."))
      })
      img.src = previewUrl
      await loaded

      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas isn't supported in this browser.")
      ctx.drawImage(img, 0, 0)
      setDimensions({ width: canvas.width, height: canvas.height })

      const blob =
        format === "bmp"
          ? encodeBmp(ctx.getImageData(0, 0, canvas.width, canvas.height))
          : await canvasToBlob(canvas, FORMAT_MIME[format], quality / 100)

      if (result) URL.revokeObjectURL(result.url)
      const url = URL.createObjectURL(blob)
      const name = replaceExtension(file.name, format === "jpeg" ? "jpg" : format)
      setResult({ url, name, size: blob.size })
      setStatus("done")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Something went wrong while converting the image.")
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
    <ToolPage page="Image Converter" icon={Image01Icon} onClear={reset}>
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
                  {dimensions ? `${dimensions.width} × ${dimensions.height} · ` : ""}
                  {formatBytes(file.size)}
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction aria-label={`Remove ${file.name}`} onClick={reset}>
                  <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>

            {busy ? (
              <Attachment state="processing" className="h-full w-full">
                <AttachmentMedia>
                  <HugeiconsIcon icon={Loading03Icon} aria-hidden className="animate-spin" />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>Converting…</AttachmentTitle>
                  <AttachmentDescription>Working in your browser…</AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            ) : status === "error" ? (
              <Attachment state="error" className="h-full w-full">
                <AttachmentMedia>
                  <HugeiconsIcon icon={AlertCircleIcon} aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>Couldn&apos;t convert</AttachmentTitle>
                  <AttachmentDescription className="whitespace-normal">{error}</AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            ) : result ? (
              <Attachment state="done" className="h-full w-full">
                <AttachmentMedia>
                  <HugeiconsIcon icon={Image01Icon} aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{result.name}</AttachmentTitle>
                  <AttachmentDescription>{formatBytes(result.size)}</AttachmentDescription>
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
                  <HugeiconsIcon icon={Image01Icon} aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>Ready to convert</AttachmentTitle>
                  <AttachmentDescription>Pick a format and hit Convert</AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            )}
          </div>
        )}

        {/* Drop area (always available to replace the image) with the
            output-format picker right next to it. */}
        <div className="grid items-stretch gap-4 md:grid-cols-2">
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
            className={`h-full w-full cursor-pointer transition-colors ${
              dragging ? "border-primary bg-accent/50" : "hover:bg-muted/50"
            }`}
          >
            <AttachmentMedia>
              <HugeiconsIcon icon={CloudUploadIcon} aria-hidden />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>Drag &amp; drop an image, or click to browse</AttachmentTitle>
              <AttachmentDescription>{SUPPORTED_LABEL} · in-browser only</AttachmentDescription>
            </AttachmentContent>
          </Attachment>

          <Select value={format} onValueChange={(value) => setFormat(value as Format)} disabled={busy}>
            <SelectTrigger className="h-full! w-full" aria-label="Output format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="jpeg">JPEG</SelectItem>
              <SelectItem value="webp">WebP</SelectItem>
              <SelectItem value="bmp">BMP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quality (JPEG/WebP only) and the explicit Convert trigger. */}
        {file && (
          <div className="flex items-center gap-4">
            {(format === "jpeg" || format === "webp") && (
              <div className="flex flex-1 items-center gap-3">
                <span className="text-sm text-muted-foreground">Quality</span>
                <Slider
                  value={[quality]}
                  onValueChange={([value]) => setQuality(value)}
                  min={0}
                  max={100}
                  step={1}
                  disabled={busy}
                  className="max-w-48"
                />
                <span className="w-8 text-right text-sm text-muted-foreground">{quality}</span>
              </div>
            )}
            <Button onClick={convert} disabled={busy} className="ml-auto">
              Convert
            </Button>
          </div>
        )}
      </div>
    </ToolPage>
  )
}
