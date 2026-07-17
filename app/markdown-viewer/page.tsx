"use client"

import {
  Eraser01Icon,
  EyeIcon,
  FileEditIcon,
  LayoutTwoColumnIcon,
  TextIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { useMemo, useRef, useState } from "react"

import { ToolPage } from "@/components/tool-page"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { MarkdownView } from "@/components/markdown-view"
import { renderMarkdownToHtml } from "@/lib/markdown"
import { cn, readFirstFileAsText } from "@/lib/utils"

type Tab = "text" | "preview" | "split"

export default function MarkdownViewerPage() {
  const [raw, setRaw] = useState("")
  const [tab, setTab] = useState<Tab>("text")
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const html = useMemo(() => renderMarkdownToHtml(raw), [raw])

  async function handleFiles(files: FileList | null) {
    const text = await readFirstFileAsText(files)
    if (text == null) return
    setRaw(text)
    setTab("text")
  }

  function clear() {
    setRaw("")
  }

  return (
    <ToolPage
      page="Markdown Viewer"
      icon={FileEditIcon}
      onAddFile={dropzoneRef}
      segments={{
        value: tab,
        onValueChange: (value) => setTab(value as Tab),
        label: "View",
        options: [
          { value: "text", label: "Edit", icon: TextIcon },
          { value: "preview", label: "Preview", icon: EyeIcon },
          { value: "split", label: "Split", icon: LayoutTwoColumnIcon },
        ],
      }}
      sidebar={{
        actions: [
          {
            label: "Clear",
            icon: Eraser01Icon,
            onClick: clear,
            variant: "outline",
          },
        ],
      }}
    >
      <div
        className={cn(
          "grid min-h-[60vh] flex-1 gap-4",
          tab === "split" ? "grid-cols-2" : "grid-cols-1"
        )}
      >
        {tab !== "preview" && (
          <div className="flex min-h-0 flex-col gap-2">
            {tab === "split" && (
              <span className="text-sm font-medium text-muted-foreground">
                Edit
              </span>
            )}
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Write Markdown here (your text is not saved anywhere)"
              variant="flat"
              className="field-sizing-fixed min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
              spellCheck={false}
            />
          </div>
        )}
        {tab !== "text" && (
          <div className="flex min-h-0 flex-col gap-2">
            {tab === "split" && (
              <span className="text-sm font-medium text-muted-foreground">
                Preview
              </span>
            )}
            <Card className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card/40 p-4 ring-0">
              {raw.trim() ? (
                <ScrollArea className="min-h-0 flex-1">
                  <MarkdownView html={html} />
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Write Markdown in the Edit tab to see it rendered here.
                </p>
              )}
            </Card>
          </div>
        )}
      </div>

      <Dropzone
        ref={dropzoneRef}
        hidden
        icon={Upload04Icon}
        title="Drag and drop a Markdown file to upload"
        description="or, click to browse · your file is not saved anywhere"
        accept=".md,.markdown,text/markdown"
        onFiles={handleFiles}
      />
    </ToolPage>
  )
}
