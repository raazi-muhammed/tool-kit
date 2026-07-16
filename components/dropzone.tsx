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
  /** Reads image or text data off the system clipboard (Clipboard API) and feeds it through the same `onFiles` path as a pick or drop. Fails silently (console.error) if the browser denies clipboard access or the clipboard holds nothing usable. */
  paste: () => Promise<void>
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
    paste: async () => {
      // Derives a filename extension from this dropzone's own `accept` (e.g.
      // ".env,text/plain" -> "env") so a pasted text clipboard item gets a
      // name the tool's own file handling expects, instead of a generic
      // ".txt" it might not recognize.
      const acceptExtension = accept
        ?.split(",")
        .map((token) => token.trim())
        .find((token) => token.startsWith("."))
        ?.slice(1)

      try {
        const items = await navigator.clipboard.read()
        const dataTransfer = new DataTransfer()
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith("image/"))
          if (imageType) {
            const blob = await item.getType(imageType)
            const ext = imageType.split("/")[1] ?? "png"
            dataTransfer.items.add(
              new File([blob], `pasted.${ext}`, { type: imageType })
            )
            continue
          }
          if (item.types.includes("text/plain")) {
            const blob = await item.getType("text/plain")
            dataTransfer.items.add(
              new File([blob], `pasted.${acceptExtension ?? "txt"}`, {
                type: "text/plain",
              })
            )
          }
        }
        if (dataTransfer.files.length === 0) return
        onFiles(dataTransfer.files)
      } catch (error) {
        console.error("Failed to paste from clipboard", error)
      }
    },
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

  // Once a file's picked, the dropzone card itself unmounts (`hidden`) so
  // its own onDrop handler is gone — without this, dragging another file in
  // has nowhere to land. Mirrors the paste listener above: a stable,
  // mount-once window listener reading the latest `hidden`/`onFiles` via
  // refs, active only while `hidden` (the visible card already handles the
  // not-hidden case itself, so this stays out of its way).
  const hiddenRef = React.useRef(hidden)
  React.useEffect(() => {
    hiddenRef.current = hidden
  })
  const dragCounter = React.useRef(0)
  const [draggingOverPage, setDraggingOverPage] = React.useState(false)

  React.useEffect(() => {
    function hasFiles(e: DragEvent) {
      return !!e.dataTransfer?.types.includes("Files")
    }
    function onDragEnter(e: DragEvent) {
      if (!hiddenRef.current || !hasFiles(e)) return
      e.preventDefault()
      dragCounter.current += 1
      setDraggingOverPage(true)
    }
    function onDragOver(e: DragEvent) {
      if (!hiddenRef.current || !hasFiles(e)) return
      e.preventDefault()
    }
    function onDragLeave() {
      if (!hiddenRef.current) return
      dragCounter.current = Math.max(0, dragCounter.current - 1)
      if (dragCounter.current === 0) setDraggingOverPage(false)
    }
    function onDrop(e: DragEvent) {
      dragCounter.current = 0
      setDraggingOverPage(false)
      if (!hiddenRef.current) return
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      e.preventDefault()
      onFilesRef.current(files)
    }
    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDrop)
    }
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
            dragging && "border-primary bg-accent/30",
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
      {hidden && draggingOverPage && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-background/80">
          <div className="border-2 border-dashed fixed border-primary inset-12 rounded-xl flex items-center justify-center ">
          <div className="flex items-center gap-2 text-lg font-medium text-foreground">
            <HugeiconsIcon icon={icon} aria-hidden className="size-6" />
            Drop to add file
          </div>
          </div>
        </div>
      )}
    </>
  )
}

export const Dropzone = React.forwardRef(DropzoneImpl)
