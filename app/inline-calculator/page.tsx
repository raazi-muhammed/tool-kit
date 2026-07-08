"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Calculator01Icon, Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { useMemo, useRef, useState } from "react"

import { ToolPage } from "@/components/tool-page"
import { annotateLines, listVariableNames } from "@/lib/calculator"

function longestCommonPrefix(strings: string[]): string {
  return strings.reduce((prefix, s) => {
    let i = 0
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++
    return prefix.slice(0, i)
  })
}

export default function InlineCalculatorPage() {
  const [text, setText] = useState("")
  const [copiedLine, setCopiedLine] = useState<number | null>(null)
  // null caret means "range selected" - suppress the suggestion rather than guess an anchor.
  const [caret, setCaret] = useState<number | null>(0)
  const backdropRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function syncScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (!backdropRef.current) return
    backdropRef.current.scrollTop = e.currentTarget.scrollTop
    backdropRef.current.scrollLeft = e.currentTarget.scrollLeft
  }

  function updateCaret(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    setCaret(el.selectionStart === el.selectionEnd ? el.selectionStart : null)
  }

  async function copyValue(value: string, line: number) {
    await navigator.clipboard.writeText(value)
    setCopiedLine(line)
    setTimeout(() => {
      setCopiedLine((current) => (current === line ? null : current))
    }, 1000)
  }

  function clear() {
    setText("")
  }

  const lines = text.split("\n")
  const annotations = useMemo(() => annotateLines(text), [text])

  const suggestion = useMemo(() => {
    if (caret === null) return null
    const before = text.slice(0, caret)
    const lineIndex = before.split("\n").length - 1
    const col = before.length - (before.lastIndexOf("\n") + 1)

    const prefixMatch = /[A-Za-z_]\w*$/.exec(before)
    if (!prefixMatch) return null
    const prefix = prefixMatch[0]

    const matches = listVariableNames(text, lineIndex).filter((candidate) =>
      candidate.startsWith(prefix),
    )
    if (matches.length === 0) return null

    // Fill in as far as every match agrees (shell-style completion) - e.g.
    // "i_am_" against i_am_here/i_am_not fills nothing since they diverge
    // immediately, but "i_am_h" fills the rest of i_am_here once it's the
    // only match left.
    const tail = longestCommonPrefix(matches).slice(prefix.length)
    if (!tail) return null

    return { line: lineIndex, col, tail }
  }, [text, caret])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab" || e.shiftKey || !suggestion || caret === null) return
    e.preventDefault()

    const newText = text.slice(0, caret) + suggestion.tail + text.slice(caret)
    const newCaret = caret + suggestion.tail.length
    setText(newText)
    setCaret(newCaret)
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(newCaret, newCaret)
    })
  }

  return (
    <ToolPage
      page="Inline Calculator"
      icon={Calculator01Icon}
      onClear={clear}
    >
      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-md border bg-card/40">
        <div
          ref={backdropRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-auto p-4 font-mono text-sm leading-6 break-words whitespace-pre-wrap"
        >
          {lines.map((line, i) => {
            const { hasEquals, result, resolved } = annotations[i]
            const isNote = !resolved && line.trim() !== ""
            return (
              <span key={i}>
                <span className={isNote ? "text-muted-foreground" : undefined}>
                  {suggestion && suggestion.line === i ? (
                    <>
                      {line.slice(0, suggestion.col)}
                      <span className="text-muted-foreground/50">{suggestion.tail}</span>
                      {line.slice(suggestion.col)}
                    </>
                  ) : (
                    line || "​"
                  )}
                </span>
                {result !== null && (
                  <span
                    role="button"
                    tabIndex={-1}
                    title="Click to copy"
                    onClick={() => copyValue(result, i)}
                    className="group pointer-events-auto relative z-10 inline-flex cursor-pointer items-center gap-1 text-primary"
                  >
                    <span>{hasEquals ? ` ${result}` : ` = ${result}`}</span>
                    {copiedLine === i ? (
                      <HugeiconsIcon icon={Tick02Icon} aria-hidden className="size-3 shrink-0" />
                    ) : (
                      <HugeiconsIcon
                        icon={Copy01Icon}
                        aria-hidden
                        className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    )}
                  </span>
                )}
                {i < lines.length - 1 && "\n"}
              </span>
            )
          })}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            updateCaret(e)
          }}
          onKeyDown={handleKeyDown}
          onSelect={updateCaret}
          onClick={updateCaret}
          onKeyUp={updateCaret}
          onScroll={syncScroll}
          placeholder="1 + 1 ="
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          style={{ caretColor: "var(--foreground)" }}
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-4 font-mono text-sm leading-6 text-transparent break-words whitespace-pre-wrap placeholder:text-muted-foreground selection:bg-primary/30 focus:outline-none"
        />
      </div>
    </ToolPage>
  )
}
