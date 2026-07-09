"use client"

import {
  AiScanIcon,
  CloudUploadIcon,
  ContrastIcon,
  DropletOffIcon,
  Image01Icon,
  Loading03Icon,
  MagicWand01Icon,
  ScanIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useEditorQueue } from "@/hooks/use-editor-queue"
import { useQuadSelection } from "@/hooks/use-quad-selection"
import {
  defaultQuad,
  drawQuadSelection,
  quadOutputSize,
  scaleQuad,
  warpQuadToRect,
  type Quad,
} from "@/lib/canvas"
import { detectDocumentQuad } from "@/lib/document-detect"
import { downloadFile, downloadStagger } from "@/lib/download"
import { imageToCanvas, loadImage } from "@/lib/image-file"
import { applyScanFilter, type ScanFilter } from "@/lib/image-filter"
import { replaceExtension } from "@/lib/wav"

const ACCEPTED = "image/*"
const MIN_ZOOM = 1
const MAX_ZOOM = 8
// Formats a <canvas> can actually encode to via toBlob — a source file's own
// MIME (HEIC off an iPhone, TIFF, AVIF, ...) may not be one of these even
// though the browser could decode it to draw it in the first place.
const ENCODABLE_MIME = new Set(["image/png", "image/jpeg", "image/webp"])

// Safari's trackpad pinch arrives as gesture* events, not ctrl+wheel.
type SafariGestureEvent = Event & {
  scale?: number
  clientX?: number
  clientY?: number
}

type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
}

async function loadResource(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    return imageToCanvas(await loadImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function ImageScanPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles: addFilesToQueue,
    removeJob,
    clear: clearQueue,
    getResource,
  } = useEditorQueue<Job, HTMLCanvasElement>({
    loadResource,
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }),
    cleanupJob: (job) => URL.revokeObjectURL(job.previewUrl),
  })
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<ScanFilter>("original")
  const [bwThreshold, setBwThreshold] = useState(160)
  // Which job ids currently have a committed scan result — mirrors
  // `scanResultsRef` as real state so the render body (which layer to show,
  // whether Download is enabled) can read it without touching a ref during
  // render. Reassigned to a new Set on every change (even a re-scan of an
  // already-scanned job) so effects keyed on it always re-fire.
  const [scannedIds, setScannedIds] = useState<Set<number>>(new Set())

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)
  // The warped (unfiltered) output of the last "Scan" per job — kept
  // separate from the job's own resource (the original photo, via
  // useEditorQueue), which is never mutated, so the corner selection can
  // always be re-adjusted and re-scanned against the untouched original
  // instead of the original being lost the moment a scan is applied.
  const scanResultsRef = useRef<Map<number, HTMLCanvasElement>>(new Map())

  const { quad, resetQuad, quadHandlers } = useQuadSelection({
    canvasRef: displayCanvasRef,
    render: (quad) => renderDisplay(quad),
  })

  // Zoom/pan (Original pane only — the Scanned pane is a plain fit-to-box
  // preview) is a pure CSS transform on the canvas inside a clipped
  // viewport — corner-drag hit testing is unaffected because
  // getBoundingClientRect already reflects the transform. Kept in refs (not
  // state) so wheel/pinch events don't re-render React on every tick;
  // `zoomPct` mirrors it for the footer's readout.
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef({ scale: 1, x: 0, y: 0 })
  const fitSizeRef = useRef({ width: 0, height: 0 })
  const [zoomPct, setZoomPct] = useState(100)

  function applyView() {
    const canvas = displayCanvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return
    const view = viewRef.current
    // Clamp so the image stays inside the viewport (centered when smaller).
    const vw = viewport.clientWidth
    const vh = viewport.clientHeight
    const w = fitSizeRef.current.width * view.scale
    const h = fitSizeRef.current.height * view.scale
    view.x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, view.x))
    view.y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, view.y))
    canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
    setZoomPct(Math.round(view.scale * 100))
  }

  /** Size the canvas to fit the viewport (object-contain) and reset the view. */
  function fitView() {
    const canvas = displayCanvasRef.current
    const viewport = viewportRef.current
    const base = getResource()
    if (!canvas || !viewport || !base) return
    const fit = Math.min(
      viewport.clientWidth / base.width,
      viewport.clientHeight / base.height
    )
    fitSizeRef.current = { width: base.width * fit, height: base.height * fit }
    canvas.style.width = `${fitSizeRef.current.width}px`
    canvas.style.height = `${fitSizeRef.current.height}px`
    viewRef.current = { scale: 1, x: 0, y: 0 }
    applyView()
  }

  /** Zoom by `factor` keeping the viewport point (px, py) fixed. */
  function zoomAt(px: number, py: number, factor: number) {
    const view = viewRef.current
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * factor))
    const applied = next / view.scale
    view.x = px - (px - view.x) * applied
    view.y = py - (py - view.y) * applied
    view.scale = next
    applyView()
  }

  function zoomFromButton(factor: number) {
    const viewport = viewportRef.current
    if (!viewport) return
    zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, factor)
  }

  /** Repaint the Original pane: the untouched source image plus the quad overlay. */
  function renderDisplay(quad: Quad | null) {
    const image = getResource()
    const display = displayCanvasRef.current
    if (!image || !display) return
    const ctx = display.getContext("2d")
    if (!ctx) return

    if (display.width !== image.width || display.height !== image.height) {
      display.width = image.width
      display.height = image.height
    }

    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(image, 0, 0)
    if (quad) drawQuadSelection(display, quad)
  }

  /** Repaint the Scanned pane from the active job's last scan result, with the current filter applied. */
  function renderResult() {
    const canvas = resultCanvasRef.current
    const scanned = activeId != null ? scanResultsRef.current.get(activeId) : undefined
    if (!canvas || !scanned) return
    const filtered = applyScanFilter(scanned, filter, bwThreshold)
    if (canvas.width !== filtered.width || canvas.height !== filtered.height) {
      canvas.width = filtered.width
      canvas.height = filtered.height
    }
    canvas.getContext("2d")?.drawImage(filtered, 0, 0)
  }

  // Seed the quad whenever the active image changes — either a newly
  // picked/switched job, or the same job after "Auto detect" is clicked
  // again. Tries auto-detecting the document's corners first, falling back
  // to a plain inset default if detection didn't find anything plausible.
  function reseedQuad(id: number | null) {
    const image = getResource(id ?? undefined)
    if (!image) {
      resetQuad(null)
      return
    }
    resetQuad(detectDocumentQuad(image) ?? defaultQuad(image.width, image.height))
  }

  // Paint + fit the Original pane whenever the active job changes — it only
  // exists in the DOM once a file has been picked, so this can't happen
  // synchronously when a file is added. Also wires zoom/pan listeners
  // natively: React registers wheel handlers as passive, which would make
  // preventDefault (needed to stop page scroll and browser pinch-zoom) a
  // no-op.
  useEffect(() => {
    if (activeId == null) return
    reseedQuad(activeId)
    fitView()

    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Pinch on Chrome/Firefox trackpads, or ctrl/cmd + scroll wheel.
        const box = viewport.getBoundingClientRect()
        zoomAt(
          e.clientX - box.left,
          e.clientY - box.top,
          Math.exp(-e.deltaY * 0.01)
        )
      } else {
        const view = viewRef.current
        view.x -= e.deltaX
        view.y -= e.deltaY
        applyView()
      }
    }

    // Safari trackpad pinch fires gesture* events instead of ctrl+wheel.
    let gestureStartScale = 1
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gestureStartScale = viewRef.current.scale
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      const gesture = e as SafariGestureEvent
      if (!gesture.scale) return
      const box = viewport.getBoundingClientRect()
      const target = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, gestureStartScale * gesture.scale)
      )
      zoomAt(
        (gesture.clientX ?? box.left + box.width / 2) - box.left,
        (gesture.clientY ?? box.top + box.height / 2) - box.top,
        target / viewRef.current.scale
      )
    }

    const onResize = () => fitView()

    viewport.addEventListener("wheel", onWheel, { passive: false })
    viewport.addEventListener("gesturestart", onGestureStart)
    viewport.addEventListener("gesturechange", onGestureChange)
    window.addEventListener("resize", onResize)
    return () => {
      viewport.removeEventListener("wheel", onWheel)
      viewport.removeEventListener("gesturestart", onGestureStart)
      viewport.removeEventListener("gesturechange", onGestureChange)
      window.removeEventListener("resize", onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Repaint the Scanned pane after switching jobs or committing a new scan —
  // `scannedIds` changing (always a fresh Set, even for a re-scan of the
  // *same* job) is what catches that case, since `activeId` alone wouldn't
  // change. Runs after React commits, so a first-ever scan's freshly-mounted
  // canvas ref is already attached by the time this fires.
  useEffect(() => {
    renderResult()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, scannedIds])

  // Re-run the filter automatically whenever it (or the B&W threshold)
  // changes, instead of requiring an explicit apply click — debounced so
  // dragging the threshold slider (many onValueChange updates a second)
  // doesn't re-filter the whole image on every tick, only once it settles.
  useEffect(() => {
    const timeout = setTimeout(renderResult, 200)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, bwThreshold])

  function clear() {
    clearQueue()
    scanResultsRef.current.clear()
    setScannedIds(new Set())
    setError(null)
    setProcessingId(null)
    setFilter("original")
    setBwThreshold(160)
  }

  function removeJobAndScan(id: number) {
    scanResultsRef.current.delete(id)
    setScannedIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    removeJob(id)
  }

  async function addFiles(fileList: FileList | null | undefined) {
    const { addedCount, failedCount } = await addFilesToQueue(fileList)
    setError(
      addedCount === 0 && failedCount > 0
        ? "None of the selected files could be loaded as images."
        : null
    )
  }

  function scanJob(id: number, cornerQuad: Quad) {
    const image = getResource(id)
    if (!image) return
    const { width, height } = quadOutputSize(cornerQuad)
    scanResultsRef.current.set(id, warpQuadToRect(image, cornerQuad, width, height))
  }

  async function applyScan() {
    if (activeId == null || !quad) return
    setProcessingId(activeId)
    // Yield a frame so the "Scanning…" state actually paints before the
    // (synchronous, potentially slow) per-pixel warp runs.
    await new Promise((resolve) => setTimeout(resolve, 0))
    scanJob(activeId, quad)
    setScannedIds((prev) => new Set(prev).add(activeId))
    setProcessingId(null)
  }

  // Applies the active job's quad to every other queued image, scaled to
  // each image's own dimensions since they aren't necessarily the same size
  // (see Image Crop's "Crop all", which does the same with scaleRect).
  async function applyScanToAll() {
    if (activeId == null || !quad) return
    const activeImage = getResource(activeId)
    if (!activeImage) return

    setProcessingId(activeId)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const scannedNow: number[] = []
    jobs.forEach((job) => {
      const image = getResource(job.id)
      if (!image) return
      const jobQuad = job.id === activeId ? quad : scaleQuad(quad, activeImage, image)
      scanJob(job.id, jobQuad)
      scannedNow.push(job.id)
    })
    setScannedIds((prev) => {
      const next = new Set(prev)
      scannedNow.forEach((id) => next.add(id))
      return next
    })
    setProcessingId(null)
  }

  function autoDetectCorners() {
    reseedQuad(activeId)
  }

  async function downloadJob(job: Job) {
    const scanned = scanResultsRef.current.get(job.id)
    if (!scanned) throw new Error(`"${job.name}" hasn't been scanned yet.`)
    const filtered = applyScanFilter(scanned, filter, bwThreshold)
    // Only reuse the source file's MIME as the *output* encoding when a
    // canvas can actually produce it — formats a browser can merely decode
    // (HEIC/HEIF off an iPhone, TIFF, AVIF, ...) make `toBlob` resolve with
    // null and silently abort the download otherwise.
    const mime = ENCODABLE_MIME.has(job.file.type) ? job.file.type : "image/png"
    const blob: Blob | null = await new Promise((resolve) =>
      filtered.toBlob(resolve, mime)
    )
    if (!blob) throw new Error(`Couldn't encode "${job.name}" for download.`)
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1]
    const name = replaceExtension(job.name, ext)
    const url = URL.createObjectURL(blob)
    downloadFile(url, name)
    URL.revokeObjectURL(url)
  }

  function download() {
    if (!activeJob) return
    setError(null)
    downloadJob(activeJob).catch((err) => {
      setError(err instanceof Error ? err.message : "Something went wrong while downloading.")
    })
  }

  // Skips jobs with no committed scan — downloading them would just hand
  // back the unwarped original. Keeps going past a failed job instead of
  // aborting the rest of the batch, then reports every failure together.
  async function downloadAll() {
    setError(null)
    const failed: string[] = []
    for (const job of jobs) {
      if (!scanResultsRef.current.has(job.id)) continue
      try {
        await downloadJob(job)
      } catch {
        failed.push(job.name)
      }
      await downloadStagger()
    }
    if (failed.length > 0) {
      setError(`Couldn't download: ${failed.join(", ")}`)
    }
  }

  const anyProcessing = processingId != null
  const hasActiveScan = activeId != null && scannedIds.has(activeId)

  return (
    <ToolPage
      page="Image Scan"
      icon={ScanIcon}
      segments={{
        value: filter,
        onValueChange: (value) => setFilter(value as ScanFilter),
        options: [
          { value: "original", label: "Original", icon: Image01Icon },
          { value: "grayscale", label: "Grayscale", icon: DropletOffIcon },
          { value: "bw", label: "B&W", icon: ContrastIcon },
          { value: "enhance", label: "Enhance", icon: MagicWand01Icon },
        ],
        disabled: anyProcessing,
      }}
      onAddFile={jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined}
      onClear={clear}
      footer={
        activeJob
          ? {
              zoom: {
                percent: zoomPct,
                onZoomOut: () => zoomFromButton(0.8),
                onZoomIn: () => zoomFromButton(1.25),
                onFit: fitView,
                zoomOutDisabled: zoomPct <= MIN_ZOOM * 100,
                zoomInDisabled: zoomPct >= MAX_ZOOM * 100,
              },
              slider:
                filter === "bw"
                  ? {
                      label: "Threshold",
                      value: bwThreshold,
                      onValueChange: setBwThreshold,
                      min: 0,
                      max: 255,
                      disabled: anyProcessing,
                    }
                  : undefined,
              actions: [
                {
                  label: "Auto detect",
                  icon: AiScanIcon,
                  onClick: autoDetectCorners,
                  variant: "ghost",
                  disabled: anyProcessing,
                },
                {
                  label: anyProcessing ? "Scanning…" : "Scan",
                  icon: ScanIcon,
                  onClick: applyScan,
                  disabled: !quad || anyProcessing,
                  more:
                    jobs.length > 1
                      ? {
                          label: "Scan all",
                          icon: ScanIcon,
                          onClick: applyScanToAll,
                          disabled: !quad || anyProcessing,
                        }
                      : undefined,
                },
              ],
              download: {
                onDownload: download,
                disabled: !hasActiveScan,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
                downloadAllDisabled: !jobs.some((job) => scannedIds.has(job.id)),
              },
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {activeJob && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <JobStrip
              jobs={jobs}
              activeId={activeId}
              onSelect={setActiveId}
              onRemove={removeJobAndScan}
            />

            {/* Original (left, editable) and Scanned (right, read-only)
                preview, side by side — the original is never mutated by a
                scan, so the corner selection can always be re-adjusted and
                re-scanned without losing the source photo. */}
            <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
              <PreviewCard
                fill
                title="Original"
                viewportRef={viewportRef}
                layer={{
                  ref: displayCanvasRef,
                  ...quadHandlers,
                  className: "touch-none",
                }}
              />
              <PreviewCard
                fill
                title="Scanned"
                layer={
                  hasActiveScan
                    ? {
                        ref: resultCanvasRef,
                        className: "relative max-h-full max-w-full pointer-events-none",
                      }
                    : anyProcessing
                      ? { kind: "status", icon: Loading03Icon, spin: true }
                      : { kind: "status", message: "Hit Scan to see the flattened result" }
                }
              />
            </div>
          </div>
        )}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one image has been picked. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop a photo of a document to upload"
          description="or, click to browse · corners are auto-detected, drag to fine-tune · in-browser only"
          accept={ACCEPTED}
          multiple
          hidden={jobs.length > 0}
          onFiles={addFiles}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </ToolPage>
  )
}
