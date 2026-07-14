"use client"

import {
  AlertCircleIcon,
  ArrowDataTransferHorizontalIcon,
  AudioWave01Icon,
  CloudUploadIcon,
  Loading03Icon,
  MusicNote01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons"
import { useRef } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useFiles } from "@/hooks/use-files"
import { downloadFile, downloadStagger } from "@/lib/download"
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
type JobStatus = "idle" | "reading" | "decoding" | "encoding" | "done" | "error"
type Source = { samples: Float32Array; sampleRate: number; baseName: string }
type Result = { url: string; name: string; size: number; meta: string }
type Job = {
  id: number
  file: File
  name: string
  size: number
  status: JobStatus
  error: string | null
  source: Source | null
  result: Result | null
  // Independent per file, like Image Converter's format.
  format: Format
}

const STATUS_LABEL: Record<"reading" | "decoding" | "encoding", string> = {
  reading: "Reading file…",
  decoding: "Decoding audio…",
  encoding: "Encoding audio…",
}

const isBusy = (status: JobStatus) =>
  status === "reading" || status === "decoding" || status === "encoding"

export default function VideoToAudioPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles,
    updateJob,
    removeJob,
  } = useFiles<Job>({
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      size: file.size,
      status: "idle",
      error: null,
      source: null,
      result: null,
      format: "mp3",
    }),
    cleanupJob: (job) => {
      if (job.result) URL.revokeObjectURL(job.result.url)
    },
  })
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const anyBusy = jobs.some((job) => isBusy(job.status))
  const anyIdle = jobs.some((job) => job.status === "idle")

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
        updateJob(id, {
          status: "error",
          error: "Something went wrong while encoding the audio.",
        })
        return
      }
      const name = replaceExtension(source.baseName, fmt)
      const meta =
        fmt === "mp3"
          ? `MP3 · ${MP3_KBPS} kbps · mono`
          : "WAV · 16-bit PCM · mono"
      updateJob(id, (job) => {
        if (job.result) URL.revokeObjectURL(job.result.url)
        const url = URL.createObjectURL(blob)
        return {
          status: "done",
          error: null,
          result: { url, name, size: blob.size, meta },
        }
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
          "This file has no audio track, or its format isn't supported by your browser."
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
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong while converting the file.",
      })
    } finally {
      void ctx.close()
    }
  }

  function convert() {
    jobs.forEach((job) => {
      if (job.status === "idle") void convertJob(job.id, job.file, job.format)
    })
  }

  // Changing a job's format only re-encodes that job (from its already
  // decoded source, if it has one) — other queued jobs keep their own format.
  function changeFormat(id: number, next: Format) {
    const job = jobs.find((j) => j.id === id)
    if (!job || next === job.format) return
    updateJob(id, { format: next })
    if (job.source) encodeJob(id, job.source, next)
  }

  function download() {
    if (activeJob?.result)
      downloadFile(activeJob.result.url, activeJob.result.name)
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
      page="Video to Audio"
      icon={AudioWave01Icon}
      onAddFile={jobs.length > 0 ? dropzoneRef : undefined}
      fileStrip={
        jobs.length > 0 && (
          <JobStrip
            jobs={jobs.map((job) => ({ ...job, icon: Video01Icon }))}
            activeId={activeId}
            onSelect={setActiveId}
            onRemove={removeJob}
          />
        )
      }
      sidebar={
        jobs.length > 0
          ? {
              segments: activeJob
                ? {
                    value: activeJob.format,
                    onValueChange: (value) =>
                      changeFormat(activeJob.id, value as Format),
                    label: "Format",
                    options: [
                      { value: "mp3", label: "MP3", icon: MusicNote01Icon },
                      { value: "wav", label: "WAV", icon: AudioWave01Icon },
                    ],
                    disabled: anyBusy,
                  }
                : undefined,
              actions: [
                {
                  label: "Convert",
                  icon: ArrowDataTransferHorizontalIcon,
                  onClick: convert,
                  disabled: anyBusy || !anyIdle,
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
              layer={{
                kind: "status",
                icon: Video01Icon,
                message: (
                  <>
                    {activeJob.name}
                    <br />
                    {formatBytes(activeJob.size)}
                  </>
                ),
              }}
            />

            <PreviewCard
              fill
              title="Converted"
              layer={
                isBusy(activeJob.status)
                  ? {
                      kind: "status",
                      icon: Loading03Icon,
                      spin: true,
                      message:
                        STATUS_LABEL[
                          activeJob.status as keyof typeof STATUS_LABEL
                        ],
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
                          icon: activeJob.result.name.endsWith(".mp3")
                            ? MusicNote01Icon
                            : AudioWave01Icon,
                          message: (
                            <>
                              {activeJob.result.name}
                              <br />
                              {activeJob.result.meta} ·{" "}
                              {formatBytes(activeJob.result.size)}
                            </>
                          ),
                        }
                      : {
                          kind: "status",
                          message: "Pick a format and hit Convert",
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
          title="Drag and drop a video to upload"
          description={`or, click to browse · ${SUPPORTED_LABEL} · in-browser only`}
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />
      </div>
    </ToolPage>
  )
}
