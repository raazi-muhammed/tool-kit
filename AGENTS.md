<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Tool page conventions

Each tool lives under `app/<tool-name>/page.tsx`. Every tool page is wrapped in
the shared `ToolPage` component instead of hand-rolling the breadcrumb, the
right-hand settings sidebar, and the Copy/Load sample/Clear button row — those
are common to every tool, so they live in the wrapper, not in each page:

```tsx
import { ToolPage } from "@/components/tool-page"

<ToolPage
  page="Inline Calculator"
  icon={Calculator01Icon}
  onCopy={copy}
  onLoadSample={loadSample}
  onClear={clear}
  actions={/* tool-specific buttons, e.g. Format/Minify, rendered left of Copy */}
>
  {/* tool content */}
</ToolPage>
```

`ToolPage` renders a two-region layout: a main column (breadcrumb, `children`,
and a bottom bar for the file strip/Add file), and — only once there's
something to put in it — a fixed-width right sidebar for settings, stacked
top to bottom, with the primary action button(s) and Download pinned to its
bottom edge. See `components/tool-page.tsx` and `components/page-breadcrumb.tsx`.

For a mutually-exclusive mode toggle (e.g. an output-format switch), pass the
`segments` prop instead of hand-rolling a button group — the wrapper renders it
as a shadcn `Tabs` segmented control. `segments` takes an optional `label`
(shown as a heading above the control once it's in the sidebar, e.g. "Blur
Type", "Format") and an optional `placement`:

- `"sidebar"` (the default) — for a setting that configures a transform (blur
  type, aspect ratio, output format). Renders in the settings sidebar as an
  evenly-split `Tabs` segmented control once there are 3 or fewer options; a
  crowded row (image-crop's 6-option aspect picker) renders as a plain
  `Select` dropdown instead — wrapping a segmented control onto more than one
  line still looks broken inside its pill-shaped track, so don't try to make
  `TabsList` wrap for this case.
- `"inline"` — for a *view* switch that changes what `children` renders (e.g.
  JSON Parser's Text/Viewer tabs). Renders inline above `children`, right next
  to the content it swaps, exactly like today — don't move a view switch 320px
  away from what it controls just for consistency with the settings case.

```tsx
<ToolPage
  page="Video to Audio"
  icon={AudioWave01Icon}
  segments={{
    value: format,
    onValueChange: (value) => changeFormat(value as Format),
    disabled: busy,
    label: "Format",
    options: [
      { value: "mp3", label: "MP3", icon: MusicNote01Icon },
      { value: "wav", label: "WAV", icon: AudioWave01Icon },
    ],
  }}
  onCopy={copy}
  onLoadSample={loadSample}
  onClear={clear}
>
```

For an output-format picker specifically (MP3/WAV, PNG/JPEG/WebP/BMP, etc.),
use `segments` as shown above — don't hand-roll it as a `Select` placed next to
the dropzone. See `app/video-to-audio/page.tsx` and `app/image-converter/page.tsx`.

For a tool's settings — zoom controls, a strength/setting slider, the primary
action button(s), and the Download button — pass the `sidebar` prop instead of
hand-rolling them inside `children`. All of `sidebar` renders in the settings
sidebar, `zoom` included. Like `segments`, `sidebar` takes a config
object, not JSX, so `ToolPage` renders the controls (and their icons) itself:

```tsx
<ToolPage
  page="Image Blur"
  icon={BlurIcon}
  fileStrip={jobs.length > 1 && (
    <JobStrip jobs={jobs} activeId={activeId} onSelect={setActiveId} onRemove={removeJob} />
  )}
  sidebar={
    activeJob && {
      zoom: { percent: zoomPct, onZoomOut, onZoomIn, onFit },
      slider: { label: "Amount", value: blur, onValueChange: onBlurChange, min: 1, max: 50, unit: "px" },
      actions: [
        pendingRect && { label: "Cancel selection", icon: Cancel01Icon, onClick: clearSelection, variant: "ghost", emphasis: "secondary" },
        { label: "Apply blur", icon: BlurIcon, onClick: applyBlur, disabled: !pendingRect },
      ],
      download: { onDownload: download, disabled: !activeJob.hasEdits, onDownloadAll: downloadAll },
    }
  }
>
```

`zoom` and `slider` are each optional single-instance blocks (`slider`'s
optional `unit`, e.g. `"px"`, is shown next to its live value); `actions` is an
array (falsy entries are filtered, so conditional buttons — like "Cancel
selection" only while a selection is pending — are just `condition && {...}`);
`download` renders the Download button and, only when `onDownloadAll` is set,
its "Download all" dropdown. See `app/image-blur/page.tsx`.

Every `SidebarAction` also takes an optional `emphasis`: `"primary"` (the
default) renders full-width, stacked in the sidebar's pinned bottom block
alongside Download — reserve this for the tool's actual call(s) to action
(Crop, Scan, Resize, Apply blur, Convert, Unlock, …). `emphasis: "secondary"`
renders smaller, at natural width, in a row above that stack — use it for a
momentary/conditional helper (Cancel selection, Delete rectangle, Clear all,
Auto detect) or a toggle-styled button (Image Resize's aspect-ratio lock).
Set `emphasis` explicitly per action rather than inferring it from `variant` —
a toggle's `variant` itself flips between `"secondary"`/`"outline"` depending
on its pressed state, so inferring tier from `variant` would make the button
jump between the two positions as state changes.

For a primary action that also has a "do this to every job" variant (e.g.
Image Blur's "Apply blur" / "Apply blur to all", Image Crop's "Crop" / "Crop
all"), give that `SidebarAction` a `more: { label, icon, onClick, disabled? }`
instead of adding a second button — `ToolPage` renders it as the same
Download-style `ButtonGroup` + dropdown chevron, stretched full-width, only
once `more` is set (so gate it on the same `jobs.length > 1` check as
`onDownloadAll`):

```tsx
actions: [
  {
    label: "Crop",
    icon: CropIcon,
    onClick: applyCrop,
    disabled: !pendingRect,
    more: jobs.length > 1 ? { label: "Crop all", icon: CropIcon, onClick: applyCropToAll, disabled: !pendingRect } : undefined,
  },
],
```

See `app/image-crop/page.tsx`, `app/image-trim/page.tsx`, and
`app/image-rotate/page.tsx` (which gives each of "Rotate left"/"Rotate right"
its own `more`).

A top-level `actions` entry can also be a `SidebarActionGroup` —
`{ label?, actions, placement? }` — which renders its `actions` together in a
single row, evenly split via `flex-1`, instead of each stacking full-width,
with `label` rendered above the row as a muted `SidebarLabel` (omit `label`
for an unlabeled row). `placement: "bottom"` (the default) keeps the group in
the pinned bottom action stack alongside Download; `placement: "top"` renders
it in the sidebar's scrollable section instead, alongside `zoom`/`slider` —
use this for standalone transform controls with no single commit step (e.g.
Image Rotate's rotate buttons), as opposed to a tool's actual call to action,
which still belongs in the bottom stack. Use a group for a pair of related
actions that should sit side by side (e.g. Image Rotate's per-image "Rotate
left" / "Rotate right" row above its all-images "Rotate all left" / "Rotate
all right" row):

```tsx
actions: [
  jobs.length > 1
    ? {
        label: "All images",
        placement: "top",
        actions: [
          { label: "Rotate all left", icon: RotateCcwSquareIcon, onClick: () => rotateAll(-90), variant: "secondary" },
          { label: "Rotate all right", icon: RotateCwSquareIcon, onClick: () => rotateAll(90), variant: "secondary" },
        ],
      }
    : undefined,
  {
    label: "This image",
    placement: "top",
    actions: [
      { label: "Rotate left", icon: RotateCcwSquareIcon, onClick: () => rotate(-90) },
      { label: "Rotate right", icon: RotateCwSquareIcon, onClick: () => rotate(90) },
    ],
  },
],
```

Each action inside the group can still carry its own `more` — it renders as
its own `ButtonGroup` sized to its share of the row rather than full-width.
See `app/image-rotate/page.tsx`.

The sidebar prop also has config primitives for a few other recurring controls —
still config objects, never JSX, so `ToolPage` renders them itself, all in the
sidebar:

- `color` — a settable/clearable color swatch (e.g. a background fill for
  transparent PNGs): `{ label, value, onChange, fallback, nullLabel?,
  clearLabel?, clearIcon? }`. `value: null` shows `nullLabel` as muted text
  instead of the clear button. `ColorPicker` itself (`components/color-picker.tsx`)
  always offers both a "Pick from screen" native `EyeDropper` button (where
  the browser supports it — Chrome/Edge) and a "Pick from image" fallback
  that works everywhere (including Safari/Firefox): it consumes the next
  click anywhere on the page and samples whatever canvas/image is under the
  cursor via `sampleColorAtPoint` (`lib/canvas.ts`). Both are unconditional —
  no per-tool wiring, callback, or prop is needed or should be added; don't
  reintroduce a page-owned "pick mode" (state, an `onClick` on the preview
  canvas, a cursor override) to support this. See `app/image-converter/page.tsx`
  and `app/image-crop/page.tsx`.
- `toggle` — a pressable button (e.g. "Remove background") that reveals its
  own nested `color` and/or `slider` only while pressed: `{ label, icon,
  pressed, onPressedChange, color?, slider? }`. See
  `app/image-converter/page.tsx`.
- `inputs` — an array of labeled text/number/password fields rendered
  label-above-input (e.g. resize width/height, a PDF password): `{ label,
  value, onChange, type?, min?, disabled?, className?, onEnter? }[]`. Always
  give each a real label — it's stacked alone in the sidebar column, not
  side-by-side with a neighboring field, so a blank label (fine in a horizontal
  row) reads as broken here. See `app/image-resize/page.tsx` and
  `app/pdf-unlock/page.tsx`.
- `hint` — muted contextual text shown in the sidebar instead of a separate
  paragraph below the preview (e.g. "No transparent margin to trim."): just a
  `ReactNode`. See `app/image-trim/page.tsx`.

Render order in the sidebar is `segments`, `color`, `toggle`, `inputs`,
`slider`, `hint`, then the pinned-bottom `actions`/`download` block. Don't add
a new primitive for a one-off control — reuse `actions` (e.g. an icon+label
toggle button computed from page state, like Image Resize's aspect-ratio
lock, marked `emphasis: "secondary"`) unless the control is genuinely reusable
across tools.

For a tool that queues files (crop, blur, …), pass the same `<JobStrip .../>`
element you'd have rendered inline above `PreviewCard` via `ToolPage`'s
`fileStrip` prop instead — `ToolPage` renders it in the main column's bottom
bar, next to the "Add file" button, rather than stacking it as its own row
above the preview.

## Live vs explicit apply

When a tool's output is a pure function of its settings — applied uniformly
to every queued job, with no interactive per-job step to commit (unlike a
drawn crop/blur selection) — default to regenerating automatically instead
of gating it behind an action button. Rerun the transform in a `useEffect`
keyed on the relevant settings state (plus `jobs.length`, so newly added
files regenerate too), debounced so dragging a color picker or typing a
number doesn't redraw on every keystroke:

```tsx
useEffect(() => {
  if (jobs.length === 0) return
  const timeout = setTimeout(() => {
    jobs.forEach((job) => regenerate(job, settings))
  }, 300)
  return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [settingA, settingB, jobs.length])
```

`sidebar.actions` simply isn't set in this case — the sidebar prop is just
`color`/`inputs`/`slider` (the settings) plus `download`. Derive any
validation message (e.g. "Enter a size of at least 1 pixel") straight from
the settings state in the render body instead of `useState` + effect —
`eslint-plugin-react-hooks` flags a synchronous `setState` inside an effect
body. See `app/image-converter/page.tsx` (format/quality/background) and
`app/square-image-generator/page.tsx` (size/background).

## Copy

Never use the `→` arrow character in tool names, page copy, or code comments
(e.g. write "Video to Audio", not "Video → Audio"). Use "to" in prose, or
`->` in code comments where an arrow is genuinely useful (e.g. describing a
before/after transform).

## Preview surface

For a tool's main content area — the bordered, centered box that shows the
picked file (a canvas, an `<img>`, or a status placeholder) — use the shared
`PreviewCard` component (`components/preview-card.tsx`) instead of
hand-rolling a `Card` plus a centering/checkerboard wrapper div:

```tsx
import { PreviewCard } from "@/components/preview-card"

<PreviewCard
  fill
  checkerboard
  title="Converted"
  layer={
    activeJob.result
      // An image layer (`kind: "image"`) — e.g. a converted result that's
      // already a decoded blob URL and doesn't need a canvas draw at all.
      ? { kind: "image", src: activeJob.result.url, alt: activeJob.result.name }
      // Or a status layer (`kind: "status"`) — a centered icon/message for
      // the loading/error/idle states, so the whole preview (picked file
      // *and* its fallback) is one data-driven `layer` with no JSX children
      // at all.
      : activeJob.status === "converting"
        ? { kind: "status", icon: Loading03Icon, spin: true }
        : { kind: "status", message: "Pick a format and hit Convert" }
  }
/>
```

`layer` takes a single layer object (the common case) or an array of layers
that stack on top of each other, positioned/sized identically so they line
up (e.g. a base image canvas plus a separate selection-overlay canvas). It
filters falsy values — same convention as `ToolPage`'s `sidebar.actions` —
so inline a layer's own readiness check (`condition ? {...} : {...}`)
instead of reaching for `children`. `children` still exists as an escape
hatch for content none of `canvas`/`image`/`status` fits — it's shown only
once `layer` resolves to no truthy layers. See Image Converter: its
Original pane is a canvas layer (so its color-picker click can sample
pixels) with a status layer for the invalid-file case, and its Converted
pane switches between an image layer and a status layer for
converting/error/idle — no `children` on either.

Pass `fill` (the default choice for a new tool) for a viewport that grows to
the available height — every current preview tool (Image Crop, Image Rotate,
Image Resize, Image Round Corners, Square Image Generator, Image Trim, Image
Blur, Image Converter, …) uses it now, paired with `className: "h-full w-full
object-contain"` on the layer (see below) so the preview fills the column
instead of shrinking to the picked file's intrinsic size and leaving a big gap
underneath. Only reach for `PreviewCard`'s own fixed, viewport-relative
`MAX_HEIGHT` constant (`max-h-[calc(100dvh-220px)]`, omitting `fill`) if a
tool genuinely can't make `fill` work — derived from, and documented alongside,
the worst-case fixed chrome ToolPage's main column can stack around it
(padding, breadcrumb/header-action row, the bottom bar, gaps, the Card's own
padding). A page with a taller header than that (e.g. a wrapped toolbar) can
raise the cap via `className` instead.
A `JobStrip` no longer stacks as its own row above the preview — it renders in
the bottom bar via `ToolPage`'s `fileStrip` prop instead — so there's no
separate cap to opt into for it.
Note that `fill` only avoids overflowing the viewport where there's JS logic
actively constraining the rendered size to the available space (Image Blur's
fit-to-screen zoom math; Image Converter's panes are typically small enough
in practice) — without that, a `fill` layer's CSS-only `max-h-full` can't
reliably bound a large canvas, since intermediate flex containers don't
uniformly force a definite height, so the canvas renders at its native pixel
size and pushes the page past the viewport. Pass `checkerboard` so PNG/WebP
transparency (and the effect of a background colour) is visible against it.

**This exact mistake has recurred repeatedly: a `fill` canvas/image layer
whose intrinsic pixel size doesn't match its container gets built without
anything to scale its content down, so it renders at native pixel size and
the checkerboard viewport (`overflow-hidden`) clips it to a zoomed-in corner
instead of showing the whole thing shrunk to fit.** This bites hardest when
the output size is user-controlled (a typed resize/convert target width and
height) rather than just whatever the source file happened to be.

Passing `max-h-full max-w-full` on the layer's `className` (what Image
Converter does) is **not** a reliable fix — it depends on the `fill`
container having already resolved to a definite height, which intermediate
flex containers don't uniformly guarantee, so it only "works" there because
those images are typically modest in practice. The robust fix is to make the
layer's CSS box actually fill the container and let `object-fit` do the
scaling: `className: "h-full w-full object-contain"` on the layer (works
for both a canvas `ref` layer and an `image` layer — `object-fit` applies to
both as replaced elements). `h-full`/`w-full` resolve against the `fill`
container's own explicit sizing (`min-h-[60vh] flex-1`, a definite box on its
own terms) rather than depending on percentage-height resolution through
intermediate wrappers, and `object-contain` scales the content to fit inside
that box without cropping, preserving aspect ratio. See `app/svg-to-png/page.tsx`.
This is safe for pointer math against the canvas too (Image Crop's drag-select,
Image Scan's quad corners) — `canvasPointFromEvent`/`canvasDisplayScale`
(`lib/canvas.ts`) map an event's client coordinates through the canvas's
actual rendered content rect, not just its CSS box, so they stay correct even
when `object-contain` letterboxes the canvas inside a box whose aspect ratio
doesn't match the image's. Reach for real fit-to-screen JS (Image Blur's,
Image Scan's zoom/pan) instead only when the tool needs actual pixel-precise
*display* control beyond fit-to-box scaling (zooming in past 100%, panning) —
a plain preview pane, even an interactive one, doesn't.
`viewportRef` exposes the inner viewport node for wheel/gesture listeners or
fit-to-screen math (see Image Blur's zoom/pan).
Pass `title` for a muted label above the box (e.g. "Original", "Converted")
instead of hand-rolling a `<span>` above the `PreviewCard` — it accepts any
`ReactNode`, so a dynamic hint (Image Converter's color-picker prompt) works
too.

For tools that let the user select a rectangular region on a canvas (crop,
blur), use the shared `useRectSelection` hook (`hooks/use-rect-selection.ts`)
instead of hand-rolling pointer handlers. It implements the full interaction:
drag to draw, drag inside the selection to move it, drag its edges/corners to
resize, clamped to the canvas, optionally locked to an aspect ratio, with
hover cursors and a min-size discard for accidental clicks:

```tsx
const { pendingRect, clearSelection, selectionHandlers } = useRectSelection({
  canvasRef: displayCanvasRef,
  ratio: 16 / 9, // optional locked aspect (width / height); omit for free-form
  render: (rect) => renderDisplay(rect), // repaint with the selection (null = none)
})

<PreviewCard fill layer={{ ref: displayCanvasRef, ...selectionHandlers, className: "h-full w-full cursor-crosshair touch-none object-contain" }} />
```

The hook owns the selection state: read `pendingRect` to enable Apply-style
buttons, and call `clearSelection()` after committing an edit (it repaints
clean via `render(null)`). Inside `render`, draw the tool's own preview first,
then finish with `drawSelectionRect(canvas, rect)` from `lib/canvas.ts` for
the standard dashed border + grab handles. The underlying rect geometry
(`rectFromPoints`, `rectFromPointsWithRatio`, `clampRect`, `hitEdges`,
`resizeRect`, `pointInRect`) also lives in `lib/canvas.ts` — extend it there,
not in a page. See `app/image-crop/page.tsx` and `app/image-blur/page.tsx`.

Don't add a muted caption paragraph below the preview restating the file name,
size, or dimensions — the preview already shows the file, so that text is
redundant. This applies to any tool that renders a live preview of the picked
file (canvas, `<img>`, etc.), not just canvas-selection tools.

## Command menu (⌘K search)

The app has a global Cmd+K / Ctrl+K search for jumping between tools, built on
the shadcn **Command** component (`components/ui/command.tsx`, added via
`npx shadcn@latest add command` — this also pulled in `dialog.tsx` and
`input-group.tsx`). The tool list it searches is the single source of truth
in `lib/tools.ts` (`TOOLS: Tool[]`) — the homepage grid in `app/page.tsx`
reads from the same array, so a new tool only needs to be added there once.

`components/command-menu.tsx` exports a `CommandMenuProvider` (mounted once
in `app/layout.tsx`, wrapping `children`, so the global ⌘K/Ctrl+K shortcut
works everywhere regardless of whether the trigger button is visible on the
current page) that owns the open state, binds the global keydown listener,
and renders the `CommandDialog`, plus a `CommandMenuTrigger` button that opens
it on click. It takes an optional `className` (merged in after its own
`justify-between`, so widening it — e.g. the homepage's `w-72` — still keeps
"Search" and the `⌘K` hint pinned to opposite edges instead of clumping
together in the middle):

```tsx
import { CommandMenuTrigger } from "@/components/command-menu"

<CommandMenuTrigger className="w-72" />
```

`app/page.tsx` (the homepage) renders the full `CommandMenuTrigger` bar (icon
+ "Search" label + `⌘K` hint). `PageBreadcrumb` (used by every tool page via
`ToolPage`) renders the icon-only `CommandMenuIconTrigger` instead, next to
the settings `ModeToggle` — same shared `CommandMenuProvider`/dialog, just a
smaller trigger since a tool page's header has no room for the full bar. When
adding a new tool, add it to `TOOLS` in `lib/tools.ts` (not inline in
`app/page.tsx`) so it shows up in both the grid and the command menu.

## Button styling

`components/ui/button.tsx` gives the `default` and `secondary` variants a
tactile look: a faint white gradient overlay (`bg-linear-to-b from-white/8
to-transparent` / `from-white/5`), an inset ring highlight, `shadow-sm`, and
brightness-based hover/active feedback instead of a flat opacity fade. Keep
that contrast subtle — this has already been tuned down once after looking
too glossy — and don't set a background/gradient class on individual `Button`
usages; adjust the shared variants instead so every button stays consistent.
`outline` just gets a faint `shadow-xs`; `ghost`, `destructive`, and `link`
stay flat on purpose.

## Icons

This project uses **Hugeicons**, not lucide-react. Never import from `lucide-react`.

```tsx
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { BracesIcon } from "@hugeicons/core-free-icons"

<HugeiconsIcon icon={BracesIcon} className="size-4" aria-hidden />
```

An icon is data (`IconSvgElement`), not a component — pass it via the `icon` prop
rather than rendering it directly (no `<BracesIcon />`). Component props (e.g.
`PageBreadcrumb`'s `icon`) should be typed `IconSvgElement`, and rendered with
`<HugeiconsIcon icon={icon} ... />`, not treated as a component to instantiate.

`components.json` sets `"iconLibrary": "hugeicons"` so shadcn-generated components
pull icons from the same set — don't change it back to `lucide`.

Every `Button` gets a leading icon — don't ship a text-only action button.
`Button`'s own styles auto-size an unclassed `<svg>` child (`size-4` at the
default size), so just drop the icon in without a `className`:

```tsx
<Button onClick={format}>
  <HugeiconsIcon icon={TextIndentIcon} aria-hidden />
  Format
</Button>
```

Use the default `size` for every `Button` — don't pass `size="sm"`/`"xs"`. The
default size carries the gradient/shadow treatment (see "Button styling"
below) at a scale that reads well everywhere in the app, from the ToolPage
Copy/Load sample/Clear row down to icon-only toolbar buttons (e.g. the zoom
controls in `app/image-blur/page.tsx`). The smaller sizes still exist for
places that aren't a `Button` at all — e.g. `TabsTrigger` sizing — but don't
reach for them on a `Button`.

## Tooltips

For an icon-only control whose purpose isn't spelled out in visible text (the
zoom in/out/fit buttons in a `sidebar.zoom`), wrap it in the shared
`IconTooltip` component (`components/icon-tooltip.tsx`) instead of reaching
for the shadcn `Tooltip`/`TooltipTrigger`/`TooltipContent` trio directly:

```tsx
import { IconTooltip } from "@/components/icon-tooltip"

<IconTooltip label="Zoom in">
  <Button variant="ghost" onClick={onZoomIn} aria-label="Zoom in">
    <HugeiconsIcon icon={ZoomInAreaIcon} aria-hidden />
  </Button>
</IconTooltip>
```

`TooltipProvider` is mounted once in `app/layout.tsx` wrapping the whole app
— don't add another one on individual pages. `TooltipContent`
(`components/ui/tooltip.tsx`) is pinned to a fixed dark background
(`bg-neutral-900`/`text-neutral-50`) rather than the theme-following
`bg-foreground`/`text-background`, so the tooltip doesn't flip to a light
bubble in dark mode. See `components/tool-page.tsx`.

## File attachments

To display a picked file, an in-progress job, an error, or a produced output,
use the shadcn **Attachment** component (`components/ui/attachment.tsx`, added via
`npx shadcn@latest add attachment`) instead of hand-rolling a row/card. Drive its
appearance with the `state` prop (`"idle" | "uploading" | "processing" | "error"
| "done"`) — e.g. `state="processing"` shimmers the title, `state="error"` turns
it destructive. Compose it from `AttachmentMedia` (icon/thumbnail),
`AttachmentContent` (`AttachmentTitle` + `AttachmentDescription`), and
`AttachmentActions` (`AttachmentAction` buttons):

```tsx
<Attachment state="done" className="w-full">
  <AttachmentMedia>
    <HugeiconsIcon icon={MusicNote01Icon} aria-hidden />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>clip.wav</AttachmentTitle>
    <AttachmentDescription>WAV · 172 KB</AttachmentDescription>
  </AttachmentContent>
  <AttachmentActions>
    <AttachmentAction aria-label="Remove clip.wav">
      <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
    </AttachmentAction>
  </AttachmentActions>
</Attachment>
```

shadcn ships **no** dropzone/file-drop component — only `attachment`. Don't
hand-roll the hidden `<input type="file">` plus `onDragOver`/`onDrop`/click
handlers on a page; use the shared `Dropzone` component
(`components/dropzone.tsx`) instead, which wraps `Attachment` with
`orientation="dropzone"`:

```tsx
import { Dropzone } from "@/components/dropzone"

<Dropzone
  icon={CloudUploadIcon}
  title="Drag and drop an image to upload"
  description="or, click to browse · resize to any resolution · in-browser only"
  accept="image/*"
  onFiles={(files) => addFile(files?.[0])} // FileList from either a pick or a drop
/>
```

Pass `multiple` for tools that queue several files at once (`onFiles` still
receives the raw `FileList`; use `Array.from(fileList)` to iterate — see
`app/image-converter/page.tsx`).

For tools that keep the dropzone around after a file's been picked so the
header's "Add file" button can still open the same picker, don't unmount
`Dropzone` — its hidden `<input>` needs to stay mounted for the ref to work.
Instead render it unconditionally and pass `hidden` to hide just the card, and
reach it via a `DropzoneHandle` ref. Wire the button itself through
`ToolPage`'s `onAddFile` prop — pass the `dropzoneRef` itself (not a closure)
— rather than hand-rolling it in `actions`. Every tool page that keeps a
dropzone around does this identically, so `ToolPage` renders "Add file" as a
ButtonGroup + dropdown itself once `onAddFile` is set, calling `.open()`/
`.paste()` directly on the ref — the dropdown's "Paste from clipboard" option
comes for free, with no extra prop to wire per page:

```tsx
const dropzoneRef = useRef<DropzoneHandle>(null)

<ToolPage
  onAddFile={file ? dropzoneRef : undefined}
  ...
>
  <Dropzone ref={dropzoneRef} hidden={!!file} ... />
```

Reserve `actions` for buttons that aren't this pattern (e.g. the JSON Parser's
Format/Minify buttons). See `app/image-resize/page.tsx` and
`app/video-to-audio/page.tsx`.

## Overriding component default styles

A few shared components bake in a conditional utility (`has-data-[slot=...]:`,
`dark:...`) that ends up with **higher CSS specificity** than a plain utility
passed in via `className` — so overriding it by passing a bigger/different
plain value (e.g. bumping a `py-*`) silently does nothing, no matter the
value, because the conditional rule still wins in the browser. Don't reach
for `!important` to force it; add a variant/size that omits the competing
conditional class instead, so there's nothing left to lose the specificity
fight against:

- `Attachment`'s `size="lg"` has no `has-data-[slot=attachment-content]:px-*
  py-*` (unlike `default`/`sm`/`xs`), because the `dropzone` orientation sets
  its own explicit padding — `Dropzone` always passes `size="lg"` together
  with `orientation="dropzone"`.
- `Textarea`'s `variant="flat"` drops `border-input` and `dark:bg-input/30`
  entirely, so a panel like the JSON Parser's Text tab can carry the same flat
  `bg-card/40` background as a plain `Card` instead of a translucent
  input-tinted overlay layered on top of it. Use `variant="default"` (the
  default) for anything that should still look like a normal form input.

See `components/ui/attachment.tsx` and `components/ui/textarea.tsx`.

`DropdownMenuContent`'s default width (`w-(--radix-dropdown-menu-trigger-width)`)
matches its trigger — fine for a full-width trigger, but when the trigger is
an icon-only chevron button (the "more options" pattern below), the menu is
squeezed to that same narrow width and its item label wraps to two lines.
Since it's a plain utility (not a conditional one), overriding it via
`className="w-max"` works normally through `cn`'s `tailwind-merge` — no
variant needed. See the `more`/`download` dropdowns in `components/tool-page.tsx`.

## Animation (Framer Motion)

This project uses **framer-motion** for anything beyond a plain Tailwind CSS
transition (hover/focus states stay plain `transition-*` classes — reach for
`motion.div` + `AnimatePresence` only once something needs to animate in/out,
follow a measured DOM rect, or survive a route change).

A page-level component (e.g. `app/page.tsx`) is unmounted the instant
`router.push` navigates away from it, so any animation state that needs to
keep playing *after* navigation (a fade-out, anything that finishes on the
destination page) can't live in that page's own `useState` — it has to live
in a provider mounted once in `app/layout.tsx`, alongside
`ThemeProvider`/`CommandMenuProvider`/`TooltipProvider`, so it persists across
the navigation. See `components/card-expand-transition.tsx`
(`CardExpandProvider`, mounted in `app/layout.tsx`) — it expands a clicked
homepage card to fill the screen, then, once `usePathname()` reports the new
route has mounted, fades the overlay out to reveal it, before unmounting.
Don't reach for framer's `layoutId` shared-layout tracking for a cross-route
transition that needs to track a specific DOM target (e.g. animating onto a
destination element rather than just fading away) — it only tracks elements
within one still-mounted tree, which a hard `router.push` doesn't give you.
Measure the real target with `getBoundingClientRect()` on a DOM node tagged
with a purpose-built `data-*` attribute instead, and animate a `position:
fixed` `motion.div` to that rect — see `transformOriginFromRect` in
`components/command-menu.tsx` for this pattern applied to a transform-origin
rather than a full position/size target.

For a color that must render reliably on a `motion.div` (or any element whose
`animate`/`initial` props drive inline styles), set it via `style={{
backgroundColor: "#151519" }}` rather than a Tailwind arbitrary-value class
like `bg-[#151519]` — `card-expand-transition.tsx` does this for its overlay
background. Framer motion already manages `top`/`left`/`width`/`height`/
`opacity`/`borderRadius` as inline styles on an animated element, so keeping
a color that must always show up in that same inline `style` object avoids
any ambiguity about class-vs-inline-style precedence on that node.

`CardExpandProvider` must be an *ancestor* of anything that calls
`useCardExpand()` — in `app/layout.tsx` it wraps `CommandMenuProvider`
specifically so `command-menu.tsx`'s tool-selection handler can trigger the
same grow-then-fade-out transition as clicking a homepage card, rather than a
bare `router.push`. If a new provider also needs to trigger it, it has to be
mounted *inside* `CardExpandProvider`, not the other way round.

Don't call `getBoundingClientRect()` on an element while it's mid-animation
(e.g. to compute a `transform-origin`) — `transform-origin` length values are
resolved against the element's *untransformed* layout box, but
`getBoundingClientRect()` reports the box *after* the currently-applied
transform (a mid-scale-animation element reports a shrunken, offset rect).
Subtracting one against the other silently produces a bogus result — no
error, just a wrong-looking animation. Either measure at rest (before/after
the animated transform is in play), or, if the element's position is driven
by a static, known CSS rule (e.g. `left-1/2` + `top-1/3`), compute the origin
analytically from that rule instead of measuring the DOM at all — see
`transformOriginFromRect` in `components/command-menu.tsx`.

Prefer a `motion.div`'s `onAnimationComplete` callback over a separately
tracked `setTimeout` matching the same `transition.duration` to sequence what
happens after an animation finishes (e.g. navigating once the expand
animation completes, or unmounting once the fade-out completes) — seen in
`card-expand-transition.tsx`'s `handleOuterAnimationComplete`. A parallel
timer duplicates the duration as a magic number in two places and can drift
from the real animation under frame drops or a backgrounded tab; the
completion callback is tied to the actual animation, so it's exact by
construction.

Passing a ref-registration function sourced from context/props directly as
`ref={context.someFn}` trips the `react-hooks/refs` lint rule ("Cannot
access ref value during render"), even though it's a perfectly ordinary
callback ref. Wrap it in a component-local `useCallback` first:

```tsx
const { registerTrigger } = context
const setTriggerRef = React.useCallback(
  (el: HTMLButtonElement | null) => registerTrigger(el),
  [registerTrigger]
)

<Button ref={setTriggerRef} ... />
```

See `CommandMenuTrigger`/`CommandMenuIconTrigger` in
`components/command-menu.tsx`, which register themselves this way so the
⌘K/Ctrl+K shortcut can grow the search dialog out of whichever trigger is
currently mounted instead of hunting for it with a DOM query.
