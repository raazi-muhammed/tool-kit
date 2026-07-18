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

import { PreviewCard } from "@/components/preview-card"
import { ToolPage } from "@/components/tool-page"
import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { downloadFile } from "@/lib/download"
import { renderMarkdownToHtml } from "@/lib/markdown"
import { cn, readFirstFileAsText } from "@/lib/utils"

type Tab = "text" | "preview" | "split"

const DEFAULT_FILE_NAME = "document.md"

export default function MarkdownViewerPage() {
  const [raw, setRaw] = useState("")
  const [tab, setTab] = useState<Tab>("text")
  const [fileName, setFileName] = useState(DEFAULT_FILE_NAME)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const html = useMemo(() => renderMarkdownToHtml(raw), [raw])

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    const text = await readFirstFileAsText(files)
    if (text == null) return
    setRaw(text)
    setTab("text")
    if (file) setFileName(file.name)
  }

  function clear() {
    setRaw("")
    setFileName(DEFAULT_FILE_NAME)
  }

  function download() {
    const blob = new Blob([raw], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    downloadFile(url, fileName)
    URL.revokeObjectURL(url)
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
        download: { onDownload: download, disabled: !raw.trim() },
      }}
    >
      <div
        className={cn(
          "grid flex-1 gap-4",
          tab === "split" ? "grid-cols-2" : "grid-cols-1"
        )}
      >
        {tab !== "preview" && (
          <PreviewCard
            fill
            title={tab === "split" ? "Edit" : undefined}
            layer={{
              kind: "textinput",
              value: raw,
              onChange: setRaw,
              placeholder:
                "Write Markdown here (your text is not saved anywhere)",
            }}
          />
        )}
        {tab !== "text" && (
          <PreviewCard
            fill
            title={tab === "split" ? "Preview" : undefined}
            layer={
              raw.trim()
                ? { kind: "markdown", html }
                : {
                    kind: "status",
                    message:
                      "Write Markdown in the Edit tab to see it rendered here.",
                  }
            }
          />
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
