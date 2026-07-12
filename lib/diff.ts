export type DiffLine = {
  type: "equal" | "add" | "remove"
  value: string
  aLine?: number
  bLine?: number
}

export type DiffWord = {
  type: "equal" | "add" | "remove"
  value: string
}

export type DiffRow =
  | { kind: "equal" | "add" | "remove"; value: string }
  | { kind: "replace"; before: DiffWord[]; after: DiffWord[] }

/** Full LCS table for two arrays, used to backtrack into add/remove/equal ops. */
function buildLcsTable<T>(a: T[], b: T[]): number[][] {
  const n = a.length
  const m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  return lcs
}

/**
 * Line-based diff via a full LCS table, backtracked into add/remove/equal
 * ops. O(n*m) time and space - fine for the pasted/uploaded text sizes this
 * tool targets, but not meant for huge files.
 */
export function diffLines(a: string, b: string): DiffLine[] {
  const aLines = a.length ? a.split("\n") : []
  const bLines = b.length ? b.split("\n") : []
  const n = aLines.length
  const m = bLines.length
  const lcs = buildLcsTable(aLines, bLines)

  const ops: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      ops.push({ type: "equal", value: aLines[i], aLine: i + 1, bLine: j + 1 })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "remove", value: aLines[i], aLine: i + 1 })
      i++
    } else {
      ops.push({ type: "add", value: bLines[j], bLine: j + 1 })
      j++
    }
  }
  while (i < n) {
    ops.push({ type: "remove", value: aLines[i], aLine: i + 1 })
    i++
  }
  while (j < m) {
    ops.push({ type: "add", value: bLines[j], bLine: j + 1 })
    j++
  }

  return ops
}

export function diffStats(lines: DiffLine[]): {
  additions: number
  deletions: number
} {
  let additions = 0
  let deletions = 0
  for (const line of lines) {
    if (line.type === "add") additions++
    else if (line.type === "remove") deletions++
  }
  return { additions, deletions }
}

// Splits on runs of whitespace, keeping the whitespace itself as its own
// token, so words diff independently of the spacing around them and the
// original spacing can still be reconstructed from the equal/add tokens.
function tokenizeWords(line: string): string[] {
  return line.match(/\s+|[^\s]+/g) ?? []
}

/** Word-level diff between two lines, for highlighting the exact change within a modified line. */
export function diffWords(a: string, b: string): DiffWord[] {
  const aWords = tokenizeWords(a)
  const bWords = tokenizeWords(b)
  const n = aWords.length
  const m = bWords.length
  const lcs = buildLcsTable(aWords, bWords)

  const ops: DiffWord[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (aWords[i] === bWords[j]) {
      ops.push({ type: "equal", value: aWords[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "remove", value: aWords[i] })
      i++
    } else {
      ops.push({ type: "add", value: bWords[j] })
      j++
    }
  }
  while (i < n) {
    ops.push({ type: "remove", value: aWords[i] })
    i++
  }
  while (j < m) {
    ops.push({ type: "add", value: bWords[j] })
    j++
  }

  return ops
}

/**
 * Regroups a flat line diff for display: a removed line immediately followed
 * by an added line reads as one modified line, so it's paired into a single
 * "replace" row carrying a word-level diff (so only the changed word inside
 * an otherwise-unchanged line gets highlighted) instead of two full lines
 * both rendered as entirely changed.
 */
export function groupDiffForDisplay(lines: DiffLine[]): DiffRow[] {
  const rows: DiffRow[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].type !== "remove") {
      rows.push({ kind: lines[i].type, value: lines[i].value })
      i++
      continue
    }

    let removeEnd = i
    while (removeEnd < lines.length && lines[removeEnd].type === "remove")
      removeEnd++
    let addEnd = removeEnd
    while (addEnd < lines.length && lines[addEnd].type === "add") addEnd++

    const removeCount = removeEnd - i
    const addCount = addEnd - removeEnd
    const pairCount = Math.min(removeCount, addCount)

    for (let k = 0; k < pairCount; k++) {
      const before = lines[i + k].value
      const after = lines[removeEnd + k].value
      const words = diffWords(before, after)
      rows.push({
        kind: "replace",
        before: words.filter((w) => w.type !== "add"),
        after: words.filter((w) => w.type !== "remove"),
      })
    }
    for (let k = pairCount; k < removeCount; k++) {
      rows.push({ kind: "remove", value: lines[i + k].value })
    }
    for (let k = pairCount; k < addCount; k++) {
      rows.push({ kind: "add", value: lines[removeEnd + k].value })
    }

    i = addEnd
  }
  return rows
}
