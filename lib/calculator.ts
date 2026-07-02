/**
 * Minimal recursive-descent evaluator for arithmetic expressions:
 * + - * / % ^ (right-assoc power), parentheses, unary +/-, decimals.
 * No eval/Function - keeps user-typed text out of any JS execution path.
 */
export function evaluateExpression(input: string): number | null {
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
    const match = /^\d+(\.\d+)?/.exec(s.slice(pos))
    if (!match) throw new Error("Expected number")
    pos += match[0].length
    return Number.parseFloat(match[0])
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
}

/**
 * A line counts as an expression whether or not it ends with "=" - typing
 * the "=" just moves where the result is anchored, so the inline result
 * appears as soon as the expression is valid and doesn't jump around.
 */
export function annotateLine(line: string): LineAnnotation {
  const trimmed = line.trimEnd()
  const hasEquals = trimmed.endsWith("=")
  const exprSource = hasEquals ? trimmed.slice(0, -1) : trimmed
  if (!exprSource.trim()) return { hasEquals, result: null }

  const value = evaluateExpression(exprSource)
  if (value === null) return { hasEquals, result: null }
  return { hasEquals, result: formatResult(value) }
}

export function resolveText(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const { hasEquals, result } = annotateLine(line)
      if (result === null) return line
      return hasEquals ? `${line.trimEnd()} ${result}` : `${line.trimEnd()} = ${result}`
    })
    .join("\n")
}
