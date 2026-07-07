"use client"

import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// Checkerboard behind the preview so PNG/WebP transparency (and the effect
// of a background colour) is visible against it.
const CHECKERBOARD =
  "bg-[length:16px_16px] [background-image:repeating-conic-gradient(#00000014_0%_25%,transparent_0%_50%)]"

type PreviewCardBaseProps = {
  checkerboard?: boolean
  fill?: boolean
  viewportRef?: Ref<HTMLDivElement>
  className?: string
}

// One canvas to render inside the viewport — a ref plus any extra canvas
// props (event handlers, className, …). Multiple entries stack on top of
// each other (e.g. a base image canvas plus a selection-overlay canvas),
// each positioned/sized identically so they line up.
export type PreviewCanvas = { ref: Ref<HTMLCanvasElement> } & ComponentPropsWithoutRef<"canvas">

// Either render one or more canvases (the common case — Image Blur/Crop/
// Rotate display one, sized and positioned to match `fill`; a tool with a
// separate overlay canvas would pass two), or hand over arbitrary content
// (Image Converter, which swaps between an <img>, a spinner, and an error
// message).
type PreviewCardProps = PreviewCardBaseProps &
  (
    | { canvases: PreviewCanvas[]; children?: never }
    | { canvases?: never; children: ReactNode }
  )

/**
 * Shared preview surface for a tool's main content area: the `Card` plus a
 * centered, rounded viewport that every canvas/image-based tool wraps its
 * preview in (Image Blur, Image Crop, Image Rotate, Image Converter). Pass
 * `fill` for a viewport that grows to the available height (e.g. Image
 * Blur's pan/zoom canvas); omit it for a fixed `max-h-[60vh]` centered
 * preview (Image Crop, Image Rotate). `viewportRef` exposes the inner
 * viewport node, e.g. for wheel/gesture listeners or fit-to-screen math.
 */
export function PreviewCard({
  checkerboard,
  fill,
  viewportRef,
  className,
  canvases,
  children,
}: PreviewCardProps) {
  const stacked = !!canvases && canvases.length > 1

  return (
    <Card className={cn("overflow-hidden p-2", fill && "flex min-h-0 flex-1 flex-col")}>
      <div
        ref={viewportRef}
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-md",
          fill ? "relative min-h-[60vh] w-full flex-1" : "max-h-[60vh]",
          !fill && stacked && "relative",
          checkerboard && CHECKERBOARD,
          className
        )}
      >
        {canvases
          ? canvases.map(({ ref, className: canvasClassName, ...canvasProps }, index) => (
              <canvas
                key={index}
                ref={ref}
                {...canvasProps}
                className={cn(
                  fill
                    ? "absolute top-0 left-0 origin-top-left select-none"
                    : stacked
                      ? "absolute inset-0 m-auto max-h-[60vh] max-w-full select-none"
                      : "block max-h-[60vh] max-w-full select-none",
                  canvasClassName
                )}
              />
            ))
          : children}
      </div>
    </Card>
  )
}
