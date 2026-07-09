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
export async function downloadCanvas(canvas: HTMLCanvasElement, name: string, mime: string) {
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, mime))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  downloadFile(url, replaceExtension(name, extensionForMime(mime)))
  URL.revokeObjectURL(url)
}
