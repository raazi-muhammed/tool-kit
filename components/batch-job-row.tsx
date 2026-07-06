"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Cancel01Icon,
  Download04Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import type { ReactNode } from "react"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"

export type BatchStatus =
  | { state: "idle"; icon: IconSvgElement; title: ReactNode; description: ReactNode }
  | { state: "processing"; title: ReactNode }
  | { state: "error"; title: ReactNode; description: ReactNode }
  | {
      state: "done"
      icon: IconSvgElement
      title: ReactNode
      description: ReactNode
      download: { url: string; name: string }
    }

/**
 * One row in a batch-processing tool: the source file (left) and its
 * current status/output (right), side by side. Shared by every tool that
 * queues several files and processes each independently — the state
 * machine and copy stay with the tool, only this markup is shared.
 */
export function BatchJobRow({
  name,
  onRemove,
  sourceIcon,
  sourceImageUrl,
  sourceDescription,
  status,
}: {
  name: string
  onRemove: () => void
  /** Icon shown when there's no image preview (e.g. PDFs, invalid files). */
  sourceIcon: IconSvgElement
  /** Object URL for an image thumbnail; omit to fall back to `sourceIcon`. */
  sourceImageUrl?: string
  sourceDescription: ReactNode
  status: BatchStatus
}) {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-2">
      <Attachment className="h-full w-full">
        <AttachmentMedia variant={sourceImageUrl ? "image" : "icon"}>
          {sourceImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sourceImageUrl} alt={name} />
          ) : (
            <HugeiconsIcon icon={sourceIcon} aria-hidden />
          )}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{name}</AttachmentTitle>
          <AttachmentDescription>{sourceDescription}</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label={`Remove ${name}`} onClick={onRemove}>
            <HugeiconsIcon icon={Cancel01Icon} aria-hidden />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>

      {status.state === "processing" ? (
        <Attachment state="processing" className="h-full w-full">
          <AttachmentMedia>
            <HugeiconsIcon icon={Loading03Icon} aria-hidden className="animate-spin" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{status.title}</AttachmentTitle>
            <AttachmentDescription>Working in your browser…</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      ) : status.state === "error" ? (
        <Attachment state="error" className="h-full w-full">
          <AttachmentMedia>
            <HugeiconsIcon icon={AlertCircleIcon} aria-hidden />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{status.title}</AttachmentTitle>
            <AttachmentDescription className="whitespace-normal">
              {status.description}
            </AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      ) : status.state === "done" ? (
        <Attachment state="done" className="h-full w-full">
          <AttachmentMedia>
            <HugeiconsIcon icon={status.icon} aria-hidden />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{status.title}</AttachmentTitle>
            <AttachmentDescription>{status.description}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <Button asChild variant="secondary" size="icon">
              <a
                href={status.download.url}
                download={status.download.name}
                aria-label={`Download ${status.download.name}`}
              >
                <HugeiconsIcon icon={Download04Icon} aria-hidden />
              </a>
            </Button>
          </AttachmentActions>
        </Attachment>
      ) : (
        <Attachment state="idle" className="h-full w-full">
          <AttachmentMedia>
            <HugeiconsIcon icon={status.icon} aria-hidden />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{status.title}</AttachmentTitle>
            <AttachmentDescription>{status.description}</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      )}
    </div>
  )
}
