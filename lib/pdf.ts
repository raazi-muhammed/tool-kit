import type { PDFDocument } from "@cantoo/pdf-lib"

import { canvasToPngBytes } from "@/lib/canvas"

/** Broader than a bare MIME check — some browsers don't report `application/pdf`
 *  for a locally-picked file, so an extension check backs it up. */
export function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  )
}

// react-pdf wraps pdfjs-dist in browser-only canvas rendering, so it's loaded
// client-side only, memoized after the first call.
let pdfjsPromise: Promise<(typeof import("react-pdf"))["pdfjs"]> | null = null

/** Lazily load pdfjs-dist (via react-pdf) and point it at the worker copied
 *  into `public/` by the postinstall script, exactly once. */
export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("react-pdf").then((mod) => {
      mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      return mod.pdfjs
    })
  }
  return pdfjsPromise
}

/** A4 in PDF points (72 pt/in), portrait orientation. */
export const A4_PT: [number, number] = [595.28, 841.89]

/**
 * Add a `[pageWidth, pageHeight]`-sized page to `pdfDoc` with `canvas`
 * rasterized as a PNG and drawn into it at `draw` — the addPage/encode/embed
 * sequence every PDF-from-canvas tool needs, leaving where the image actually
 * sits on the page (full-bleed, centered, margined, ...) up to the caller.
 */
export async function embedCanvasAsPdfPage(
  pdfDoc: PDFDocument,
  canvas: HTMLCanvasElement,
  [pageWidth, pageHeight]: [number, number],
  draw: { x: number; y: number; width: number; height: number }
) {
  const page = pdfDoc.addPage([pageWidth, pageHeight])
  const pngBytes = await canvasToPngBytes(canvas)
  const image = await pdfDoc.embedPng(pngBytes)
  page.drawImage(image, draw)
  return page
}
