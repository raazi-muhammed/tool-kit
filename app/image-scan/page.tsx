"use client"

import {
  AiScanIcon,
  CloudUploadIcon,
  ContrastIcon,
  DropletOffIcon,
  Image01Icon,
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
    setResource,
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

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)
  // The current filter applied to the active job's resource — recomputed
  // whenever the resource, filter, or threshold changes, and reused as-is on
  // every quad-drag repaint so dragging a corner doesn't re-run a filter
  // over the whole image on every pointer move.
  const filteredRef = useRef<HTMLCanvasElement | null>(null)

  const { quad, resetQuad, quadHandlers } = useQuadSelection({
    canvasRef: displayCanvasRef,
    render: (quad) => renderDisplay(quad),
  })

  /** Recompute `filteredRef` from the active job's current resource. */
  function updateFiltered(f: ScanFilter = filter, threshold: number = bwThreshold) {
    const image = getResource()
    filteredRef.current = image ? applyScanFilter(image, f, threshold) : null
  }

  // Zoom/pan is a pure CSS transform on the canvas inside a clipped
  // viewport — selection/corner-drag hit testing is unaffected because
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
    ctx.drawImage(filteredRef.current ?? image, 0, 0)
    if (quad) drawQuadSelection(display, quad)
  }

  // Seed the quad whenever the active image changes — either a newly
  // picked/switched job, or the same job right after its resource was just
  // replaced by a warped result. Tries auto-detecting the document's
  // corners first, falling back to a plain inset default if detection
  // didn't find anything plausible.
  function reseedQuad(id: number | null) {
    const image = getResource(id ?? undefined)
    if (!image) {
      resetQuad(null)
      return
    }
    resetQuad(detectDocumentQuad(image) ?? defaultQuad(image.width, image.height))
  }

  // Paint + fit the visible canvas whenever the active job changes — it only
  // exists in the DOM once a file has been picked, so this can't happen
  // synchronously when a file is added. Also wires zoom/pan listeners
  // natively: React registers wheel handlers as passive, which would make
  // preventDefault (needed to stop page scroll and browser pinch-zoom) a
  // no-op.
  useEffect(() => {
    if (activeId == null) return
    updateFiltered()
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

  // Re-run the filter automatically whenever it (or the B&W threshold)
  // changes, instead of requiring an explicit apply click — debounced so
  // dragging the threshold slider (many onValueChange updates a second)
  // doesn't re-filter the whole image on every tick, only once it settles.
  useEffect(() => {
    if (activeId == null) return
    const timeout = setTimeout(() => {
      updateFiltered()
      renderDisplay(quad)
    }, 200)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, bwThreshold])

  function clear() {
    clearQueue()
    setError(null)
    setProcessingId(null)
    setFilter("original")
    setBwThreshold(160)
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
    const warped = warpQuadToRect(image, cornerQuad, width, height)
    setResource(id, warped)
  }

  async function applyScan() {
    if (activeId == null || !quad) return
    setProcessingId(activeId)
    // Yield a frame so the "Scanning…" state actually paints before the
    // (synchronous, potentially slow) per-pixel warp runs.
    await new Promise((resolve) => setTimeout(resolve, 0))
    scanJob(activeId, quad)
    updateFiltered()
    reseedQuad(activeId)
    // The warped result is a different size than the original photo, so the
    // previous fit no longer applies.
    fitView()
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
    jobs.forEach((job) => {
      const image = getResource(job.id)
      if (!image) return
      const jobQuad = job.id === activeId ? quad : scaleQuad(quad, activeImage, image)
      scanJob(job.id, jobQuad)
    })
    updateFiltered()
    reseedQuad(activeId)
    fitView()
    setProcessingId(null)
  }

  function autoDetectCorners() {
    reseedQuad(activeId)
  }

  async function downloadJob(job: Job) {
    const image = getResource(job.id)
    if (!image) return
    const filtered = applyScanFilter(image, filter, bwThreshold)
    const mime =
      job.file.type && job.file.type.startsWith("image/")
        ? job.file.type
        : "image/png"
    const blob: Blob | null = await new Promise((resolve) =>
      filtered.toBlob(resolve, mime)
    )
    if (!blob) return
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "png"
    const name = replaceExtension(job.name, ext)
    const url = URL.createObjectURL(blob)
    downloadFile(url, name)
    URL.revokeObjectURL(url)
  }

  function download() {
    if (activeJob) void downloadJob(activeJob)
  }

  async function downloadAll() {
    for (const job of jobs) {
      await downloadJob(job)
      await downloadStagger()
    }
  }

  const anyProcessing = processingId != null

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
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
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
              onRemove={removeJob}
            />
            <PreviewCard
              fill
              viewportRef={viewportRef}
              layer={{
                ref: displayCanvasRef,
                ...quadHandlers,
                className: "touch-none",
              }}
            />
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
