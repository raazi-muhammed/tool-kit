"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
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
            dragging ? "border-primary bg-accent/50" : "hover:bg-muted/50",
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
          <AttachmentActions>
            <Button variant="secondary" type="button">
              Select files
            </Button>
          </AttachmentActions>
        </Attachment>
      )}
    </>
  )
}

export const Dropzone = React.forwardRef(DropzoneImpl)
