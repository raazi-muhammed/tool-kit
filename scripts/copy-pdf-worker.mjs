// Copies react-pdf's bundled pdfjs-dist worker build into public/ so PDF
// Unlock's preview can load it from a fixed static path (`new URL(...,
// import.meta.url)` resolves inconsistently between `next dev` (Turbopack)
// and `next build`). Resolved via react-pdf specifically (rather than a bare
// "pdfjs-dist" specifier) so this keeps working if a future dependency pins
// its own, different pdfjs-dist version alongside react-pdf's.
import { copyFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const source = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs", {
  paths: [require.resolve("react-pdf")],
})
const dest = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "pdf.worker.min.mjs"
)

copyFileSync(source, dest)
