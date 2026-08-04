import { zipSync } from "fflate"

import { canvasToBlob } from "@/lib/canvas"
import { replaceExtension } from "@/lib/wav"

/** Trigger a browser download for a URL via a throwaway anchor click. */
export function downloadFile(url: string, name: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
}

/** Pause between successive downloads so browsers don't block a burst of them. */
export function downloadStagger(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150))
}

/** The extension a canvas's blob-encoded mime type actually produces. */
export function extensionForMime(mime: string): string {
  return mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "png"
}

/** A source file's own MIME if it's an image one a canvas can re-encode to, else `fallback`. */
export function outputMime(sourceType: string, fallback = "image/png"): string {
  return sourceType && sourceType.startsWith("image/") ? sourceType : fallback
}

/** A named blob, ready to trigger a download or fold into a zip. */
export type ZipEntry = { name: string; blob: Blob }

/**
 * Encode a canvas to `mime`, replacing `name`'s extension to match. Returns
 * `null` if encoding produced no data (a canvas can fail to encode, e.g.
 * zero-size).
 */
export async function canvasBlobNamed(
  canvas: HTMLCanvasElement,
  name: string,
  mime: string
): Promise<ZipEntry | null> {
  const blob = await canvasToBlob(canvas, mime).catch(() => null)
  if (!blob) return null
  return { name: replaceExtension(name, extensionForMime(mime)), blob }
}

/**
 * Encode a canvas to `mime` and trigger a download, replacing `name`'s
 * extension to match. Silently no-ops if encoding produced no data (a
 * canvas can fail to encode, e.g. zero-size).
 */
export async function downloadCanvas(
  canvas: HTMLCanvasElement,
  name: string,
  mime: string
) {
  const entry = await canvasBlobNamed(canvas, name, mime)
  if (!entry) return
  const url = URL.createObjectURL(entry.blob)
  downloadFile(url, entry.name)
  URL.revokeObjectURL(url)
}

/** Recover the underlying Blob behind an `object URL` (e.g. a job's persisted `FileResult.url`) — no network round-trip, just a browser API. */
export async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url)
  return res.blob()
}

/** A generated file kept as an object URL, ready to preview/download. */
export type FileResult = { url: string; name: string; size: number }

/**
 * Build a fresh `FileResult` from `blob`, revoking `prev`'s object URL first
 * (if any) — the "replace this job's result with a new one" step every
 * generate/convert job does after producing a blob.
 */
export function setBlobResult(
  prev: FileResult | null | undefined,
  blob: Blob,
  name: string
): FileResult {
  if (prev) URL.revokeObjectURL(prev.url)
  return { url: URL.createObjectURL(blob), name, size: blob.size }
}

/**
 * Download every job in `jobs` that `shouldDownload` accepts, staggering each
 * one so browsers don't block a burst of downloads — the "Download all"
 * shared by every multi-job tool.
 */
export async function downloadAllJobs<T>(
  jobs: T[],
  shouldDownload: (job: T) => boolean,
  downloadJob: (job: T) => Promise<void>
) {
  for (const job of jobs) {
    if (!shouldDownload(job)) continue
    await downloadJob(job)
    await downloadStagger()
  }
}

/** Disambiguate a repeated entry name (e.g. two jobs both named "photo.png") so nothing gets silently overwritten inside the zip. */
function uniqueZipName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf(".")
  const base = dot === -1 ? name : name.slice(0, dot)
  const ext = dot === -1 ? "" : name.slice(dot)
  let candidate = name
  let n = 2
  while (used.has(candidate)) {
    candidate = `${base} (${n})${ext}`
    n++
  }
  used.add(candidate)
  return candidate
}

/** Bundle `entries` into a single .zip and trigger one download for it. No-ops if `entries` is empty. */
export async function downloadZip(entries: ZipEntry[], zipName: string) {
  if (!entries.length) return
  const used = new Set<string>()
  const files: Record<string, Uint8Array> = {}
  for (const entry of entries) {
    files[uniqueZipName(entry.name, used)] = new Uint8Array(
      await entry.blob.arrayBuffer()
    )
  }
  const zipped = zipSync(files)
  const blob = new Blob([new Uint8Array(zipped)], { type: "application/zip" })
  const url = URL.createObjectURL(blob)
  downloadFile(url, zipName)
  URL.revokeObjectURL(url)
}

/**
 * The "Download as ZIP" counterpart to `downloadAllJobs`: collect every job
 * `shouldDownload` accepts into a `ZipEntry` (skipping any `blobForJob`
 * resolves to `null`, e.g. an unencodable canvas) and bundle them into one
 * .zip download instead of a burst of individual ones.
 */
export async function downloadJobsAsZip<T>(
  jobs: T[],
  shouldDownload: (job: T) => boolean,
  blobForJob: (job: T) => Promise<ZipEntry | null>,
  zipName: string
) {
  const entries = (
    await Promise.all(jobs.filter(shouldDownload).map(blobForJob))
  ).filter((entry): entry is ZipEntry => entry !== null)
  await downloadZip(entries, zipName)
}
