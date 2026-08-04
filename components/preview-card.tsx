"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ReactNode,
  Ref,
} from "react"

import { MarkdownView } from "@/components/markdown-view"
import { usePreviewChromePx } from "@/components/preview-chrome"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// Checkerboard behind the preview so PNG/WebP transparency (and the effect
// of a background colour) is visible against it.
const CHECKERBOARD =
  "bg-[length:16px_16px] [background-image:repeating-conic-gradient(#00000014_0%_25%,transparent_0%_50%)]"

// Viewport height minus everything else stacked around a preview — the
// `--preview-chrome` custom property is set per-instance below (from
// `ToolPage`'s actual chrome, via `usePreviewChromePx`, plus this card's own
// padding and title row), so this stays a static string Tailwind can turn
// into one real utility class instead of a value baked in at build time.
const VIEWPORT_CHROME_HEIGHT = "100dvh-var(--preview-chrome)"

// Caps every preview at `VIEWPORT_CHROME_HEIGHT` — the non-`fill` layer
// classes and the `fill` viewport both carry it, so height stays budgeted
// here in one place. ToolPage's root is min-h-svh (a floor, not a ceiling),
// so without this cap a `fill` pane whose content drives its height (a
// markdown/textinput surface, an unconstrained canvas) would stretch past
// the viewport instead of scrolling inside it. A page with a taller header
// than `usePreviewChromePx` accounts for (e.g. wrapped toolbar buttons) may
// still need a bigger cap via `className`.
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
// Or a scrollable rendered-markdown pane — sanitized HTML from
// `renderMarkdownToHtml` (`lib/markdown.ts`). Absolutely positioned to fill
// the viewport (it contributes no height of its own), so it's only
// meaningful on a `fill` card whose height is otherwise bounded.
type PreviewMarkdownLayer = {
  kind: "markdown"
  html: string
}
// Or an editable plain-text surface (e.g. Markdown Viewer's editor pane) —
// same fill-only constraint as the markdown layer.
type PreviewTextInputLayer = {
  kind: "textinput"
  value: string
  onChange: (value: string) => void
  placeholder?: string
}
// Or a scrollable list of rows (e.g. a queued-file list, a page-thumbnail
// list) shown next to another preview pane — same fill-only, absolute
// inset-0 + internal-scroll technique as `markdown`/`textinput`, but the
// caller supplies its own rows (typically `Attachment`s) as `children`
// instead of pre-rendered HTML or a controlled value.
type PreviewListLayer = {
  kind: "list"
  children: ReactNode
}

export type PreviewLayer =
  | PreviewCanvasLayer
  | PreviewImageLayer
  | PreviewStatusLayer
  | PreviewMarkdownLayer
  | PreviewTextInputLayer
  | PreviewListLayer
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
  const chromePx = usePreviewChromePx()
  // Card's own p-2 (16) plus, when `title` renders its muted label row above
  // the viewport, that row's own height and the gap-2 beneath it (28) — both
  // are chrome this specific card stacks on top of whatever `ToolPage`
  // already budgeted for the page as a whole.
  const previewChromeStyle = {
    "--preview-chrome": `${chromePx + 16 + (title != null ? 28 : 0)}px`,
  } as CSSProperties

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
      style={previewChromeStyle}
      className={cn(
        "w-full min-w-0 overflow-hidden p-2 ring-0",
        fill && "flex min-h-0 flex-1 flex-col"
      )}
    >
      <div
        ref={viewportRef}
        className={cn(
          "flex w-full min-w-0 items-center justify-center overflow-hidden rounded-md",
          fill && cn("relative flex-1", MAX_HEIGHT, half && HALF_MIN_HEIGHT),
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
              if (entry.kind === "markdown") {
                return (
                  // The plain wrapper carries the absolute positioning —
                  // Radix's ScrollArea root sets an inline
                  // `position: relative` that beats any position utility
                  // passed via className, so positioning the root directly
                  // silently leaves it in flex flow (centered and clipped
                  // by the viewport) instead of filling it.
                  <div key={index} className="absolute inset-0">
                    <ScrollArea className="size-full">
                      <div className="p-2">
                        <MarkdownView html={entry.html} />
                      </div>
                    </ScrollArea>
                  </div>
                )
              }
              if (entry.kind === "textinput") {
                return (
                  <Textarea
                    key={index}
                    value={entry.value}
                    onChange={(e) => entry.onChange(e.target.value)}
                    placeholder={entry.placeholder}
                    variant="flat"
                    spellCheck={false}
                    className="absolute inset-0 field-sizing-fixed resize-none overflow-y-auto rounded-md p-2 font-mono text-xs focus-visible:ring-0"
                  />
                )
              }
              if (entry.kind === "list") {
                return (
                  <div
                    key={index}
                    className="absolute inset-0 flex flex-col gap-2 overflow-y-auto p-3"
                  >
                    {entry.children}
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
