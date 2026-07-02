"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  AudioWave01Icon,
  Cancel01Icon,
  CloudUploadIcon,
  Download04Icon,
  Loading03Icon,
  MusicNote01Icon,
  Video01Icon,
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
import { Card } from "@/components/ui/card"
import {
  decodeAudioData,
  encodeWav,
  formatBytes,
  getAudioContext,
  mixToMono,
  replaceExtension,
} from "@/lib/wav"
import { encodeMp3 } from "@/lib/mp3"

const ACCEPTED = "video/*,.mp4,.mov,.mkv,.avi,.webm"
const SUPPORTED_LABEL = "MP4, MOV, MKV, AVI, WebM"
const MP3_KBPS = 192

type Format = "wav" | "mp3"
type Status = "idle" | "reading" | "decoding" | "encoding" | "done"
type Source = { samples: Float32Array; sampleRate: number; baseName: string }
type Result = { url: string; name: string; size: number; meta: string }

const STATUS_LABEL: Record<Exclude<Status, "idle" | "done">, string> = {
  reading: "Reading file…",
  decoding: "Decoding audio…",
  encoding: "Encoding audio…",
}

export default function VideoToAudioPage() {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<Format>("mp3")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<Source | null>(null)

  const busy = status === "reading" || status === "decoding" || status === "encoding"

  function clearResult() {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  function publish(blob: Blob, name: string, meta: string) {
    const url = URL.createObjectURL(blob)
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { url, name, size: blob.size, meta }
    })
    setStatus("done")
  }

  // Encode the already-decoded audio into the chosen format. Deferred so the
  // "Encoding…" spinner paints before a (potentially heavy) MP3 encode runs.
  function encodeSource(source: Source, fmt: Format) {
    setStatus("encoding")
    setError(null)
    setTimeout(() => {
      try {
        if (fmt === "mp3") {
          const blob = encodeMp3(source.samples, source.sampleRate, MP3_KBPS)
          publish(blob, replaceExtension(source.baseName, "mp3"), `MP3 · ${MP3_KBPS} kbps · mono`)
        } else {
          const blob = encodeWav(source.samples, source.sampleRate)
          publish(blob, replaceExtension(source.baseName, "wav"), "WAV · 16-bit PCM · mono")
        }
      } catch {
        setStatus("idle")
        setError("Something went wrong while encoding the audio.")
      }
    }, 0)
  }

  async function convert(picked: File) {
    setFile(picked)
    setError(null)
    clearResult()
    sourceRef.current = null

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

      const source: Source = {
        samples: mixToMono(audioBuffer),
        sampleRate: audioBuffer.sampleRate,
        baseName: picked.name,
      }
      sourceRef.current = source
      encodeSource(source, format)
    } catch (err) {
      setStatus("idle")
      setError(err instanceof Error ? err.message : "Something went wrong while converting the file.")
    } finally {
      void ctx.close()
    }
  }

  function changeFormat(next: Format) {
    if (next === format) return
    setFormat(next)
    if (sourceRef.current && !busy) encodeSource(sourceRef.current, next)
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
    sourceRef.current = null
    clearResult()
    setError(null)
    setStatus("idle")
  }

  // "Load sample" synthesizes a short tone and runs it through the same encoder,
  // so the encode + download flow is testable without a video file.
  function loadSample() {
    const AudioCtx = getAudioContext()
    if (!AudioCtx) {
      setError(
        "Your browser doesn't support the Web Audio API (AudioContext), so audio can't be generated here.",
      )
      return
    }
    setFile(null)
    const ctx = new AudioCtx()
    const sampleRate = ctx.sampleRate
    const tone = new Float32Array(sampleRate * 2)
    for (let i = 0; i < tone.length; i++) {
      // 440 Hz sine with a gentle fade in/out to avoid clicks.
      const fade = Math.min(1, i / 2000, (tone.length - i) / 2000)
      tone[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.6 * fade
    }
    void ctx.close()
    const source: Source = { samples: tone, sampleRate, baseName: "sample-tone" }
    sourceRef.current = source
    encodeSource(source, format)
  }

  const resultIsMp3 = result?.name.endsWith(".mp3")

  return (
    <ToolPage
      page="Video → Audio"
      icon={AudioWave01Icon}
      onCopy={copy}
      onLoadSample={loadSample}
      onClear={clear}
      actions={
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <Button
            size="sm"
            variant={format === "mp3" ? "default" : "ghost"}
            onClick={() => changeFormat("mp3")}
            disabled={busy}
          >
            <HugeiconsIcon icon={MusicNote01Icon} aria-hidden />
            MP3
          </Button>
          <Button
            size="sm"
            variant={format === "wav" ? "default" : "ghost"}
            onClick={() => changeFormat("wav")}
            disabled={busy}
          >
            <HugeiconsIcon icon={AudioWave01Icon} aria-hidden />
            WAV
          </Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onPick}
          className="hidden"
        />

        {/* Drop area — shadcn ships no dropzone component, so this is custom and
            pairs with the Attachment components below (the shadcn pattern). */}
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
          className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition-colors ${
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

        {/* Selected source file */}
        {file && (
          <Attachment className="w-full">
            <AttachmentMedia>
              <HugeiconsIcon icon={Video01Icon} aria-hidden />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{file.name}</AttachmentTitle>
              <AttachmentDescription>{formatBytes(file.size)}</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction
                aria-label={`Remove ${file.name}`}
                onClick={clear}
                disabled={busy}
              >
                <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        )}

        {/* Processing */}
        {busy && (
          <Attachment state="processing" className="w-full">
            <AttachmentMedia>
              <HugeiconsIcon icon={Loading03Icon} aria-hidden className="animate-spin" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{STATUS_LABEL[status as keyof typeof STATUS_LABEL]}</AttachmentTitle>
              <AttachmentDescription>Working in your browser…</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        )}

        {/* Error */}
        {error && (
          <Attachment state="error" className="w-full">
            <AttachmentMedia>
              <HugeiconsIcon icon={AlertCircleIcon} aria-hidden />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>Couldn&apos;t convert</AttachmentTitle>
              <AttachmentDescription className="whitespace-normal">
                {error}
              </AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction aria-label="Dismiss error" onClick={() => setError(null)}>
                <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        )}

        {/* Result */}
        {result && !busy && (
          <Attachment state="done" className="w-full">
            <AttachmentMedia>
              <HugeiconsIcon
                icon={resultIsMp3 ? MusicNote01Icon : AudioWave01Icon}
                aria-hidden
              />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{result.name}</AttachmentTitle>
              <AttachmentDescription>
                {result.meta} · {formatBytes(result.size)}
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
        )}
      </div>
    </ToolPage>
  )
}
