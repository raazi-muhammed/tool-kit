"use client"

import {
  ArrowShrink02Icon,
  BracesIcon,
  Eraser01Icon,
  EyeIcon,
  TextIcon,
  TextIndentIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { useMemo, useRef, useState } from "react"

import { ToolPage } from "@/components/tool-page"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { JsonTree } from "@/components/json-tree"
import { extractJsonSegment, safeParseJson } from "@/lib/json"
import { readFirstFileAsText } from "@/lib/utils"

type Tab = "text" | "viewer"

/**
 * Parse `raw` as JSON and re-stringify it with `stringify`, falling back to
 * locating a JSON value embedded in surrounding text (markdown fences, a
 * leading prefix, ...) if the whole string isn't valid JSON on its own.
 * Returns `null` if neither attempt produces valid JSON — the caller then
 * leaves `raw` untouched.
 */
function applyJsonTransform(
  raw: string,
  stringify: (data: unknown) => string
): string | null {
  try {
    return stringify(JSON.parse(raw))
  } catch {
    // fall through to the segment-based attempt below
  }
  const segment = extractJsonSegment(raw)
  if (!segment) return null
  try {
    return segment.prefix + stringify(JSON.parse(segment.json)) + segment.suffix
  } catch {
    return null // segment isn't valid JSON either - leave raw untouched
  }
}

export default function JsonParserPage() {
  const [raw, setRaw] = useState("")
  const [tab, setTab] = useState<Tab>("text")
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const parsed = useMemo(() => safeParseJson(raw), [raw])

  async function handleFiles(files: FileList | null) {
    const text = await readFirstFileAsText(files)
    if (text == null) return
    setRaw(text)
    setTab("text")
  }

  function format() {
    const result = applyJsonTransform(raw, (data) =>
      JSON.stringify(data, null, 2)
    )
    if (result != null) setRaw(result)
  }

  function minify() {
    const result = applyJsonTransform(raw, (data) => JSON.stringify(data))
    if (result != null) setRaw(result)
  }

  function clear() {
    setRaw("")
  }

  return (
    <ToolPage
      page="JSON Parser"
      icon={BracesIcon}
      onAddFile={dropzoneRef}
      segments={{
        value: tab,
        onValueChange: (value) => setTab(value as Tab),
        label: "View",
        options: [
          { value: "text", label: "Text", icon: TextIcon },
          { value: "viewer", label: "Viewer", icon: EyeIcon },
        ],
      }}
      sidebar={{
        hint: raw.trim()
          ? parsed.error
            ? "Invalid JSON"
            : parsed.cleaned !== raw.trim()
              ? "Auto-cleaned"
              : undefined
          : undefined,
        actions: [
          {
            label: "Clear",
            icon: Eraser01Icon,
            onClick: clear,
            variant: "outline",
          },
          { label: "Format", icon: TextIndentIcon, onClick: format },
          {
            label: "Minify",
            icon: ArrowShrink02Icon,
            onClick: minify,
            variant: "secondary",
          },
        ],
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {tab === "text" ? (
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste the JSON code here (your code is not saved anywhere)"
            variant="flat"
            className="field-sizing-fixed min-h-[60vh] flex-1 overflow-y-auto rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
            spellCheck={false}
          />
        ) : (
          <Card className="flex min-h-[60vh] flex-1 flex-col rounded-lg border bg-card/40 p-4 ring-0">
            {parsed.error ? (
              <p className="text-sm text-destructive">{parsed.error}</p>
            ) : parsed.data === undefined ? (
              <p className="text-sm text-muted-foreground">
                Paste JSON in the Text tab to see it here.
              </p>
            ) : (
              <ScrollArea className="min-h-0 flex-1">
                <JsonTree data={parsed.data} />
              </ScrollArea>
            )}
          </Card>
        )}
      </div>

      <Dropzone
        ref={dropzoneRef}
        hidden
        icon={Upload04Icon}
        title="Drag and drop a JSON file to upload"
        description="or, click to browse · your file is not saved anywhere"
        accept=".json,application/json"
        onFiles={handleFiles}
      />
    </ToolPage>
  )
}
