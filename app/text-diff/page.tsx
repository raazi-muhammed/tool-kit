"use client"

import {
  ArrowLeftRightIcon,
  Eraser01Icon,
  FileDiffIcon,
  TextIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { ToolPage } from "@/components/tool-page"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
  diffLines,
  diffStats,
  groupDiffForDisplay,
  type DiffWord,
} from "@/lib/diff"

type Tab = "input" | "diff"
type UploadTarget = "original" | "modified"

function renderWords(words: DiffWord[], changedClassName: string) {
  if (words.length === 0) return "​"
  return words.map((word, index) => (
    <span
      key={index}
      className={word.type === "equal" ? undefined : changedClassName}
    >
      {word.value}
    </span>
  ))
}

export default function TextDiffPage() {
  const [original, setOriginal] = useState("")
  const [modified, setModified] = useState("")
  const [tab, setTab] = useState<Tab>("input")
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>("original")
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const diff = useMemo(
    () => diffLines(original, modified),
    [original, modified]
  )
  const stats = useMemo(() => diffStats(diff), [diff])
  const rows = useMemo(() => groupDiffForDisplay(diff), [diff])
  const isEmpty = !original.trim() && !modified.trim()

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    const text = await file.text()
    if (uploadTarget === "original") setOriginal(text)
    else setModified(text)
    setTab("input")
  }

  function openUpload(target: UploadTarget) {
    setUploadTarget(target)
    dropzoneRef.current?.open()
  }

  function swap() {
    setOriginal(modified)
    setModified(original)
  }

  function clear() {
    setOriginal("")
    setModified("")
  }

  return (
    <ToolPage
      page="Text Diff"
      icon={FileDiffIcon}
      segments={{
        value: tab,
        onValueChange: (value) => setTab(value as Tab),
        label: "View",
        options: [
          { value: "input", label: "Input", icon: TextIcon },
          { value: "diff", label: "Diff", icon: FileDiffIcon },
        ],
      }}
      sidebar={{
        hint: isEmpty
          ? undefined
          : stats.additions === 0 && stats.deletions === 0
            ? "No differences"
            : `+${stats.additions} -${stats.deletions}`,
        actions: [
          {
            label: "Clear",
            icon: Eraser01Icon,
            onClick: clear,
            variant: "outline",
          },
          {
            label: "Swap",
            icon: ArrowLeftRightIcon,
            onClick: swap,
            variant: "secondary",
          },
        ],
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {tab === "input" ? (
          <div className="grid min-h-[60vh] flex-1 grid-cols-2 gap-4">
            <div className="flex min-h-0 flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Original
                </span>
                <Button variant="ghost" onClick={() => openUpload("original")}>
                  <HugeiconsIcon icon={Upload04Icon} aria-hidden />
                  Upload file
                </Button>
              </div>
              <Textarea
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                placeholder="Paste the original text here (your text is not saved anywhere)"
                variant="flat"
                className="field-sizing-fixed min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
                spellCheck={false}
              />
            </div>
            <div className="flex min-h-0 flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Modified
                </span>
                <Button variant="ghost" onClick={() => openUpload("modified")}>
                  <HugeiconsIcon icon={Upload04Icon} aria-hidden />
                  Upload file
                </Button>
              </div>
              <Textarea
                value={modified}
                onChange={(e) => setModified(e.target.value)}
                placeholder="Paste the modified text here (your text is not saved anywhere)"
                variant="flat"
                className="field-sizing-fixed min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
                spellCheck={false}
              />
            </div>
          </div>
        ) : (
          <Card className="flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-lg border bg-card/40 p-0 ring-0">
            {isEmpty ? (
              <p className="p-4 text-sm text-muted-foreground">
                Paste or upload text in the Input tab to see the diff here.
              </p>
            ) : (
              <ScrollArea className="min-h-0 flex-1">
                <div className="py-2 font-mono text-xs">
                  {rows.map((row, index) =>
                    row.kind === "replace" ? (
                      <div key={index}>
                        <div className="flex gap-3 bg-destructive/10 px-4 py-0.5 text-destructive">
                          <span className="w-3 shrink-0 select-none">-</span>
                          <span className="break-all whitespace-pre-wrap">
                            {renderWords(
                              row.before,
                              "rounded-sm bg-destructive/25"
                            )}
                          </span>
                        </div>
                        <div className="flex gap-3 bg-emerald-500/10 px-4 py-0.5 text-emerald-700 dark:text-emerald-400">
                          <span className="w-3 shrink-0 select-none">+</span>
                          <span className="break-all whitespace-pre-wrap">
                            {renderWords(
                              row.after,
                              "rounded-sm bg-emerald-500/25"
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={index}
                        className={
                          row.kind === "add"
                            ? "flex gap-3 bg-emerald-500/10 px-4 py-0.5 text-emerald-700 dark:text-emerald-400"
                            : row.kind === "remove"
                              ? "flex gap-3 bg-destructive/10 px-4 py-0.5 text-destructive"
                              : "flex gap-3 px-4 py-0.5"
                        }
                      >
                        <span className="w-3 shrink-0 select-none">
                          {row.kind === "add"
                            ? "+"
                            : row.kind === "remove"
                              ? "-"
                              : ""}
                        </span>
                        <span className="break-all whitespace-pre-wrap">
                          {row.value || "​"}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </ScrollArea>
            )}
          </Card>
        )}
      </div>

      <Dropzone
        ref={dropzoneRef}
        hidden
        icon={Upload04Icon}
        title="Drag and drop a text file to upload"
        description="or, click to browse · your file is not saved anywhere"
        accept="text/plain,.txt,.md,.csv,.log,.json,.js,.jsx,.ts,.tsx,.css,.html,.xml,.yaml,.yml"
        onFiles={handleFiles}
      />
    </ToolPage>
  )
}
