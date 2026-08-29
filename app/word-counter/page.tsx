"use client"

import {
  Clock01Icon,
  Eraser01Icon,
  TextAlignLeftIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { useMemo, useRef, useState } from "react"

import { Dropzone, type DropzoneHandle } from "@/components/dropzone"
import { PreviewCard } from "@/components/preview-card"
import { StatSection } from "@/components/stat-tile"
import { ToolPage } from "@/components/tool-page"
import { readFirstFileAsText } from "@/lib/utils"
import { computeTextStats, formatDuration } from "@/lib/word-count"

export default function WordCounterPage() {
  const [text, setText] = useState("")
  const dropzoneRef = useRef<DropzoneHandle>(null)

  const stats = useMemo(() => computeTextStats(text), [text])

  async function handleFiles(files: FileList | null) {
    const value = await readFirstFileAsText(files)
    if (value != null) setText(value)
  }

  function clear() {
    setText("")
  }

  return (
    <ToolPage
      page="Word Counter"
      icon={TextAlignLeftIcon}
      onAddFile={dropzoneRef}
      sidebar={{
        hint: (
          <div className="flex flex-col gap-6">
            <StatSection
              icon={TextAlignLeftIcon}
              label="Counting"
              tiles={[
                { label: "characters", value: String(stats.characters) },
                { label: "words", value: String(stats.words) },
                { label: "sentences", value: String(stats.sentences) },
                { label: "paragraphs", value: String(stats.paragraphs) },
              ]}
            />
            <StatSection
              icon={Clock01Icon}
              label="Time"
              tiles={[
                { label: "reading", value: formatDuration(stats.readingSeconds) },
                { label: "speaking", value: formatDuration(stats.speakingSeconds) },
              ]}
            />
          </div>
        ),
        actions: [
          {
            label: "Clear",
            icon: Eraser01Icon,
            onClick: clear,
            variant: "card",
            disabled: !text,
          },
        ],
      }}
    >
      <PreviewCard
        fill
        layer={{
          kind: "textinput",
          value: text,
          onChange: setText,
          placeholder:
            "Type or paste text here to count characters, words, sentences, and paragraphs (it is not saved anywhere)",
        }}
      />

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
