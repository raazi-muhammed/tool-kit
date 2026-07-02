export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonSegment = {
  prefix: string
  json: string
  suffix: string
}

/**
 * Locates a {...} or [...] in the input that actually parses as JSON, so
 * unrelated wrapping (markdown code fences, a stray prefix like "here's your
 * json:", an unmatched leading bracket, etc.) can be preserved as-is instead
 * of discarded. Tries every bracket position left-to-right rather than just
 * the first one, since the first bracket in the text isn't always the one
 * that actually opens the JSON value (e.g. a lone leading "[").
 */
export function extractJsonSegment(input: string): JsonSegment | null {
  const starts = [...input.matchAll(/[{[]/g)].map((m) => m.index as number)

  for (const start of starts) {
    const closeChar = input[start] === "{" ? "}" : "]"
    const end = input.lastIndexOf(closeChar)
    if (end === -1 || end <= start) continue

    const json = input.slice(start, end + 1)
    try {
      JSON.parse(json)
      return { prefix: input.slice(0, start), json, suffix: input.slice(end + 1) }
    } catch {
      // this bracket wasn't the real start of the JSON value - try the next one
    }
  }

  return null
}

export type ParseResult = {
  data: JsonValue | undefined
  error: string | null
  cleaned: string
}

/**
 * Parses JSON, falling back to the outermost {...}/[...] segment (ignoring
 * markdown fences, stray prefixes, etc.) when the raw text fails to parse.
 */
export function safeParseJson(raw: string): ParseResult {
  if (!raw.trim()) return { data: undefined, error: null, cleaned: raw }

  try {
    return { data: JSON.parse(raw), error: null, cleaned: raw }
  } catch (e) {
    const segment = extractJsonSegment(raw)
    if (segment && segment.json !== raw.trim()) {
      try {
        return { data: JSON.parse(segment.json), error: null, cleaned: segment.json }
      } catch {
        // fall through to the original error, it's more likely relevant
      }
    }
    return { data: undefined, error: e instanceof Error ? e.message : "Invalid JSON", cleaned: raw }
  }
}
