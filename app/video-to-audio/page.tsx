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
type JobStatus = "reading" | "decoding" | "encoding" | "done" | "error"
type Source = { samples: Float32Array; sampleRate: number; baseName: string }
type Result = { url: string; name: string; size: number; meta: string }
type Job = {
  id: number
  name: string
  size: number
  status: JobStatus
  error: string | null
  source: Source | null
  result: Result | null
}

const STATUS_LABEL: Record<"reading" | "decoding" | "encoding", string> = {
  reading: "Reading file…",
  decoding: "Decoding audio…",
  encoding: "Encoding audio…",
}

const isBusy = (status: JobStatus) =>
  status === "reading" || status === "decoding" || status === "encoding"

export default function VideoToAudioPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [format, setFormat] = useState<Format>("mp3")
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const idRef = useRef(0)

  const anyBusy = jobs.some((job) => isBusy(job.status))

  function updateJob(id: number, patch: Partial<Job>) {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)))
  }

  // Encode a job's already-decoded audio into the chosen format. Deferred so the
  // "Encoding…" spinner paints before a (potentially heavy) MP3 encode runs.
  function encodeJob(id: number, source: Source, fmt: Format) {
    updateJob(id, { status: "encoding", error: null })
    setTimeout(() => {
      let blob: Blob
      try {
        blob =
          fmt === "mp3"
            ? encodeMp3(source.samples, source.sampleRate, MP3_KBPS)
            : encodeWav(source.samples, source.sampleRate)
      } catch {
        updateJob(id, { status: "error", error: "Something went wrong while encoding the audio." })
        return
      }
      const name = replaceExtension(source.baseName, fmt)
      const meta =
        fmt === "mp3" ? `MP3 · ${MP3_KBPS} kbps · mono` : "WAV · 16-bit PCM · mono"
      setJobs((prev) => {
        if (!prev.some((job) => job.id === id)) return prev // job was removed mid-encode
        const url = URL.createObjectURL(blob)
        return prev.map((job) => {
          if (job.id !== id) return job
          if (job.result) URL.revokeObjectURL(job.result.url)
          return { ...job, status: "done", error: null, result: { url, name, size: blob.size, meta } }
        })
      })
    }, 0)
  }

  async function convertJob(id: number, file: File, fmt: Format) {
    const AudioCtx = getAudioContext()
    if (!AudioCtx) {
      updateJob(id, {
        status: "error",
        error:
          "Your browser doesn't support the Web Audio API (AudioContext), so audio can't be extracted here.",
      })
      return
    }

    const ctx = new AudioCtx()
    try {
      updateJob(id, { status: "reading" })
      const arrayBuffer = await file.arrayBuffer()

      updateJob(id, { status: "decoding" })
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
        baseName: file.name,
      }
      updateJob(id, { source })
      encodeJob(id, source, fmt)
    } catch (err) {
      updateJob(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Something went wrong while converting the file.",
      })
    } finally {
      void ctx.close()
    }
  }

  function addFiles(fileList: FileList | null | undefined) {
    const files = fileList ? Array.from(fileList) : []
    if (!files.length) return
    const fmt = format
    const created = files.map<Job>((file) => ({
      id: idRef.current++,
      name: file.name,
      size: file.size,
      status: "reading",
      error: null,
      source: null,
      result: null,
    }))
    setJobs((prev) => [...prev, ...created])
    created.forEach((job, i) => void convertJob(job.id, files[i], fmt))
  }

  function changeFormat(next: Format) {
    if (next === format) return
    setFormat(next)
    jobs.forEach((job) => {
      if (job.source) encodeJob(job.id, job.source, next)
    })
  }

  function removeJob(id: number) {
    setJobs((prev) =>
      prev.filter((job) => {
        if (job.id === id && job.result) URL.revokeObjectURL(job.result.url)
        return job.id !== id
      }),
    )
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files)
    e.target.value = "" // allow re-picking the same file
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  // --- ToolPage actions ---
  function clear() {
    setJobs((prev) => {
      prev.forEach((job) => job.result && URL.revokeObjectURL(job.result.url))
      return []
    })
  }

  const dropzone = (
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
      className={`w-full cursor-pointer transition-colors md:w-[calc(50%-0.5rem)] ${
        dragging ? "border-primary bg-accent/50" : "hover:bg-muted/50"
      }`}
    >
      <AttachmentMedia>
        <HugeiconsIcon icon={CloudUploadIcon} aria-hidden />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>Drag &amp; drop a video, or click to browse</AttachmentTitle>
        <AttachmentDescription>{SUPPORTED_LABEL} · in-browser only</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  )

  return (
    <ToolPage
      page="Video → Audio"
      icon={AudioWave01Icon}
      onClear={clear}
      segments={{
        value: format,
        onValueChange: (value) => changeFormat(value as Format),
        disabled: anyBusy,
        options: [
          { value: "mp3", label: "MP3", icon: MusicNote01Icon },
          { value: "wav", label: "WAV", icon: AudioWave01Icon },
        ],
      }}
    >
      <div className="flex flex-1 flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          onChange={onPick}
          className="hidden"
        />

        {/* One row per file: source (left) and its output (right), side by side. */}
        {jobs.map((job) => {
          const resultIsMp3 = job.result?.name.endsWith(".mp3")
          return (
            <div key={job.id} className="grid items-stretch gap-4 md:grid-cols-2">
              <Attachment className="h-full w-full">
                <AttachmentMedia>
                  <HugeiconsIcon icon={Video01Icon} aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{job.name}</AttachmentTitle>
                  <AttachmentDescription>{formatBytes(job.size)}</AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Remove ${job.name}`}
                    onClick={() => removeJob(job.id)}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>

              {isBusy(job.status) ? (
                <Attachment state="processing" className="h-full w-full">
                  <AttachmentMedia>
                    <HugeiconsIcon icon={Loading03Icon} aria-hidden className="animate-spin" />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>
                      {STATUS_LABEL[job.status as keyof typeof STATUS_LABEL]}
                    </AttachmentTitle>
                    <AttachmentDescription>Working in your browser…</AttachmentDescription>
                  </AttachmentContent>
                </Attachment>
              ) : job.status === "error" ? (
                <Attachment state="error" className="h-full w-full">
                  <AttachmentMedia>
                    <HugeiconsIcon icon={AlertCircleIcon} aria-hidden />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>Couldn&apos;t convert</AttachmentTitle>
                    <AttachmentDescription className="whitespace-normal">
                      {job.error}
                    </AttachmentDescription>
                  </AttachmentContent>
                </Attachment>
              ) : job.result ? (
                <Attachment state="done" className="h-full w-full">
                  <AttachmentMedia>
                    <HugeiconsIcon
                      icon={resultIsMp3 ? MusicNote01Icon : AudioWave01Icon}
                      aria-hidden
                    />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{job.result.name}</AttachmentTitle>
                    <AttachmentDescription>
                      {job.result.meta} · {formatBytes(job.result.size)}
                    </AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <Button asChild size="sm">
                      <a href={job.result.url} download={job.result.name}>
                        <HugeiconsIcon icon={Download04Icon} aria-hidden />
                        Download
                      </a>
                    </Button>
                  </AttachmentActions>
                </Attachment>
              ) : null}
            </div>
          )
        })}

        {/* Half-width drop area — always available to add another file. */}
        {dropzone}
      </div>
    </ToolPage>
  )
}
