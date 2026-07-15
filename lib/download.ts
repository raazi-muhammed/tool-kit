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
  const blob = await canvasToBlob(canvas, mime).catch(() => null)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  downloadFile(url, replaceExtension(name, extensionForMime(mime)))
  URL.revokeObjectURL(url)
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
