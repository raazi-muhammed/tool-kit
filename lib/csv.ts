/**
 * Parse CSV text into rows of fields (RFC 4180: quoted fields may contain
 * commas, doubled quotes, and newlines). Rows are kept as-is — no header
 * handling and no padding; callers pad short rows to the widest row where
 * they need a rectangular grid. A trailing newline doesn't produce an empty
 * final row.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      rows.push(row)
      row = []
    } else {
      field += char
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/** Quote a field only when it needs it (contains a comma, quote, or newline). */
export function serializeCsvField(field: string): string {
  return /[",\n\r]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field
}

/** Serialize rows back to CSV text, without a trailing newline. */
export function serializeCsv(rows: string[][]): string {
  return rows.map((row) => row.map(serializeCsvField).join(",")).join("\n")
}

/** Spreadsheet-style column label: 0 -> "A", 25 -> "Z", 26 -> "AA", ... */
export function columnLabel(index: number): string {
  let label = ""
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
    label = String.fromCharCode(65 + (n % 26)) + label
  }
  return label
}
