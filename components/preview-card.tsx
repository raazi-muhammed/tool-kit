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

// Viewport height minus everything else ToolPage's main column can stack
// around a preview, sized for the worst case (the optional header-actions
// row *and* the bottom bar both present) so it only under-fills on pages
// missing one of those rows, never overflows: p-6 top+bottom (48) +
// breadcrumb/header-row at h-8 (32 each) + bottom bar at min-h-11 (44) +
// three gap-4 gaps between them (48) + the Card's own p-2 (16). The file
// strip (`ToolPage`'s `fileStrip` prop) now renders inside that same bottom
// bar rather than stacking as its own row, so it no longer needs a
// separate, taller cap.
const VIEWPORT_CHROME_HEIGHT = "100dvh-220px"

// Caps the non-`fill` preview at `VIEWPORT_CHROME_HEIGHT`. Pages with a
// taller header (e.g. wrapped toolbar buttons) may need a bigger cap via
// `className`.
const MAX_HEIGHT = `max-h-[calc(${VIEWPORT_CHROME_HEIGHT})]`

// Minimum height for a `fill` card that's one of two placed in a
// `grid-cols-1 md:grid-cols-2` pane (e.g. Original/Converted) — see `half`
// below. `md:` and up reuses `VIEWPORT_CHROME_HEIGHT` as-is (the pair sits
// side by side in one row there, so each pane needs the same headroom a
// single preview would); below `md:`, the grid collapses to one column and
// stacks the pair into two rows, so this halves that same budget (minus the
// `gap-4` between them) instead of each pane independently claiming it —
// otherwise the two combined would need 200%+ of the viewport height.
const HALF_MIN_HEIGHT = `min-h-[calc((${VIEWPORT_CHROME_HEIGHT}-16px)/2)] md:min-h-[calc(${VIEWPORT_CHROME_HEIGHT})]`

type PreviewCardBaseProps = {
  /** Muted label rendered above the viewport (e.g. "Original", "Converted") — replaces a hand-rolled `<span>` above the card. */
  title?: ReactNode
  checkerboard?: boolean
  fill?: boolean
  /**
   * Pass when this `fill` card is one of two placed in a `grid-cols-1
   * md:grid-cols-2` pane (e.g. Original/Converted) — see `HALF_MIN_HEIGHT`.
   */
  half?: boolean
  viewportRef?: Ref<HTMLDivElement>
  className?: string
}

// One canvas to render inside the viewport — a ref plus any extra canvas
// props (event handlers, className, …).
type PreviewCanvasLayer = {
  kind?: "canvas"
  ref: Ref<HTMLCanvasElement>
} & ComponentPropsWithoutRef<"canvas">
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

export type PreviewLayer =
  PreviewCanvasLayer | PreviewImageLayer | PreviewStatusLayer
// A layer, or nothing to render this pass — e.g. `activeJob.result && {...}`.
type PreviewLayerInput = PreviewLayer | false | null | undefined

type PreviewCardProps = PreviewCardBaseProps & {
  /**
   * What to render inside the viewport: a single layer (the common case —
   * a canvas, an image, or a status placeholder), or an array of layers
   * that stack on top of each other, positioned/sized identically so they
   * line up (e.g. a base image canvas plus a separate selection-overlay
   * canvas). Either form may be falsy — same convention as `ToolPage`'s
   * `sidebar.actions` — so a tool can inline its own loading/error/idle
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
 * Blur's pan/zoom canvas); omit it for a fixed, viewport-relative `MAX_HEIGHT`
 * centered preview (Image Crop, Image Rotate). `viewportRef` exposes the
 * inner viewport node, e.g. for wheel/gesture listeners or fit-to-screen math.
 */
export function PreviewCard({
  title,
  checkerboard,
  fill,
  half,
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
          ? cn("absolute inset-0 m-auto max-w-full select-none", MAX_HEIGHT)
          : cn("block max-w-full select-none", MAX_HEIGHT),
      override
    )
  }

  const card = (
    <Card
      className={cn(
        "w-full min-w-0 overflow-hidden p-2 ring-0",
        fill && "flex min-h-0 flex-1 flex-col"
      )}
    >
      <div
        ref={viewportRef}
        className={cn(
          "flex w-full min-w-0 items-center justify-center overflow-hidden rounded-md",
          fill &&
            cn("relative flex-1", half ? HALF_MIN_HEIGHT : "min-h-[60vh]"),
          !fill && MAX_HEIGHT,
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
                      entry.tone === "destructive"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {entry.icon && (
                      <HugeiconsIcon
                        icon={entry.icon}
                        className={cn("size-8", entry.spin && "animate-spin")}
                        aria-hidden
                      />
                    )}
                    {entry.message && (
                      <p className="text-sm">{entry.message}</p>
                    )}
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
    <div
      className={cn("flex min-h-0 min-w-0 flex-col gap-2", fill && "flex-1")}
    >
      <span className="text-sm text-muted-foreground">{title}</span>
      {card}
    </div>
  )
}
