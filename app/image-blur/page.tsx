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
import { addFilesReportingErrors, useFiles } from "@/hooks/use-files"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useRectSelection } from "@/hooks/use-rect-selection"
import { useZoomPan } from "@/hooks/use-zoom-pan"
import {
  blurRegion,
  canvasPointFromEvent,
  drawSelectionRect,
  pointInRect,
  scaleRect,
  type BlurMode,
  type Rect,
} from "@/lib/canvas"
import { downloadCanvas, downloadStagger, outputMime } from "@/lib/download"
import { loadImageAsCanvas } from "@/lib/image-file"

const ACCEPTED = "image/*"

type Job = {
  id: number
  file: File
  name: string
  previewUrl: string
  hasEdits: boolean
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
    loadResource: loadImageAsCanvas,
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

  const { viewportRef, zoomPct, MIN_ZOOM, MAX_ZOOM, fitView, zoomFromButton } = useZoomPan({
    canvasRef: displayCanvasRef,
    getBaseSize: () => getResource(),
  })

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
  // synchronously when a file is added.
  useEffect(() => {
    if (activeId == null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    clearAllRects()
    renderDisplay()
    fitView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  function clear() {
    clearQueue()
    setError(null)
    rectsRef.current = []
    setRects([])
    clearSelection()
  }

  function addFiles(fileList: FileList | null | undefined) {
    return addFilesReportingErrors(
      addFilesToQueue,
      fileList,
      "None of the selected files could be loaded as images.",
      setError
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
    await downloadCanvas(base, job.name, outputMime(job.file.type))
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
        label: "Blur Type",
        options: [
          { value: "pixelate", label: "Blocky", icon: GridViewIcon },
          { value: "gaussian", label: "Gaussian", icon: BlurIcon },
        ],
      }}
      onAddFile={jobs.length > 0 ? () => dropzoneRef.current?.open() : undefined}
      onClear={clear}
      fileStrip={
        jobs.length > 1 && (
          <JobStrip jobs={jobs} activeId={activeId} onSelect={setActiveId} onRemove={removeJob} />
        )
      }
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
                label: "Amount",
                value: blur,
                onValueChange: onBlurChange,
                min: 1,
                max: 50,
                unit: "px",
              },
              actions: [
                pendingRect && {
                  label: "Delete rectangle",
                  icon: RemoveSquareIcon,
                  onClick: clearSelection,
                  variant: "ghost",
                  emphasis: "secondary",
                },
                rects.length > 0 && {
                  label: "Clear all",
                  icon: Cancel01Icon,
                  onClick: clearAllRects,
                  variant: "ghost",
                  emphasis: "secondary",
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
