"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Calculator01Icon, Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { useMemo, useRef, useState } from "react"

import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { Button } from "@/components/ui/button"
import { annotateLines, resolveText } from "@/lib/calculator"

const SAMPLE = `12 + 8 =
150 / 3 =
(4 + 2) * 5
2 ^ 10 =
notes and other non-math lines are left untouched
100 - 37.5 =
a = 3
a + 3 =`

export default function InlineCalculatorPage() {
  const [text, setText] = useState("")
  const [copiedLine, setCopiedLine] = useState<number | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  function syncScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (!backdropRef.current) return
    backdropRef.current.scrollTop = e.currentTarget.scrollTop
    backdropRef.current.scrollLeft = e.currentTarget.scrollLeft
  }

  async function copy() {
    await navigator.clipboard.writeText(resolveText(text))
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

  function loadSample() {
    setText(SAMPLE)
  }

  const lines = text.split("\n")
  const annotations = useMemo(() => annotateLines(text), [text])

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <PageBreadcrumb page="Inline Calculator" icon={Calculator01Icon} />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={loadSample}>
          Load sample
        </Button>
        <Button size="sm" variant="secondary" onClick={copy}>
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear
        </Button>
      </div>

      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-md border">
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
                  {line || "​"}
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          onScroll={syncScroll}
          placeholder="1 + 1 ="
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          style={{ caretColor: "var(--foreground)" }}
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-4 font-mono text-sm leading-6 text-transparent break-words whitespace-pre-wrap placeholder:text-muted-foreground selection:bg-primary/30 focus:outline-none"
        />
      </div>
    </div>
  )
}
