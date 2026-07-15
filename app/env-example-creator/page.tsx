"use client"

import {
  Eraser01Icon,
  Key01Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { useMemo, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { ToolPage } from "@/components/tool-page"
import { Textarea } from "@/components/ui/textarea"
import { generateEnvExample } from "@/lib/env-example"
import { readFirstFileAsText } from "@/lib/utils"

export default function EnvExampleCreatorPage() {
  const [raw, setRaw] = useState("")
  const [stripComments, setStripComments] = useState(false)
  const [onlyCommentedAssignments, setOnlyCommentedAssignments] =
    useState(false)
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const output = useMemo(
    () => generateEnvExample(raw, { stripComments, onlyCommentedAssignments }),
    [raw, stripComments, onlyCommentedAssignments]
  )
  async function handleFiles(files: FileList | null) {
    const text = await readFirstFileAsText(files)
    if (text != null) setRaw(text)
  }

  function clear() {
    setRaw("")
  }

  return (
    <ToolPage
      page=".env.example Creator"
      icon={Key01Icon}
      onAddFile={dropzoneRef}
      sidebar={{
        toggle: {
          label: "Remove commented-out lines",
          pressed: stripComments,
          onPressedChange: setStripComments,
          checkbox: {
            label: "Only remove commented out assignment",
            checked: onlyCommentedAssignments,
            onCheckedChange: setOnlyCommentedAssignments,
          },
        },
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
      <div className="grid min-h-[60vh] flex-1 grid-cols-2 gap-4">
        <div className="flex min-h-0 flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Your .env
          </span>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste your .env contents here (your values are not saved anywhere)"
            variant="flat"
            className="field-sizing-fixed min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card/40 p-4 font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            .env.example
          </span>
          <Textarea
            value={output}
            readOnly
            placeholder="The generated .env.example will appear here"
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
        title="Drag and drop a .env file to upload"
        description="or, click to browse · your file is not saved anywhere"
        accept=".env,text/plain"
        onFiles={handleFiles}
      />
    </ToolPage>
  )
}
