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

## Copy

Never use the `→` arrow character in tool names, page copy, or code comments
(e.g. write "Video to Audio", not "Video → Audio"). Use "to" in prose, or
`->` in code comments where an arrow is genuinely useful (e.g. describing a
before/after transform).

## Canvas rect selection

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

<canvas ref={displayCanvasRef} {...selectionHandlers} className="… cursor-crosshair touch-none select-none" />
```

The hook owns the selection state: read `pendingRect` to enable Apply-style
buttons, and call `clearSelection()` after committing an edit (it repaints
clean via `render(null)`). Inside `render`, draw the tool's own preview first,
then finish with `drawSelectionRect(canvas, rect)` from `lib/canvas.ts` for
the standard dashed border + grab handles. The underlying rect geometry
(`rectFromPoints`, `rectFromPointsWithRatio`, `clampRect`, `hitEdges`,
`resizeRect`, `pointInRect`) also lives in `lib/canvas.ts` — extend it there,
not in a page. See `app/image-crop/page.tsx` and `app/image-blur/page.tsx`.

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
`Button`'s own styles auto-size an unclassed `<svg>` child (`size-3.5` at
`size="sm"`, `size-4` at the default size), so just drop the icon in without a
`className`:

```tsx
<Button size="sm" onClick={format}>
  <HugeiconsIcon icon={TextIndentIcon} aria-hidden />
  Format
</Button>
```

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

shadcn ships **no** dropzone/file-drop component — only `attachment`. Build the
drop area yourself (a dashed `Card` with `onDragOver`/`onDrop` + a hidden
`<input type="file">`) and render the resulting files with `Attachment`. See
`app/video-to-audio/page.tsx`.
