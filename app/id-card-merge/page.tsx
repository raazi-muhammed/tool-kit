"use client"

import { PDFDocument } from "@cantoo/pdf-lib"
import {
  AlignHorizontalJustifyCenterIcon,
  AlignHorizontalJustifyEndIcon,
  AlignHorizontalJustifyStartIcon,
  AlignVerticalJustifyCenterIcon,
  AlignVerticalJustifyEndIcon,
  AlignVerticalJustifyStartIcon,
  ArrowDataTransferVerticalIcon,
  Cancel01Icon,
  CloudUploadIcon,
  IdentityCardIcon,
  Image02Icon,
  LayoutTwoColumnIcon,
  LayoutTwoRowIcon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRef, useState } from "react"

import { Dropzone } from "@/components/dropzone"
import { PreviewCard } from "@/components/preview-card"
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
import { useDebouncedEffect } from "@/hooks/use-debounced-effect"
import { downloadCanvas, downloadFile } from "@/lib/download"
import { isImageFile, loadImageAsCanvas } from "@/lib/image-file"
import { prepareDisplayCanvas } from "@/lib/canvas"
import { A4_PT, embedCanvasAsPdfPage, isPdfFile, loadPdfjs } from "@/lib/pdf"
import { formatBytes } from "@/lib/wav"

const ACCEPTED = "image/*,application/pdf,.pdf"
// A PDF page's own coordinate space is 72 units/inch — render at 150 DPI
// (matching PDF to Images' "standard" resolution) both for extracted PDF
// pages and for rasterizing the A4 preview/output canvas below.
const RENDER_SCALE = 150 / 72

type Slot = "front" | "back"
type Format = "image" | "pdf"
type Layout = "vertical" | "horizontal"

// A4 portrait for a "vertical" (front-above-back) layout, landscape for
// "horizontal" (front-beside-back) — so a wide, short composed page doesn't
// get letterboxed into a narrow, tall one with huge empty margins.
function a4PtForLayout(layout: Layout): [number, number] {
  return layout === "horizontal" ? [A4_PT[1], A4_PT[0]] : A4_PT
}

function a4PxForLayout(layout: Layout): [number, number] {
  const [w, h] = a4PtForLayout(layout)
  return [w * RENDER_SCALE, h * RENDER_SCALE]
}
// Where front/back sit across the cross axis — the axis gap/padding don't
// already control (horizontal position when stacked "vertical", vertical
// position when stacked "horizontal") — useful once the two images aren't
// the same size.
type Align = "start" | "center" | "end"
type SourceImage = {
  canvas: HTMLCanvasElement
  previewUrl: string
  name: string
  description: string
}

// Renders a PDF's first two pages as canvases — page 1 is the front, page 2
// is the back.
async function pdfToFrontBack(
  file: File
): Promise<[HTMLCanvasElement, HTMLCanvasElement]> {
  const url = URL.createObjectURL(file)
  try {
    const pdfjs = await loadPdfjs()
    const doc = await pdfjs.getDocument(url).promise
    if (doc.numPages < 2)
      throw new Error("This PDF needs at least two pages — a front and a back.")

    async function pageCanvas(pageNumber: number) {
      const page = await doc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      const canvas = document.createElement("canvas")
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas isn't supported in this browser.")
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      return canvas
    }

    return [await pageCanvas(1), await pageCanvas(2)]
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Where a `size`-long image sits within `available` cross-axis space.
function crossAxisOffset(align: Align, available: number, size: number) {
  if (align === "start") return 0
  if (align === "end") return available - size
  return (available - size) / 2
}

// Stacks front and back on a white page, either "vertical" (front above
// back) or "horizontal" (front beside back) — `align` places them across
// the other axis (only visible once the two images aren't the same size).
// Not a print-page-size layout (no A4/Letter here, since nothing calls for it).
function composePage(
  front: HTMLCanvasElement,
  back: HTMLCanvasElement,
  gap: number,
  padding: number,
  layout: Layout,
  align: Align
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas isn't supported in this browser.")

  if (layout === "vertical") {
    const contentWidth = Math.max(front.width, back.width)
    canvas.width = contentWidth + padding * 2
    canvas.height = front.height + gap + back.height + padding * 2
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(
      front,
      padding + crossAxisOffset(align, contentWidth, front.width),
      padding
    )
    ctx.drawImage(
      back,
      padding + crossAxisOffset(align, contentWidth, back.width),
      padding + front.height + gap
    )
  } else {
    const contentHeight = Math.max(front.height, back.height)
    canvas.width = front.width + gap + back.width + padding * 2
    canvas.height = contentHeight + padding * 2
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(
      front,
      padding,
      padding + crossAxisOffset(align, contentHeight, front.height)
    )
    ctx.drawImage(
      back,
      padding + front.width + gap,
      padding + crossAxisOffset(align, contentHeight, back.height)
    )
  }

  return canvas
}

// Scales `content` to fit inside a `pageWidth`x`pageHeight` white page,
// preserving its aspect ratio — used to letterbox the composed front/back
// content onto a fixed A4 canvas. `align` places the content along
// whichever axis this scale-to-fit leaves leftover space on (the same axis
// `align` already controls in `composePage`, since a "vertical" layout's
// tall, narrow content is width-constrained here, leaving leftover height,
// while a "horizontal" layout's wide, short content is height-constrained,
// leaving leftover width) — the other axis stays centered.
function fitCanvasToPage(
  content: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
  layout: Layout,
  align: Align
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = pageWidth
  canvas.height = pageHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas isn't supported in this browser.")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, pageWidth, pageHeight)
  const scale = Math.min(pageWidth / content.width, pageHeight / content.height)
  const drawWidth = content.width * scale
  const drawHeight = content.height * scale
  const x =
    layout === "horizontal"
      ? (pageWidth - drawWidth) / 2
      : crossAxisOffset(align, pageWidth, drawWidth)
  const y =
    layout === "vertical"
      ? (pageHeight - drawHeight) / 2
      : crossAxisOffset(align, pageHeight, drawHeight)
  ctx.drawImage(content, x, y, drawWidth, drawHeight)
  return canvas
}

// The exact canvas that gets previewed and downloaded: front/back stacked
// with `gap`/`padding` for the "Image" format, or that same content
// letterboxed onto a fixed A4-shaped canvas for "PDF" — so a PDF's page
// size never shifts as gap/padding change, only where the content sits
// inside it.
function buildOutputCanvas(
  front: HTMLCanvasElement,
  back: HTMLCanvasElement,
  gap: number,
  padding: number,
  layout: Layout,
  align: Align,
  format: Format
): HTMLCanvasElement {
  const content = composePage(front, back, gap, padding, layout, align)
  if (format === "image") return content
  const [pageWidth, pageHeight] = a4PxForLayout(layout)
  return fitCanvasToPage(content, pageWidth, pageHeight, layout, align)
}

export default function IdCardMergePage() {
  const [front, setFront] = useState<SourceImage | null>(null)
  const [back, setBack] = useState<SourceImage | null>(null)
  const [gap, setGap] = useState(24)
  const [padding, setPadding] = useState(24)
  const [layout, setLayout] = useState<Layout>("vertical")
  const [align, setAlign] = useState<Align>("center")
  const [format, setFormat] = useState<Format>("image")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)

  const ready = !!(front && back)

  function renderDisplay(source: HTMLCanvasElement) {
    const display = displayCanvasRef.current
    if (!display) return
    const ctx = prepareDisplayCanvas(display, source)
    if (!ctx) return
    ctx.drawImage(source, 0, 0)
  }

  // Recompose whenever either image or a layout/format setting changes,
  // instead of gating this behind an explicit action — debounced so
  // dragging a slider doesn't redraw on every tick.
  useDebouncedEffect(() => {
    if (!front || !back) return
    renderDisplay(
      buildOutputCanvas(
        front.canvas,
        back.canvas,
        gap,
        padding,
        layout,
        align,
        format
      )
    )
  }, [front, back, gap, padding, layout, align, format])

  async function handleFiles(fileList: FileList | null | undefined) {
    const files = fileList ? Array.from(fileList) : []
    if (!files.length) return
    setError(null)

    const pdfFile = files.find(isPdfFile)
    if (pdfFile) {
      try {
        const [frontCanvas, backCanvas] = await pdfToFrontBack(pdfFile)
        setFront({
          canvas: frontCanvas,
          previewUrl: frontCanvas.toDataURL(),
          name: pdfFile.name,
          description: "Page 1",
        })
        setBack({
          canvas: backCanvas,
          previewUrl: backCanvas.toDataURL(),
          name: pdfFile.name,
          description: "Page 2",
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't read that PDF.")
      }
      return
    }

    const imageFiles = files.filter(isImageFile)
    if (!imageFiles.length) {
      setError("Drop two images (front and back), or a PDF with two pages.")
      return
    }

    const loaded: SourceImage[] = []
    for (const file of imageFiles) {
      try {
        const canvas = await loadImageAsCanvas(file)
        loaded.push({
          canvas,
          previewUrl: canvas.toDataURL(),
          name: file.name,
          description: formatBytes(file.size),
        })
      } catch {
        // Skip files that fail to decode as images.
      }
    }
    if (!loaded.length) {
      setError("None of the selected files could be loaded as images.")
      return
    }

    // Fills whichever slot(s) are still empty, in order — front first, then
    // back. Extra images beyond that are ignored.
    let nextFront = front
    let nextBack = back
    for (const image of loaded) {
      if (!nextFront) nextFront = image
      else if (!nextBack) nextBack = image
    }
    setFront(nextFront)
    setBack(nextBack)
  }

  function removeSlot(slot: Slot) {
    if (slot === "front") setFront(null)
    else setBack(null)
  }

  function swap() {
    setFront(back)
    setBack(front)
  }

  async function download() {
    if (!front || !back || busy) return
    setBusy(true)
    setError(null)
    try {
      const canvas = buildOutputCanvas(
        front.canvas,
        back.canvas,
        gap,
        padding,
        layout,
        align,
        format
      )
      if (format === "image") {
        await downloadCanvas(canvas, "id-card.png", "image/png")
      } else {
        // `canvas` is already the full A4-shaped page (content letterboxed
        // onto it), so it's drawn full-bleed onto a real-A4-sized PDF page —
        // landscape when the layout is "horizontal", portrait otherwise.
        const pdfDoc = await PDFDocument.create()
        const pageSize = a4PtForLayout(layout)
        const [pageWidth, pageHeight] = pageSize
        await embedCanvasAsPdfPage(pdfDoc, canvas, pageSize, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        })
        const bytes = await pdfDoc.save()
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)
        downloadFile(url, "id-card.pdf")
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while creating the file."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolPage
      page="ID Card Merge"
      icon={IdentityCardIcon}
      segments={{
        value: format,
        onValueChange: (value) => setFormat(value as Format),
        label: "Download as",
        options: [
          { value: "image", label: "Image", icon: Image02Icon },
          { value: "pdf", label: "PDF", icon: Pdf01Icon },
        ],
      }}
      sidebar={
        ready
          ? {
              groups: [
                {
                  label: "Layout",
                  value: layout,
                  onValueChange: (value) => setLayout(value as Layout),
                  options: [
                    {
                      value: "vertical",
                      label: "Vertical",
                      icon: LayoutTwoRowIcon,
                    },
                    {
                      value: "horizontal",
                      label: "Horizontal",
                      icon: LayoutTwoColumnIcon,
                    },
                  ],
                },
                // Cross-axis alignment — horizontal (left/center/right) when
                // stacked vertically, vertical (top/center/bottom) when
                // stacked horizontally, since that's the axis gap/padding
                // don't already control. Only visible once front and back
                // aren't the same size.
                layout === "vertical"
                  ? {
                      label: "Align",
                      value: align,
                      onValueChange: (value) => setAlign(value as Align),
                      options: [
                        {
                          value: "start",
                          label: "Left",
                          icon: AlignHorizontalJustifyStartIcon,
                        },
                        {
                          value: "center",
                          label: "Center",
                          icon: AlignHorizontalJustifyCenterIcon,
                        },
                        {
                          value: "end",
                          label: "Right",
                          icon: AlignHorizontalJustifyEndIcon,
                        },
                      ],
                    }
                  : {
                      label: "Align",
                      value: align,
                      onValueChange: (value) => setAlign(value as Align),
                      options: [
                        {
                          value: "start",
                          label: "Top",
                          icon: AlignVerticalJustifyStartIcon,
                        },
                        {
                          value: "center",
                          label: "Center",
                          icon: AlignVerticalJustifyCenterIcon,
                        },
                        {
                          value: "end",
                          label: "Bottom",
                          icon: AlignVerticalJustifyEndIcon,
                        },
                      ],
                    },
              ],
              slider: [
                {
                  label: "Gap between images",
                  value: gap,
                  onValueChange: setGap,
                  min: 0,
                  max: 120,
                  step: 4,
                  unit: "px",
                },
                {
                  label: "Outer padding",
                  value: padding,
                  onValueChange: setPadding,
                  min: 0,
                  max: 120,
                  step: 4,
                  unit: "px",
                },
              ],
              actions: [
                {
                  label: "Swap front and back",
                  icon: ArrowDataTransferVerticalIcon,
                  onClick: swap,
                  variant: "secondary",
                },
              ],
              download: {
                onDownload: download,
                disabled: busy,
              },
            }
          : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-4">
        {(front || back) && (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {(["front", "back"] as const).map((slot) => {
                const image = slot === "front" ? front : back
                const label = slot === "front" ? "Front" : "Back"
                return (
                  <div key={slot} className="flex flex-1 flex-col gap-2">
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>
                    {image ? (
                      <Attachment className="w-full">
                        <AttachmentMedia variant="image">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.previewUrl} alt="" />
                        </AttachmentMedia>
                        <AttachmentContent>
                          <AttachmentTitle>{image.name}</AttachmentTitle>
                          <AttachmentDescription>
                            {image.description}
                          </AttachmentDescription>
                        </AttachmentContent>
                        <AttachmentActions>
                          <AttachmentAction
                            aria-label={`Remove ${label.toLowerCase()} image`}
                            onClick={() => removeSlot(slot)}
                          >
                            <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
                          </AttachmentAction>
                        </AttachmentActions>
                      </Attachment>
                    ) : (
                      <Dropzone
                        icon={CloudUploadIcon}
                        title={`Drop the ${label.toLowerCase()} image`}
                        description="or, click to browse · or drop a two-page PDF to fill both"
                        accept={ACCEPTED}
                        multiple
                        onFiles={handleFiles}
                        className="flex-1"
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <PreviewCard
              fill
              checkerboard
              title="Combined page"
              layer={
                ready
                  ? {
                      ref: displayCanvasRef,
                      className: "h-full w-full object-contain",
                    }
                  : {
                      kind: "status",
                      message: "Add the other image to see the combined page",
                    }
              }
            />
          </div>
        )}

        {!front && !back && (
          <Dropzone
            icon={CloudUploadIcon}
            title="Drag and drop the front and back images"
            description="or, click to browse · or drop a PDF with two pages · in-browser only"
            accept={ACCEPTED}
            multiple
            onFiles={handleFiles}
          />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </ToolPage>
  )
}
