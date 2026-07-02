"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  AudioWave01Icon,
  Cancel01Icon,
  CloudUploadIcon,
  Download04Icon,
  Loading03Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons"
import { useRef, useState } from "react"

import { ToolPage } from "@/components/tool-page"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  decodeAudioData,
  encodeWav,
  formatBytes,
  getAudioContext,
  mixToMono,
  toWavFilename,
} from "@/lib/wav"

const ACCEPTED = "video/*,.mp4,.mov,.mkv,.avi,.webm"
const SUPPORTED_LABEL = "MP4, MOV, MKV, AVI, WebM"

type Status = "idle" | "reading" | "decoding" | "encoding" | "done"

type Result = { url: string; name: string; size: number }

const STATUS_LABEL: Record<Exclude<Status, "idle" | "done">, string> = {
  reading: "Reading file…",
  decoding: "Decoding audio…",
  encoding: "Encoding WAV…",
}

export default function VideoToAudioPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = status === "reading" || status === "decoding" || status === "encoding"

  function reset() {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
    setError(null)
    setStatus("idle")
  }

  function publish(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { url, name, size: blob.size }
    })
    setStatus("done")
  }

  async function convert(picked: File) {
    setFile(picked)
    setError(null)
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })

    const AudioCtx = getAudioContext()
    if (!AudioCtx) {
      setStatus("idle")
      setError(
        "Your browser doesn't support the Web Audio API (AudioContext), so audio can't be extracted here.",
      )
      return
    }

    const ctx = new AudioCtx()
    try {
      setStatus("reading")
      const arrayBuffer = await picked.arrayBuffer()

      setStatus("decoding")
      let audioBuffer: AudioBuffer
      try {
        audioBuffer = await decodeAudioData(ctx, arrayBuffer)
      } catch {
        throw new Error(
          "This file has no audio track, or its format isn't supported by your browser.",
        )
      }

      if (audioBuffer.length === 0 || audioBuffer.numberOfChannels === 0) {
        throw new Error("This file has no audio track.")
      }

      setStatus("encoding")
      const mono = mixToMono(audioBuffer)
      const blob = encodeWav(mono, audioBuffer.sampleRate)
      publish(blob, toWavFilename(picked.name))
    } catch (err) {
      setStatus("idle")
      setError(err instanceof Error ? err.message : "Something went wrong while converting the file.")
    } finally {
      void ctx.close()
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (picked) void convert(picked)
    e.target.value = "" // allow re-picking the same file
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (busy) return
    const picked = e.dataTransfer.files?.[0]
    if (picked) void convert(picked)
  }

  // --- ToolPage actions ---
  async function copy() {
    if (result) await navigator.clipboard.writeText(result.name)
  }

  function clear() {
    setFile(null)
    reset()
  }

  // "Load sample" synthesizes a short tone and runs it through the same WAV
  // encoder, so the encode + download flow is testable without a video file.
  function loadSample() {
    const AudioCtx = getAudioContext()
    if (!AudioCtx) {
      setError(
        "Your browser doesn't support the Web Audio API (AudioContext), so audio can't be generated here.",
      )
      return
    }
    setFile(null)
    setError(null)
    const ctx = new AudioCtx()
    const sampleRate = ctx.sampleRate
    const seconds = 2
    const tone = new Float32Array(sampleRate * seconds)
    for (let i = 0; i < tone.length; i++) {
      // 440 Hz sine with a gentle fade in/out to avoid clicks.
      const fade = Math.min(1, i / 2000, (tone.length - i) / 2000)
      tone[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.6 * fade
    }
    void ctx.close()
    setStatus("encoding")
    publish(encodeWav(tone, sampleRate), "sample-tone.wav")
  }

  return (
    <ToolPage
      page="Video → Audio"
      icon={AudioWave01Icon}
      onCopy={copy}
      onLoadSample={loadSample}
      onClear={clear}
    >
      <div className="flex flex-1 flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onPick}
          className="hidden"
        />

        <Card
          role="button"
          tabIndex={0}
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !busy) {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-primary bg-accent/50" : "hover:bg-accent/50"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <HugeiconsIcon
            icon={CloudUploadIcon}
            aria-hidden
            className="size-10 text-muted-foreground"
          />
          <div>
            <p className="text-sm font-medium">
              Drag &amp; drop a video here, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {SUPPORTED_LABEL} · everything runs in your browser, nothing is uploaded
            </p>
          </div>
        </Card>

        {file && (
          <div className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
            <HugeiconsIcon icon={Video01Icon} aria-hidden className="size-4 shrink-0" />
            <span className="truncate font-medium">{file.name}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
            <HugeiconsIcon
              icon={Loading03Icon}
              aria-hidden
              className="size-4 shrink-0 animate-spin"
            />
            {STATUS_LABEL[status as keyof typeof STATUS_LABEL]}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              aria-hidden
              className="mt-0.5 size-4 shrink-0"
            />
            <div className="flex-1">{error}</div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 opacity-70 hover:opacity-100"
              aria-label="Dismiss error"
            >
              <HugeiconsIcon icon={Cancel01Icon} aria-hidden className="size-4" />
            </button>
          </div>
        )}

        {result && (
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <HugeiconsIcon
              icon={AudioWave01Icon}
              aria-hidden
              className="size-5 text-primary"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{result.name}</p>
              <p className="text-xs text-muted-foreground">
                WAV · 16-bit PCM · mono · {formatBytes(result.size)}
              </p>
            </div>
            <Button asChild size="sm">
              <a href={result.url} download={result.name}>
                <HugeiconsIcon icon={Download04Icon} aria-hidden />
                Download
              </a>
            </Button>
          </Card>
        )}
      </div>
    </ToolPage>
  )
}
