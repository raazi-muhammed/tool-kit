import { marked } from "marked"
import DOMPurify from "dompurify"

marked.use({ gfm: true, breaks: false })

/**
 * DOMPurify only initializes a working `sanitize` against a real `window`
 * (it returns a stub with `isSupported: false` and no `sanitize` method
 * under Next's server-side render pass) - safe to skip sanitizing there
 * since the server-rendered pass always starts from empty markdown anyway.
 */
export function renderMarkdownToHtml(raw: string): string {
  const html = marked.parse(raw, { async: false }) as string
  return DOMPurify.isSupported ? DOMPurify.sanitize(html) : html
}
