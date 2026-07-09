"use client"

import {
  BlurIcon,
  Cancel01Icon,
  CloudUploadIcon,
  GridViewIcon,
  RemoveSquareIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JobStrip } from "@/components/job-strip"
import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { useFiles } from "@/hooks/use-files"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useRectSelection } from "@/hooks/use-rect-selection"
import {
  blurRegion,
  canvasPointFromEvent,
  drawSelectionRect,
  pointInRect,
  scaleRect,
  type BlurMode,
  type Rect,
} from "@/lib/canvas"
import { downloadFile, downloadStagger } from "@/lib/download"
import { imageToCanvas, loadImage } from "@/lib/image-file"
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
  hasEdits: boolean
}

async function loadResource(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    return imageToCanvas(await loadImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

function parseBlurSettings(
  value: unknown
): { blur: number; mode: BlurMode } | null {
  if (typeof value !== "object" || value === null) return null
  const { blur, mode } = value as Record<string, unknown>
  if (typeof blur !== "number" || !Number.isFinite(blur)) return null
  if (mode !== "gaussian" && mode !== "pixelate") return null
  return { blur: Math.min(50, Math.max(1, blur)), mode }
}

export default function ImageBlurPage() {
  const {
    jobs,
    activeId,
    setActiveId,
    activeJob,
    addFiles: addFilesToQueue,
    updateJob,
    removeJob,
    clear: clearQueue,
    getResource,
    setResource,
  } = useFiles<Job, HTMLCanvasElement>({
    loadResource,
    createJob: (file, id) => ({
      id,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      hasEdits: false,
    }),
    cleanupJob: (job) => URL.revokeObjectURL(job.previewUrl),
  })
  const [error, setError] = useState<string | null>(null)
  const [{ blur, mode }, setBlurSettings] = usePersistedState(
    "image-blur:settings",
    { blur: 20, mode: "pixelate" as BlurMode },
    parseBlurSettings
  )

  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  // Rectangles already drawn and left in place when a new one was started
  // elsewhere — separate from the hook's own `pendingRect`, which is just the
  // one currently being drawn/dragged. Mirrored into a ref so `renderDisplay`
  // (called synchronously from inside `clearSelection`/`onDiscardPending`,
  // before React re-renders) always sees the latest list instead of a stale
  // closure over `rects` state.
  const [rects, setRects] = useState<Rect[]>([])
  const rectsRef = useRef<Rect[]>([])

  const { pendingRect, clearSelection, selectRect, selectionHandlers } =
    useRectSelection({
      canvasRef: displayCanvasRef,
      render: (rect) => renderDisplay(rect ?? undefined),
      // Drawing a new rect elsewhere shouldn't erase the one already there —
      // queue it instead of letting the hook discard it.
      onDiscardPending: (rect) => {
        rectsRef.current = [...rectsRef.current, rect]
        setRects(rectsRef.current)
      },
    })

  const totalRects = rects.length + (pendingRect ? 1 : 0)

  function clearAllRects() {
    rectsRef.current = []
    setRects([])
    clearSelection()
  }

  // Queued rects (unlike the hook's own `pendingRect`) aren't wired up for
  // interaction — hand a click on one of them off to the hook instead of
  // letting it start a fresh selection there, so any queued rect can be
  // picked up and moved/resized, not just the most recently drawn one.
  function onCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = displayCanvasRef.current
    if (canvas && rectsRef.current.length > 0) {
      const point = canvasPointFromEvent(canvas, e)
      const onActiveRect =
        pendingRect && pointInRect(point.x, point.y, pendingRect)
      if (!onActiveRect) {
        const index = rectsRef.current.findIndex((r) =>
          pointInRect(point.x, point.y, r)
        )
        if (index !== -1) {
          const rect = rectsRef.current[index]
          const rest = rectsRef.current.filter((_, i) => i !== index)
          const nextRects = pendingRect ? [...rest, pendingRect] : rest
          rectsRef.current = nextRects
          setRects(nextRects)
          selectRect(rect, e)
          return
        }
      }
    }
    selectionHandlers.onPointerDown(e)
  }

  // Layered on top of the hook's own hover-cursor logic (which only knows
  // about `pendingRect`) so hovering a queued rect also previews as movable.
  function onCanvasPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    selectionHandlers.onPointerMove(e)
    const canvas = displayCanvasRef.current
    if (!canvas) return
    const point = canvasPointFromEvent(canvas, e)
    if (rectsRef.current.some((r) => pointInRect(point.x, point.y, r))) {
      canvas.style.cursor = "move"
    }
  }

  // Zoom/pan is pure CSS transform on the canvas inside a clipped viewport —
  // selection mapping is unaffected because getBoundingClientRect already
  // reflects the transform. Kept in refs (not state) so wheel/pinch events
  // don't re-render React on every tick; `zoomPct` mirrors it for the UI.
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

  function renderDisplay(
    rect?: Rect,
    blurPx: number = blur,
    blurMode: BlurMode = mode
  ) {
    const base = getResource()
    const display = displayCanvasRef.current
    if (!base || !display) return
    const ctx = display.getContext("2d")
    if (!ctx) return

    // Keep the visible canvas's internal resolution in sync with the image —
    // it may have just mounted or switched to a different queued job.
    if (display.width !== base.width || display.height !== base.height) {
      display.width = base.width
      display.height = base.height
    }

    const allRects = rect ? [...rectsRef.current, rect] : rectsRef.current
    if (allRects.length > 0) {
      blurRegion(display, base, allRects, blurPx, blurMode)
    } else {
      ctx.drawImage(base, 0, 0)
    }

    for (const r of allRects) drawSelectionRect(display, r)
  }

  // Paint + fit the visible canvas whenever the active job changes — it only
  // exists in the DOM once a file has been picked, so this can't happen
  // synchronously when a file is added. Also wires zoom/pan listeners
  // natively: React registers wheel handlers as passive, which would make
  // preventDefault (needed to stop page scroll and browser pinch-zoom) a
  // no-op.
  useEffect(() => {
    if (activeId == null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    clearAllRects()
    renderDisplay()
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

  function clear() {
    clearQueue()
    setError(null)
    rectsRef.current = []
    setRects([])
    clearSelection()
  }

  async function addFiles(fileList: FileList | null | undefined) {
    const { addedCount, failedCount } = await addFilesToQueue(fileList)
    setError(
      addedCount === 0 && failedCount > 0
        ? "None of the selected files could be loaded as images."
        : null
    )
  }

  function blurJob(id: number, targetRects: Rect[]) {
    const base = getResource(id)
    if (!base) return
    // Commit the blur into the base image so it becomes the new ground truth.
    const committed = document.createElement("canvas")
    committed.width = base.width
    committed.height = base.height
    blurRegion(committed, base, targetRects, blur, mode)
    setResource(id, committed)
    updateJob(id, { hasEdits: true })
  }

  function applyBlur() {
    if (activeId == null || totalRects === 0) return
    const allRects = pendingRect ? [...rects, pendingRect] : rects
    blurJob(activeId, allRects)
    clearAllRects()
  }

  // Applies the current selection to every queued image, scaled to each
  // image's own dimensions since they aren't necessarily the same size.
  function applyBlurToAll() {
    if (activeId == null || totalRects === 0) return
    const activeImage = getResource(activeId)
    if (!activeImage) return
    const allRects = pendingRect ? [...rects, pendingRect] : rects

    jobs.forEach((job) => {
      const image = getResource(job.id)
      if (!image) return
      blurJob(
        job.id,
        allRects.map((rect) => scaleRect(rect, activeImage, image))
      )
    })
    clearAllRects()
  }

  async function downloadJob(job: Job) {
    const base = getResource(job.id)
    if (!base) return
    const mime =
      job.file.type && job.file.type.startsWith("image/")
        ? job.file.type
        : "image/png"
    const blob: Blob | null = await new Promise((resolve) =>
      base.toBlob(resolve, mime)
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

  // Skips jobs with no committed blur — downloading them would just hand
  // back the original file.
  async function downloadAll() {
    for (const job of jobs) {
      if (!job.hasEdits) continue
      await downloadJob(job)
      await downloadStagger()
    }
  }

  // Re-render whenever the blur strength or mode changes while a selection is
  // pending, so the preview stays live. New values are passed explicitly —
  // the state in these closures is still the old one.
  function onBlurChange(value: number) {
    setBlurSettings((prev) => ({ ...prev, blur: value }))
    if (totalRects > 0) renderDisplay(pendingRect ?? undefined, value)
  }

  function onModeChange(value: BlurMode) {
    setBlurSettings((prev) => ({ ...prev, mode: value }))
    if (totalRects > 0) renderDisplay(pendingRect ?? undefined, blur, value)
  }

  return (
    <ToolPage
      page="Image Blur"
      icon={BlurIcon}
      segments={{
        value: mode,
        onValueChange: (value) => onModeChange(value as BlurMode),
        options: [
          { value: "pixelate", label: "Blocky", icon: GridViewIcon },
          { value: "gaussian", label: "Gaussian", icon: BlurIcon },
        ],
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
              slider: {
                label: "Blur",
                value: blur,
                onValueChange: onBlurChange,
                min: 1,
                max: 50,
              },
              actions: [
                pendingRect && {
                  label: "Delete rectangle",
                  icon: RemoveSquareIcon,
                  onClick: clearSelection,
                  variant: "ghost",
                },
                rects.length > 0 && {
                  label: "Clear all",
                  icon: Cancel01Icon,
                  onClick: clearAllRects,
                  variant: "ghost",
                },
                {
                  label:
                    totalRects > 1 ? `Apply blur (${totalRects})` : "Apply blur",
                  icon: BlurIcon,
                  onClick: applyBlur,
                  disabled: totalRects === 0,
                  more:
                    jobs.length > 1
                      ? {
                          label: "Apply blur to all",
                          icon: BlurIcon,
                          onClick: applyBlurToAll,
                          disabled: totalRects === 0,
                        }
                      : undefined,
                },
              ],
              download: {
                onDownload: download,
                disabled: !activeJob.hasEdits,
                onDownloadAll: jobs.length > 1 ? downloadAll : undefined,
                downloadAllDisabled: !jobs.some((job) => job.hasEdits),
              },
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {activeJob ? (
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
                ...selectionHandlers,
                onPointerDown: onCanvasPointerDown,
                onPointerMove: onCanvasPointerMove,
                className: "cursor-crosshair touch-none",
              }}
            />
          </div>
        ) : null}

        {/* Drop area — hidden (but still mounted, for the header's Add file
            button) once at least one image has been picked. */}
        <Dropzone
          ref={dropzoneRef}
          icon={CloudUploadIcon}
          title="Drag and drop images to upload"
          description="or, click to browse · blur any region · in-browser only"
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
