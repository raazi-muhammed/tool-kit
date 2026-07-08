"use client"

import {
  ArrowShrink02Icon,
  BracesIcon,
  EyeIcon,
  TextIcon,
  TextIndentIcon,
} from "@hugeicons/core-free-icons"
import { useMemo, useState } from "react"

import { ToolPage } from "@/components/tool-page"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { JsonTree } from "@/components/json-tree"
import { extractJsonSegment, safeParseJson } from "@/lib/json"

type Tab = "text" | "viewer"

export default function JsonParserPage() {
  const [raw, setRaw] = useState("")
  const [tab, setTab] = useState<Tab>("text")

  const parsed = useMemo(() => safeParseJson(raw), [raw])

  function format() {
    try {
      setRaw(JSON.stringify(JSON.parse(raw), null, 2))
      return
    } catch {
      // fall through to the segment-based attempt below
    }
    const segment = extractJsonSegment(raw)
    if (!segment) return
    try {
      const data = JSON.parse(segment.json)
      setRaw(segment.prefix + JSON.stringify(data, null, 2) + segment.suffix)
    } catch {
      // segment isn't valid JSON either - leave raw untouched
    }
  }

  function minify() {
    try {
      setRaw(JSON.stringify(JSON.parse(raw)))
      return
    } catch {
      // fall through to the segment-based attempt below
    }
    const segment = extractJsonSegment(raw)
    if (!segment) return
    try {
      const data = JSON.parse(segment.json)
      setRaw(segment.prefix + JSON.stringify(data) + segment.suffix)
    } catch {
      // segment isn't valid JSON either - leave raw untouched
    }
  }

  function clear() {
    setRaw("")
  }

  return (
    <ToolPage
      page="JSON Parser"
      onClear={clear}
      icon={BracesIcon}
      segments={{
        value: tab,
        onValueChange: (value) => setTab(value as Tab),
        options: [
          { value: "text", label: "Text", icon: TextIcon },
          { value: "viewer", label: "Viewer", icon: EyeIcon },
        ],
      }}
      footer={{
        hint: raw.trim()
          ? parsed.error
            ? "Invalid JSON"
            : parsed.cleaned !== raw.trim()
              ? "Auto-cleaned"
              : undefined
          : undefined,
        actions: [
          { label: "Format", icon: TextIndentIcon, onClick: format },
          { label: "Minify", icon: ArrowShrink02Icon, onClick: minify, variant: "secondary" },
        ],
      }}
    >
      <div className="flex flex-1 flex-col gap-2">
        {tab === "text" ? (
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste the JSON code here (your code is not saved anywhere)"
            variant="flat"
            className="min-h-[420px] flex-1 rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
            spellCheck={false}
          />
        ) : (
          <Card className="min-h-[420px] flex-1 rounded-lg border bg-card/40 p-4 ring-0">
            {parsed.error ? (
              <p className="text-sm text-destructive">{parsed.error}</p>
            ) : parsed.data === undefined ? (
              <p className="text-sm text-muted-foreground">
                Paste JSON in the Text tab to see it here.
              </p>
            ) : (
              <ScrollArea className="flex-1">
                <JsonTree data={parsed.data} />
              </ScrollArea>
            )}
          </Card>
        )}
      </div>
    </ToolPage>
  )
}
