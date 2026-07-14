const ASSIGNMENT_LINE =
  /^(\s*)((?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)\s*=.*$/
const COMMENT_LINE = /^\s*#/

export type EnvExampleOptions = {
  /** Drop commented-out lines (e.g. `# APP`, `# <-- DATABASE -->`). */
  stripComments?: boolean
  /** With `stripComments` on, restrict the strip to only commented out lines that look like an assignment (e.g. `# DATABASE_HOST="..."`) — other comments (headers, notes) are kept. */
  onlyCommentedAssignments?: boolean
}

/**
 * Blanks out the value of every KEY=value assignment line, leaving comments,
 * blank lines, and the key/export prefix untouched (unless the strip options
 * drop matching comment lines entirely).
 */
export function generateEnvExample(
  input: string,
  options: EnvExampleOptions = {}
): string {
  const { stripComments = false, onlyCommentedAssignments = false } = options

  const lines = input
    .split(/\r\n|\r|\n/)
    .filter((line) => {
      if (!COMMENT_LINE.test(line)) return true
      if (!stripComments) return true
      if (onlyCommentedAssignments) return !line.includes("=")
      return false
    })
    .map((line) => {
      const match = line.match(ASSIGNMENT_LINE)
      if (!match) return line
      const [, indent, exportPrefix, key] = match
      return `${indent}${exportPrefix}${key}=`
    })

  // Collapse consecutive blank lines (often left behind by stripped
  // comments) down to a single blank line.
  const collapsed = lines.filter(
    (line, index) => line.trim() !== "" || lines[index - 1]?.trim() !== ""
  )

  return collapsed.join("\n")
}
