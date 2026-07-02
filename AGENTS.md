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

See `components/tool-page.tsx` and `components/page-breadcrumb.tsx`.

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
