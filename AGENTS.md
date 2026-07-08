<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Tool page conventions

Each tool lives under `app/<tool-name>/page.tsx`. Every tool page is wrapped in
the shared `ToolPage` component instead of hand-rolling the breadcrumb and the
Copy/Load sample/Clear button row — those three actions are common to every
tool, so they live in the wrapper, not in each page:

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

For a mutually-exclusive mode toggle (e.g. an output-format switch), pass the
`segments` prop instead of hand-rolling a button group — the wrapper renders it
as a shadcn `Tabs` segmented control, matching the look used elsewhere (e.g. the
JSON Parser's Viewer/Text tabs):

```tsx
<ToolPage
  page="Video to Audio"
  icon={AudioWave01Icon}
  segments={{
    value: format,
    onValueChange: (value) => changeFormat(value as Format),
    disabled: busy,
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

See `components/tool-page.tsx` and `components/page-breadcrumb.tsx`.

For an output-format picker specifically (MP3/WAV, PNG/JPEG/WebP/BMP, etc.),
use `segments` in the header as shown above — don't hand-roll it as a `Select`
placed next to the dropzone. See `app/video-to-audio/page.tsx` and
`app/image-converter/page.tsx`.

For a tool's bottom control bar (zoom controls, a single strength/setting
slider, the primary action button(s), and the Download button), pass the
`footer` prop instead of hand-rolling that row inside `children` — like
`segments`, it takes a config object, not JSX, so `ToolPage` renders the row
(and its icons) itself:

```tsx
<ToolPage
  page="Image Blur"
  icon={BlurIcon}
  footer={
    activeJob && {
      zoom: { percent: zoomPct, onZoomOut, onZoomIn, onFit },
      slider: { label: "Blur", value: blur, onValueChange: onBlurChange, min: 1, max: 50 },
      actions: [
        pendingRect && { label: "Cancel selection", icon: Cancel01Icon, onClick: clearSelection, variant: "ghost" },
        { label: "Apply blur", icon: BlurIcon, onClick: applyBlur, disabled: !pendingRect },
      ],
      download: { onDownload: download, disabled: !activeJob.hasEdits, onDownloadAll: downloadAll },
    }
  }
>
```

`zoom` and `slider` are each optional single-instance blocks; `actions` is an
array (falsy entries are filtered, so conditional buttons — like "Cancel
selection" only while a selection is pending — are just `condition && {...}`);
`download` renders the Download button and, only when `onDownloadAll` is set,
its "Download all" dropdown. See `app/image-blur/page.tsx`.

For a primary action that also has a "do this to every job" variant (e.g.
Image Blur's "Apply blur" / "Apply blur to all", Image Crop's "Crop" / "Crop
all"), give that `FooterAction` a `more: { label, icon, onClick, disabled? }`
instead of adding a second button — `ToolPage` renders it as the same
Download-style `ButtonGroup` + dropdown chevron, only once `more` is set (so
gate it on the same `jobs.length > 1` check as `onDownloadAll`):

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

The footer also has config primitives for a few other recurring controls —
still config objects, never JSX, so `ToolPage` renders them itself:

- `color` — a settable/clearable color swatch (e.g. a background fill for
  transparent PNGs): `{ label, value, onChange, fallback, nullLabel?,
  clearLabel?, clearIcon?, onPickFromImage? }`. `value: null` shows `nullLabel`
  as muted text instead of the clear button. See `app/image-converter/page.tsx`
  and `app/image-crop/page.tsx`.
- `toggle` — a pressable button (e.g. "Remove background") that reveals its
  own nested `color` and/or `slider` only while pressed: `{ label, icon,
  pressed, onPressedChange, color?, slider? }`. See
  `app/image-converter/page.tsx`.
- `inputs` — an array of labeled text/number/password fields rendered
  label-above-input (e.g. resize width/height, a PDF password): `{ label,
  value, onChange, type?, min?, disabled?, className?, onEnter? }[]`. See
  `app/image-resize/page.tsx` and `app/pdf-unlock/page.tsx`.
- `hint` — muted contextual text shown inline with the footer buttons instead
  of a separate paragraph below the preview (e.g. "No transparent margin to
  trim."): just a `ReactNode`. See `app/image-trim/page.tsx`.

Render order in the footer row is `color`, `toggle`, `inputs`, `zoom`,
`slider`, `hint`, then `actions`/`download` right-aligned together. Don't add
a new primitive for a one-off control — reuse `actions` (e.g. an icon+label
toggle button computed from page state, like Image Resize's aspect-ratio
lock) unless the control is genuinely reusable across tools.

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
filters falsy values — same convention as `ToolPage`'s `footer.actions` —
so inline a layer's own readiness check (`condition ? {...} : {...}`)
instead of reaching for `children`. `children` still exists as an escape
hatch for content none of `canvas`/`image`/`status` fits — it's shown only
once `layer` resolves to no truthy layers. See Image Converter: its
Original pane is a canvas layer (so its color-picker click can sample
pixels) with a status layer for the invalid-file case, and its Converted
pane switches between an image layer and a status layer for
converting/error/idle — no `children` on either.

Pass `fill` for a viewport that grows to the available height (Image Blur's
pan/zoom canvas, Image Converter's side-by-side panes); omit it for a fixed,
viewport-relative preview (Image Crop, Image Rotate) capped at
`PreviewCard`'s own `MAX_HEIGHT` constant (`max-h-[calc(100dvh-220px)]`) —
derived from, and documented alongside, the fixed chrome ToolPage typically
stacks around it (padding, breadcrumb/toolbar/footer rows, gaps, the Card's
own padding), so preview tools use the actual available space instead of an
arbitrary `vh` guess. A page with a taller header than that (e.g. a wrapped
toolbar) can raise the cap via `className`. Pass `jobStrip` once the page
actually renders a `JobStrip` above it (`jobs.length > 1`) so the cap shrinks
further to make room for that row instead of pushing the page past the
viewport.
Note that `fill` only avoids overflowing the viewport where there's JS logic
actively constraining the rendered size to the available space (Image Blur's
fit-to-screen zoom math; Image Converter's panes are typically small enough
in practice) — without that, a `fill` layer's CSS-only `max-h-full` can't
reliably bound a large canvas, since intermediate flex containers don't
uniformly force a definite height, so the canvas renders at its native pixel
size and pushes the page past the viewport. Pass `checkerboard` so PNG/WebP
transparency (and the effect of a background colour) is visible against it.
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

<PreviewCard layer={{ ref: displayCanvasRef, ...selectionHandlers, className: "cursor-crosshair touch-none" }} />
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
in `app/layout.tsx`, wrapping `children`) that owns the open state, binds the
global keydown listener, and renders the `CommandDialog`, plus a
`CommandMenuTrigger` button that any page can render to open it:

```tsx
import { CommandMenuTrigger } from "@/components/command-menu"

<CommandMenuTrigger />
```

`PageBreadcrumb` already renders a `CommandMenuTrigger`, so every tool page
gets it for free — don't add another one on individual tool pages. When
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
zoom in/out/fit buttons in a `footer.zoom`), wrap it in the shared
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
`ToolPage`'s `onAddFile` prop rather than hand-rolling it in `actions` — every
tool page that keeps a dropzone around does this identically, so `ToolPage`
renders the button itself once `onAddFile` is set:

```tsx
const dropzoneRef = useRef<DropzoneHandle>(null)

<ToolPage
  onAddFile={file ? () => dropzoneRef.current?.open() : undefined}
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
