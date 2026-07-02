"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import type { JsonValue } from "@/lib/json"

function valueColor(value: JsonValue) {
  if (value === null) return "text-muted-foreground"
  switch (typeof value) {
    case "string":
      return "text-emerald-600 dark:text-emerald-400"
    case "number":
      return "text-blue-600 dark:text-blue-400"
    case "boolean":
      return "text-amber-600 dark:text-amber-400"
    default:
      return ""
  }
}

function formatPrimitive(value: JsonValue) {
  if (value === null) return "null"
  if (typeof value === "string") return `"${value}"`
  return String(value)
}

function JsonNode({
  label,
  value,
  depth,
  defaultOpen,
}: {
  label: string | null
  value: JsonValue
  depth: number
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isArray = Array.isArray(value)
  const isObject = !isArray && value !== null && typeof value === "object"
  const isCollapsible = isArray || isObject

  if (!isCollapsible) {
    return (
      <div className="flex items-start gap-1 py-0.5" style={{ paddingLeft: depth * 16 }}>
        <span className="w-3 shrink-0" />
        {label !== null && <span className="text-foreground/70">{label}:</span>}
        <span className={cn("break-all", valueColor(value))}>{formatPrimitive(value)}</span>
      </div>
    )
  }

  const entries = isArray
    ? (value as JsonValue[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, JsonValue>)
  const count = entries.length
  const brackets = isArray ? ["[", "]"] : ["{", "}"]

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-1 rounded py-0.5 text-left hover:bg-accent"
        style={{ paddingLeft: depth * 16 }}
      >
        <ChevronRight
          className={cn("mt-0.5 size-3 shrink-0 transition-transform", open && "rotate-90")}
        />
        {label !== null && <span className="text-foreground/70">{label}:</span>}
        <span className="text-muted-foreground">
          {brackets[0]}
          {!open && (
            <>
              {" "}
              {count} {isArray ? "item" : "key"}
              {count === 1 ? "" : "s"}{" "}
            </>
          )}
          {!open && brackets[1]}
        </span>
      </button>
      {open && (
        <div>
          {entries.map(([key, v]) => (
            <JsonNode
              key={key}
              label={isArray ? null : key}
              value={v}
              depth={depth + 1}
              defaultOpen={depth < 1}
            />
          ))}
          <div className="text-muted-foreground" style={{ paddingLeft: depth * 16 + 16 }}>
            {brackets[1]}
          </div>
        </div>
      )}
    </div>
  )
}

export function JsonTree({ data }: { data: JsonValue }) {
  return (
    <div className="font-mono text-xs">
      <JsonNode label={null} value={data} depth={0} defaultOpen />
    </div>
  )
}
