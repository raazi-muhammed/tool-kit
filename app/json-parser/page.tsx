"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowShrink02Icon,
  BracesIcon,
  EyeIcon,
  TextIcon,
  TextIndentIcon,
} from "@hugeicons/core-free-icons"
import { useMemo, useState } from "react"

import { ToolPage } from "@/components/tool-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { JsonTree } from "@/components/json-tree"
import { extractJsonSegment, safeParseJson } from "@/lib/json"

const SAMPLE = JSON.stringify(
  {
    name: "tool-kit",
    version: "0.0.1",
    tools: ["json-parser"],
    active: true,
    meta: { author: "raazi", stars: 42, homepage: null },
  },
  null,
  2,
)

export default function JsonParserPage() {
  const [raw, setRaw] = useState("")

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

  async function copy() {
    await navigator.clipboard.writeText(raw)
  }

  function clear() {
    setRaw("")
  }

  function loadSample() {
    setRaw(SAMPLE)
  }

  return (
    <ToolPage
      page="JSON Parser"
      icon={BracesIcon}
      onCopy={copy}
      onLoadSample={loadSample}
      onClear={clear}
      actions={
        <>
          <Button onClick={format}>
            <HugeiconsIcon icon={TextIndentIcon} aria-hidden />
            Format
          </Button>
          <Button variant="secondary" onClick={minify}>
            <HugeiconsIcon icon={ArrowShrink02Icon} aria-hidden />
            Minify
          </Button>
        </>
      }
    >
      <Tabs defaultValue="text" className="flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="text">
              <HugeiconsIcon icon={TextIcon} aria-hidden />
              Text
            </TabsTrigger>
            <TabsTrigger value="viewer">
              <HugeiconsIcon icon={EyeIcon} aria-hidden />
              Viewer
            </TabsTrigger>
          </TabsList>
          {raw.trim() && (
            <div className="flex items-center gap-2">
              {!parsed.error && parsed.cleaned !== raw.trim() && (
                <Badge variant="outline">Auto-cleaned</Badge>
              )}
              <Badge variant={parsed.error ? "destructive" : "secondary"}>
                {parsed.error ? "Invalid JSON" : "Valid JSON"}
              </Badge>
            </div>
          )}
        </div>

        <TabsContent value="text" className="flex flex-col">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste the JSON code here (your code is not saved anywhere)"
            variant="flat"
            className="min-h-[420px] flex-1 rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
            spellCheck={false}
          />
        </TabsContent>

        <TabsContent value="viewer" className="flex flex-col">
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
        </TabsContent>
      </Tabs>
    </ToolPage>
  )
}
