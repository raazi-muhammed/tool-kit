export type EscapeFormat = "html" | "js" | "json" | "url"
export type EscapeDirection = "escape" | "decode"

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&#x27;": "'",
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Matches a whole named/numeric entity in one pass, so e.g. `&amp;lt;`
// decodes to `&lt;` (one step) rather than all the way back to `<`.
function unescapeHtml(input: string): string {
  return input.replace(
    /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g,
    (match, code: string) => {
      if (HTML_ENTITY_MAP[match]) return HTML_ENTITY_MAP[match]
      if (code[0] === "#") {
        const codePoint =
          code[1] === "x" || code[1] === "X"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10)
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
      }
      return match
    }
  )
}

function escapeJsString(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
}

function unescapeJsString(input: string): string {
  return input.replace(/\\(\\|'|"|n|r|t)/g, (_, code: string) => {
    switch (code) {
      case "n":
        return "\n"
      case "r":
        return "\r"
      case "t":
        return "\t"
      default:
        return code // \\ -> \, \' -> ', \" -> "
    }
  })
}

// Accepts either a full JSON string literal (with surrounding quotes) or
// just the escaped content produced by `escape` below.
function unescapeJson(input: string): string {
  try {
    const parsed: unknown = JSON.parse(input)
    if (typeof parsed === "string") return parsed
  } catch {
    // fall through to the quote-wrapped attempt below
  }
  try {
    const parsed: unknown = JSON.parse(`"${input}"`)
    if (typeof parsed === "string") return parsed
  } catch {
    // input isn't valid JSON either way - leave it untouched
  }
  return input
}

function unescapeUrl(input: string): string {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

export const ESCAPE_FORMATS: Record<
  EscapeFormat,
  {
    label: string
    escape: (input: string) => string
    unescape: (input: string) => string
  }
> = {
  html: { label: "HTML", escape: escapeHtml, unescape: unescapeHtml },
  js: {
    label: "JavaScript",
    escape: escapeJsString,
    unescape: unescapeJsString,
  },
  json: {
    label: "JSON",
    escape: (input) => JSON.stringify(input),
    unescape: unescapeJson,
  },
  url: {
    label: "URL",
    escape: (input) => encodeURIComponent(input),
    unescape: unescapeUrl,
  },
}
