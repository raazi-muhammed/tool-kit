"use client"

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BracesIcon,
  CodeIcon,
  Copy01Icon,
  Eraser01Icon,
  HtmlFiveIcon,
  JavaScriptIcon,
  Link01Icon,
  Tick02Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { useMemo, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { ToolPage } from "@/components/tool-page"
import { Textarea } from "@/components/ui/textarea"
import {
  ESCAPE_FORMATS,
  type EscapeDirection,
  type EscapeFormat,
} from "@/lib/text-escape"
import { readFirstFileAsText } from "@/lib/utils"

const FORMAT_ICONS: Record<EscapeFormat, IconSvgElement> = {
  html: HtmlFiveIcon,
  js: JavaScriptIcon,
  json: BracesIcon,
  url: Link01Icon,
}

const DIRECTION_OPTIONS: {
  value: EscapeDirection
  label: string
  icon: IconSvgElement
}[] = [
  { value: "escape", label: "Escape", icon: ArrowRight01Icon },
  { value: "decode", label: "Decode", icon: ArrowLeft01Icon },
]

export default function TextEscaperPage() {
  const [raw, setRaw] = useState("")
  const [format, setFormat] = useState<EscapeFormat>("html")
  const [direction, setDirection] = useState<EscapeDirection>("escape")
  const [copied, setCopied] = useState(false)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const output = useMemo(() => {
    const spec = ESCAPE_FORMATS[format]
    return direction === "escape" ? spec.escape(raw) : spec.unescape(raw)
  }, [raw, format, direction])

  const inputLabel = direction === "escape" ? "Text" : "Escaped"
  const outputLabel = direction === "escape" ? "Escaped" : "Text"

  async function handleFiles(files: FileList | null) {
    const text = await readFirstFileAsText(files)
    if (text != null) setRaw(text)
  }

  function clear() {
    setRaw("")
  }

  async function copyOutput() {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <ToolPage
      page="Text Escaper"
      icon={CodeIcon}
      onAddFile={dropzoneRef}
      segments={{
        value: format,
        onValueChange: (value) => setFormat(value as EscapeFormat),
        label: "Format",
        options: (Object.keys(ESCAPE_FORMATS) as EscapeFormat[]).map(
          (value) => ({
            value,
            label: ESCAPE_FORMATS[value].label,
            icon: FORMAT_ICONS[value],
          })
        ),
      }}
      sidebar={{
        groups: [
          {
            value: direction,
            onValueChange: (value) => setDirection(value as EscapeDirection),
            label: "Direction",
            options: DIRECTION_OPTIONS,
          },
        ],
        actions: [
          {
            label: "Clear",
            icon: Eraser01Icon,
            onClick: clear,
            variant: "outline",
          },
          {
            label: copied ? "Copied" : "Copy output",
            icon: copied ? Tick02Icon : Copy01Icon,
            onClick: copyOutput,
            disabled: !output,
          },
        ],
      }}
    >
      <div className="grid min-h-[60vh] flex-1 grid-cols-2 gap-4">
        <div className="flex min-h-0 flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {inputLabel}
          </span>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`Paste your ${inputLabel.toLowerCase()} here (it is not saved anywhere)`}
            variant="flat"
            className="field-sizing-fixed min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {outputLabel}
          </span>
          <Textarea
            value={output}
            readOnly
            placeholder={`The ${outputLabel.toLowerCase()} text will appear here`}
            variant="flat"
            className="field-sizing-fixed min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
            spellCheck={false}
          />
        </div>
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
