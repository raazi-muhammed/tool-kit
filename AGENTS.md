<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Tool page conventions

Each tool lives under `app/<tool-name>/page.tsx`. Every tool page starts with a
breadcrumb back to the home page — use the shared `PageBreadcrumb` component
instead of writing `Breadcrumb`/`BreadcrumbItem`/etc. inline:

```tsx
import { PageBreadcrumb } from "@/components/page-breadcrumb"

<PageBreadcrumb page="Inline Calculator" />
```

See `components/page-breadcrumb.tsx`.
