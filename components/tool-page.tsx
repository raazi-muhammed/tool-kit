"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { Copy01Icon, Eraser01Icon, SparklesIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { useState } from "react"
import type { ReactNode } from "react"

import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Segments = {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string; icon: IconSvgElement }[]
  disabled?: boolean
}

export function ToolPage({
  page,
  icon,
  onCopy,
  onLoadSample,
  onClear,
  segments,
  actions,
  children,
}: {
  page: string
  icon: IconSvgElement
  onCopy?: () => void
  onLoadSample?: () => void
  onClear: () => void
  segments?: Segments
  actions?: ReactNode
  children: ReactNode
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    onCopy?.()
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <PageBreadcrumb page={page} icon={icon} />

      <div className="flex flex-wrap items-center gap-2">
        {segments && (
          <Tabs value={segments.value} onValueChange={segments.onValueChange}>
            <TabsList>
              {segments.options.map((option) => (
                <TabsTrigger key={option.value} value={option.value} disabled={segments.disabled}>
                  <HugeiconsIcon icon={option.icon} aria-hidden />
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        {actions}
        <div className="ml-auto flex items-center gap-2">
          {onCopy && (
            <Button variant="secondary" onClick={handleCopy}>
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} aria-hidden />
              Copy
            </Button>
          )}
          {onLoadSample && (
            <Button variant="secondary" onClick={onLoadSample}>
              <HugeiconsIcon icon={SparklesIcon} aria-hidden />
              Load sample
            </Button>
          )}
          <Button variant="ghost" onClick={onClear}>
            <HugeiconsIcon icon={Eraser01Icon} aria-hidden />
            Clear
          </Button>
        </div>
      </div>

      {children}
    </div>
  )
}
