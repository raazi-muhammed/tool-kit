"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// Checkerboard behind the preview so PNG/WebP transparency (and the effect
// of a background colour) is visible against it.
const CHECKERBOARD =
  "bg-[length:16px_16px] [background-image:repeating-conic-gradient(#00000014_0%_25%,transparent_0%_50%)]"

type PreviewCardBaseProps = {
  /** Muted label rendered above the viewport (e.g. "Original", "Converted") — replaces a hand-rolled `<span>` above the card. */
  title?: ReactNode
  checkerboard?: boolean
  fill?: boolean
  viewportRef?: Ref<HTMLDivElement>
  className?: string
}

// One canvas to render inside the viewport — a ref plus any extra canvas
// props (event handlers, className, …).
type PreviewCanvasLayer = { kind?: "canvas"; ref: Ref<HTMLCanvasElement> } & ComponentPropsWithoutRef<"canvas">
// Or a plain <img> layer, e.g. a converted result that's already a decoded
// blob URL and doesn't need a canvas draw at all.
type PreviewImageLayer = { kind: "image" } & ComponentPropsWithoutRef<"img">
// Or a centered icon/message — a loading spinner, an error, or an idle
// placeholder — expressed as data instead of hand-rolled JSX.
type PreviewStatusLayer = {
  kind: "status"
  icon?: IconSvgElement
  spin?: boolean
  tone?: "muted" | "destructive"
  message?: ReactNode
}

export type PreviewLayer = PreviewCanvasLayer | PreviewImageLayer | PreviewStatusLayer
// A layer, or nothing to render this pass — e.g. `activeJob.result && {...}`.
type PreviewLayerInput = PreviewLayer | false | null | undefined

type PreviewCardProps = PreviewCardBaseProps & {
  /**
   * What to render inside the viewport: a single layer (the common case —
   * a canvas, an image, or a status placeholder), or an array of layers
   * that stack on top of each other, positioned/sized identically so they
   * line up (e.g. a base image canvas plus a separate selection-overlay
   * canvas). Either form may be falsy — same convention as `ToolPage`'s
   * `footer.actions` — so a tool can inline its own loading/error/idle
   * state as `condition ? {...} : {...}` right alongside the real layer
   * instead of reaching for `children`.
   */
  layer?: PreviewLayerInput | PreviewLayerInput[]
  /** Shown instead, once `layer` has no truthy layers left after filtering — e.g. a spinner, an error message, or an empty-state placeholder. */
  children?: ReactNode
}

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
  title,
  checkerboard,
  fill,
  viewportRef,
  className,
  layer,
  children,
}: PreviewCardProps) {
  const layers = (Array.isArray(layer) ? layer : [layer]).filter(
    (entry): entry is PreviewLayer => !!entry
  )
  const stacked = layers.length > 1

  function layerClassName(override?: string) {
    return cn(
      fill
        ? "absolute top-0 left-0 origin-top-left select-none"
        : stacked
          ? "absolute inset-0 m-auto max-h-[60vh] max-w-full select-none"
          : "block max-h-[60vh] max-w-full select-none",
      override
    )
  }

  const card = (
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
        {layers.length > 0
          ? layers.map((entry, index) => {
              if (entry.kind === "status") {
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex flex-col items-center gap-2 px-6 text-center",
                      entry.tone === "destructive" ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {entry.icon && (
                      <HugeiconsIcon
                        icon={entry.icon}
                        className={cn("size-8", entry.spin && "animate-spin")}
                        aria-hidden
                      />
                    )}
                    {entry.message && <p className="text-sm">{entry.message}</p>}
                  </div>
                )
              }
              if (entry.kind === "image") {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { kind, className: imgClassName, ...imgProps } = entry
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={index}
                    alt=""
                    {...imgProps}
                    className={layerClassName(imgClassName)}
                  />
                )
              }
              const { ref, className: canvasClassName, ...canvasProps } = entry
              return (
                <canvas
                  key={index}
                  ref={ref}
                  {...canvasProps}
                  className={layerClassName(canvasClassName)}
                />
              )
            })
          : children}
      </div>
    </Card>
  )

  if (title == null) return card

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", fill && "flex-1")}>
      <span className="text-sm text-muted-foreground">{title}</span>
      {card}
    </div>
  )
}
