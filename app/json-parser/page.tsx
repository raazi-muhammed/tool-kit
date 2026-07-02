"use client"

import { useMemo, useState } from "react"

import { PageBreadcrumb } from "@/components/page-breadcrumb"
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
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <PageBreadcrumb page="JSON Parser" />

      <div>
        <h1 className="text-lg font-medium">JSON Parser</h1>
        <p className="text-sm text-muted-foreground">
          Paste JSON to validate, format, and explore it as a tree.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={format}>
          Format
        </Button>
        <Button size="sm" variant="secondary" onClick={minify}>
          Minify
        </Button>
        <Button size="sm" variant="secondary" onClick={copy}>
          Copy
        </Button>
        <Button size="sm" variant="secondary" onClick={loadSample}>
          Load sample
        </Button>
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear
        </Button>
        {raw.trim() && (
          <div className="ml-auto flex items-center gap-2">
            {!parsed.error && parsed.cleaned !== raw.trim() && (
              <Badge variant="outline">Auto-cleaned</Badge>
            )}
            <Badge variant={parsed.error ? "destructive" : "secondary"}>
              {parsed.error ? "Invalid JSON" : "Valid JSON"}
            </Badge>
          </div>
        )}
      </div>

      <Tabs defaultValue="viewer" className="flex-1">
        <TabsList>
          <TabsTrigger value="viewer">Viewer</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste the JSON code here (your code is not saved anywhere)"
            className="min-h-[420px] font-mono text-xs"
            spellCheck={false}
          />
        </TabsContent>

        <TabsContent value="viewer">
          <Card className="min-h-[420px] p-4">
            {parsed.error ? (
              <p className="text-sm text-destructive">{parsed.error}</p>
            ) : parsed.data === undefined ? (
              <p className="text-sm text-muted-foreground">
                Paste JSON in the Text tab to see it here.
              </p>
            ) : (
              <ScrollArea className="h-[400px]">
                <JsonTree data={parsed.data} />
              </ScrollArea>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
