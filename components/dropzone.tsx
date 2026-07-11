"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { ClipboardPasteIcon } from "@hugeicons/core-free-icons"

import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DropzoneHandle = {
  open: () => void
}

function DropzoneImpl(
  {
    icon,
    title,
    description,
    accept,
    multiple,
    onFiles,
    hidden = false,
    className,
  }: {
    icon: IconSvgElement
    title: React.ReactNode
    description: React.ReactNode
    accept?: string
    multiple?: boolean
    onFiles: (files: FileList | null) => void
    /** Keep the hidden file input mounted (for `ref.open()`) without showing the card — e.g. once a file has been picked. */
    hidden?: boolean
    className?: string
  },
  ref: React.ForwardedRef<DropzoneHandle>
) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  React.useImperativeHandle(ref, () => ({
    open: () => inputRef.current?.click(),
  }))

  // Cmd/Ctrl+V anywhere on the page adds files, mirroring drag-and-drop —
  // e.g. pasting a screenshot straight from the clipboard. Kept to a stable
  // mount-once listener (latest onFiles read via a ref) rather than
  // re-subscribing on every render. Only intercepts when the clipboard
  // actually holds files, so pasting text into a tool's own inputs (a PDF
  // password, a resize width) is untouched.
  const onFilesRef = React.useRef(onFiles)
  React.useEffect(() => {
    onFilesRef.current = onFiles
  })

  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = e.clipboardData?.files
      if (!files || files.length === 0) return
      e.preventDefault()
      onFilesRef.current(files)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [])

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ""
        }}
        className="hidden"
      />
      {!hidden && (
        <Attachment
          state="idle"
          size="lg"
          orientation="dropzone"
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            onFiles(e.dataTransfer.files)
          }}
          className={cn(
            "w-full cursor-pointer transition-colors",
            dragging ? "border-primary bg-accent/30" : "hover:bg-muted/20",
            className
          )}
        >
          <AttachmentMedia>
            <HugeiconsIcon icon={icon} aria-hidden />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{title}</AttachmentTitle>
            <AttachmentDescription>{description}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions className="gap-3">
            <Button variant="secondary" type="button">
              Select files
            </Button>
            {/* Not an actual control (paste is triggered by the keyboard
                shortcut, not a click) — styled to match Button so the two
                read as a pair, but rendered as a span rather than a nested
                interactive element inside this card's own role="button". */}
            <Button variant="secondary" type="button">
              <HugeiconsIcon
                icon={ClipboardPasteIcon}
                aria-hidden
                className="size-4"
              />
              Paste
              <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[10px] leading-none text-muted-foreground">
                ⌘V
              </kbd>
            </Button>
          </AttachmentActions>
        </Attachment>
      )}
    </>
  )
}

export const Dropzone = React.forwardRef(DropzoneImpl)
