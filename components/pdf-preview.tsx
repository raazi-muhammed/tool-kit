"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

import { loadPdfjs } from "@/lib/pdf"

// react-pdf wraps pdfjs-dist in browser-only canvas rendering, so both are
// loaded client-side only (`ssr: false`) — a top-level import crashes Next's
// server-side prerendering the same way a bare pdfjs-dist import would.
const PdfDocument = dynamic(
  async () => {
    await loadPdfjs()
    return (await import("react-pdf")).Document
  },
  { ssr: false }
)
const PdfPage = dynamic(() => import("react-pdf").then((mod) => mod.Page), {
  ssr: false,
})

/**
 * Scrollable stack of a PDF's pages, rendered from a blob URL — key this by
 * that URL where it's mounted so switching files remounts with fresh state
 * instead of carrying over the previous file's page count.
 */
export function PdfPreview({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  // Pages render at this pixel width (react-pdf scales the PDF to fit) so
  // wide pages shrink to the panel instead of overflowing it horizontally.
  const [pageWidth, setPageWidth] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setPageWidth(entry.contentRect.width)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex max-h-[calc(100dvh-220px)] w-full flex-col items-center gap-4 overflow-y-auto p-4"
    >
      <PdfDocument
        file={url}
        onLoadSuccess={({ numPages }: { numPages: number }) =>
          setNumPages(numPages)
        }
      >
        {Array.from({ length: numPages }, (_, index) => (
          <PdfPage
            key={index}
            pageNumber={index + 1}
            width={pageWidth || undefined}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-md"
          />
        ))}
      </PdfDocument>
    </div>
  )
}
