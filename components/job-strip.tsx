"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { formatBytes } from "@/lib/wav"
import { cn } from "@/lib/utils"

export type JobStripItem = {
  id: number
  name: string
  previewUrl: string
  // Shown as the chip's second line (e.g. "1.4 MB") when present.
  file?: File
}

/**
 * Thumbnail switcher for tools that queue files — shown for the active job
 * too (not just once a second file is queued), so its own per-chip remove
 * button is always the one way to drop a file.
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
  if (jobs.length < 1) return null

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="shrink-0 text-xs text-muted-foreground">
        <div className="font-medium tracking-widest uppercase">Files</div>
        <div>{jobs.length} {jobs.length === 1 ? "item" : "items"}</div>
      </div>

      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {jobs.map((job) => {
          const active = job.id === activeId
          return (
            <button
              key={job.id}
              type="button"
              onClick={() => onSelect(job.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl border p-2 pr-3 text-left transition-colors",
                active
                  ? "border-primary/30 bg-primary/10"
                  : "border-transparent bg-muted/40 hover:bg-muted/60"
              )}
            >
              {active && <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden />}
              <span className="size-9 shrink-0 overflow-hidden rounded bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={job.previewUrl} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="max-w-36 truncate text-sm text-foreground">{job.name}</span>
                {job.file && (
                  <span className="text-xs text-muted-foreground">{formatBytes(job.file.size)}</span>
                )}
              </span>
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
          )
        })}
      </div>
    </div>
  )
}
