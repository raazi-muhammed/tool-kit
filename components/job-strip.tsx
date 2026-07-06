"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

export type JobStripItem = {
  id: number
  name: string
  previewUrl: string
}

/**
 * Thumbnail switcher for tools that queue multiple files but edit one at a
 * time (crop, blur). Hidden below two items so the common single-file case
 * stays uncluttered.
 */
export function JobStrip({
  jobs,
  activeId,
  onSelect,
  onRemove,
}: {
  jobs: JobStripItem[]
  activeId: number | null
  onSelect: (id: number) => void
  onRemove: (id: number) => void
}) {
  if (jobs.length < 2) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {jobs.map((job) => (
        <button
          key={job.id}
          type="button"
          onClick={() => onSelect(job.id)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md border p-1.5 pr-2 text-sm transition-colors",
            job.id === activeId
              ? "border-primary bg-accent/40"
              : "hover:bg-muted/40"
          )}
        >
          <span className="size-8 shrink-0 overflow-hidden rounded bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
          <span className="max-w-32 truncate">{job.name}</span>
          <span
            role="button"
            tabIndex={0}
            aria-label={`Remove ${job.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onRemove(job.id)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                onRemove(job.id)
              }
            }}
            className="ml-1 shrink-0 rounded p-0.5 opacity-60 hover:bg-muted hover:opacity-100"
          >
            <HugeiconsIcon icon={Cancel01Icon} aria-hidden className="size-3.5" />
          </span>
        </button>
      ))}
    </div>
  )
}
