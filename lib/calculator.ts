/**
 * Minimal recursive-descent evaluator for arithmetic expressions:
 * + - * / % ^ (right-assoc power), parentheses, unary +/-, decimals,
 * and identifiers that resolve against a variables map.
 * No eval/Function - keeps user-typed text out of any JS execution path.
 */
export function evaluateExpression(
  input: string,
  variables: Record<string, number> = {},
): number | null {
  const s = input.trim()
  if (!s) return null

  let pos = 0

  const peek = () => s[pos]
  const skipWs = () => {
    while (s[pos] === " " || s[pos] === "\t") pos++
  }

  function parseExpression(): number {
    skipWs()
    let value = parseTerm()
    skipWs()
    while (peek() === "+" || peek() === "-") {
      const op = s[pos++]
      const rhs = parseTerm()
      value = op === "+" ? value + rhs : value - rhs
      skipWs()
    }
    return value
  }

  function parseTerm(): number {
    skipWs()
    let value = parseFactor()
    skipWs()
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = s[pos++]
      const rhs = parseFactor()
      if (op === "*") value *= rhs
      else if (op === "/") value /= rhs
      else value %= rhs
      skipWs()
    }
    return value
  }

  function parseFactor(): number {
    skipWs()
    const base = parseUnary()
    skipWs()
    if (peek() === "^") {
      pos++
      return Math.pow(base, parseFactor())
    }
    return base
  }

  function parseUnary(): number {
    skipWs()
    if (peek() === "+") {
      pos++
      return parseUnary()
    }
    if (peek() === "-") {
      pos++
      return -parseUnary()
    }
    return parsePrimary()
  }

  function parsePrimary(): number {
    skipWs()
    if (peek() === "(") {
      pos++
      const value = parseExpression()
      skipWs()
      if (peek() !== ")") throw new Error("Expected )")
      pos++
      return value
    }

    const identMatch = /^[A-Za-z_]\w*/.exec(s.slice(pos))
    if (identMatch) {
      const name = identMatch[0]
      if (!(name in variables)) throw new Error(`Unknown variable: ${name}`)
      pos += name.length
      return variables[name]
    }

    const numMatch = /^\d+(\.\d+)?/.exec(s.slice(pos))
    if (!numMatch) throw new Error("Expected number")
    pos += numMatch[0].length
    return Number.parseFloat(numMatch[0])
  }

  try {
    const result = parseExpression()
    skipWs()
    if (pos !== s.length) return null // trailing garbage - not a clean expression
    if (!Number.isFinite(result)) return null
    return result
  } catch {
    return null
  }
}

export function formatResult(n: number): string {
  const rounded = Math.round((n + Number.EPSILON) * 1e9) / 1e9 || 0 // fold -0 to 0, tame fp noise
  return Number.isInteger(rounded)
    ? rounded.toLocaleString()
    : rounded.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

export type LineAnnotation = {
  hasEquals: boolean
  result: string | null
  /** True once the line evaluates to a value, even if there's no suffix to show (e.g. "a = 3"). */
  resolved: boolean
}

const ASSIGNMENT = /^\s*([A-Za-z_]\w*)\s*=\s*(.+)$/

/**
 * Walks the document top to bottom, one pass, so a variable assigned on an
 * earlier line ("a = 3") is visible to expressions on later lines ("a + 3 =").
 * A line counts as an expression whether or not it ends with "=" - typing
 * the "=" just moves where the result is anchored, so the inline result
 * appears as soon as the expression is valid and doesn't jump around.
 */
export function annotateLines(text: string): LineAnnotation[] {
  const variables: Record<string, number> = {}

  return text.split("\n").map((line) => {
    const trimmed = line.trimEnd()

    const assignment = ASSIGNMENT.exec(trimmed)
    if (assignment) {
      const [, name, rhsSource] = assignment
      const value = evaluateExpression(rhsSource, variables)
      if (value === null) return { hasEquals: false, result: null, resolved: false }

      variables[name] = value
      const formatted = formatResult(value)
      const isRedundant = rhsSource.trim() === formatted
      return { hasEquals: false, result: isRedundant ? null : formatted, resolved: true }
    }

    const hasEquals = trimmed.endsWith("=")
    const exprSource = hasEquals ? trimmed.slice(0, -1) : trimmed
    if (!exprSource.trim()) return { hasEquals, result: null, resolved: false }

    const value = evaluateExpression(exprSource, variables)
    if (value === null) return { hasEquals, result: null, resolved: false }
    return { hasEquals, result: formatResult(value), resolved: true }
  })
}

export function resolveText(source: string): string {
  const lines = source.split("\n")
  const annotations = annotateLines(source)

  return lines
    .map((line, i) => {
      const { hasEquals, result } = annotations[i]
      if (result === null) return line
      return hasEquals ? `${line.trimEnd()} ${result}` : `${line.trimEnd()} = ${result}`
    })
    .join("\n")
}
