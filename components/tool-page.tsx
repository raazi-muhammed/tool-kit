"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  CloudUploadIcon,
  Copy01Icon,
  Download04Icon,
  Eraser01Icon,
  FitToScreenIcon,
  SparklesIcon,
  Tick02Icon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons"
import { useState } from "react"
import type { ReactNode } from "react"

import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Segments = {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string; icon: IconSvgElement }[]
  disabled?: boolean
}

type FooterZoom = {
  percent: number
  onZoomOut: () => void
  onZoomIn: () => void
  onFit: () => void
  zoomOutDisabled?: boolean
  zoomInDisabled?: boolean
}

type FooterSlider = {
  label: string
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step?: number
}

type FooterAction = {
  label: string
  icon: IconSvgElement
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "outline" | "ghost" | "secondary"
}

type FooterDownload = {
  onDownload: () => void
  disabled?: boolean
  onDownloadAll?: () => void
  downloadAllDisabled?: boolean
}

type Footer = {
  zoom?: FooterZoom
  slider?: FooterSlider
  actions?: (FooterAction | false | null | undefined)[]
  download?: FooterDownload
}

export function ToolPage({
  page,
  icon,
  onCopy,
  onLoadSample,
  onAddFile,
  onClear,
  segments,
  actions,
  footer,
  children,
}: {
  page: string
  icon: IconSvgElement
  onCopy?: () => void
  onLoadSample?: () => void
  onAddFile?: () => void
  onClear: () => void
  segments?: Segments
  actions?: ReactNode
  footer?: Footer
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
        {onAddFile && (
          <Button variant="outline" onClick={onAddFile}>
            <HugeiconsIcon icon={CloudUploadIcon} aria-hidden />
            Add file
          </Button>
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

      {footer && (
        <div className="flex flex-wrap items-center gap-4">
          {footer.zoom && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={footer.zoom.onZoomOut}
                disabled={footer.zoom.zoomOutDisabled}
                aria-label="Zoom out"
              >
                <HugeiconsIcon icon={ZoomOutAreaIcon} aria-hidden />
              </Button>
              <span className="w-12 text-center text-sm text-muted-foreground">
                {footer.zoom.percent}%
              </span>
              <Button
                variant="ghost"
                onClick={footer.zoom.onZoomIn}
                disabled={footer.zoom.zoomInDisabled}
                aria-label="Zoom in"
              >
                <HugeiconsIcon icon={ZoomInAreaIcon} aria-hidden />
              </Button>
              <Button variant="ghost" onClick={footer.zoom.onFit} aria-label="Fit to screen">
                <HugeiconsIcon icon={FitToScreenIcon} aria-hidden />
              </Button>
            </div>
          )}

          {footer.slider && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{footer.slider.label}</span>
              <Slider
                value={[footer.slider.value]}
                onValueChange={([value]) => footer.slider!.onValueChange(value)}
                min={footer.slider.min}
                max={footer.slider.max}
                step={footer.slider.step ?? 1}
                className="min-w-32 max-w-32"
              />
              <Input
                type="number"
                value={footer.slider.value}
                onChange={(e) => {
                  const parsed = Number(e.target.value)
                  if (!Number.isFinite(parsed)) return
                  footer.slider!.onValueChange(
                    Math.min(footer.slider!.max, Math.max(footer.slider!.min, parsed))
                  )
                }}
                min={footer.slider.min}
                max={footer.slider.max}
                step={footer.slider.step ?? 1}
                className="h-8 w-14 px-2 text-right"
              />
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-4">
            {footer.actions
              ?.filter((action): action is FooterAction => !!action)
              .map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  <HugeiconsIcon icon={action.icon} aria-hidden />
                  {action.label}
                </Button>
              ))}

            {footer.download && (
              <ButtonGroup>
                <Button
                  variant="secondary"
                  onClick={footer.download.onDownload}
                  disabled={footer.download.disabled}
                >
                  <HugeiconsIcon icon={Download04Icon} aria-hidden />
                  Download
                </Button>
                {footer.download.onDownloadAll && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" aria-label="More download options">
                        <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={footer.download.onDownloadAll}
                        disabled={footer.download.downloadAllDisabled}
                      >
                        <HugeiconsIcon icon={Download04Icon} aria-hidden />
                        Download all
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </ButtonGroup>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
