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

import { ColorPicker } from "@/components/color-picker"
import { IconTooltip } from "@/components/icon-tooltip"
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
  disabled?: boolean
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

// A color swatch that can also be "unset" (e.g. a transparent background) —
// rendered as a ColorPicker plus a clear button, or a muted label when unset.
type FooterColor = {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  fallback: string
  onPickFromImage?: () => void
  nullLabel?: string
  clearLabel?: string
  clearIcon?: IconSvgElement
}

// A pressable toggle (e.g. "Remove background") that reveals its own color
// picker and/or strength slider only while pressed.
type FooterToggle = {
  label: string
  icon: IconSvgElement
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  color?: {
    label: string
    value: string
    onChange: (value: string) => void
    onPickFromImage?: () => void
  }
  slider?: FooterSlider
}

// A single labeled text/number/password field (e.g. a resize width, a PDF
// password) — rendered label-above-input, matching the app's form fields.
type FooterInput = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "number" | "password"
  disabled?: boolean
  min?: number
  className?: string
  onEnter?: () => void
}

type Footer = {
  color?: FooterColor
  toggle?: FooterToggle
  inputs?: FooterInput[]
  zoom?: FooterZoom
  slider?: FooterSlider
  /** Muted contextual text (e.g. "No transparent margin to trim.") shown inline with the footer, left of the right-aligned actions/download group. */
  hint?: ReactNode
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
  onClear?: () => void
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
    <div className="mx-auto flex min-h-svh max-w-7xl flex-col gap-4 p-6">
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
          {onClear && (
            <Button variant="ghost" onClick={onClear}>
              <HugeiconsIcon icon={Eraser01Icon} aria-hidden />
              Clear
            </Button>
          )}
        </div>
      </div>

      {children}

      {footer && (
        <div className="flex flex-wrap items-center gap-4">
          {footer.color && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{footer.color.label}</span>
              <ColorPicker
                value={footer.color.value ?? footer.color.fallback}
                onChange={(value) => footer.color!.onChange(value)}
                label={footer.color.label}
                onPickFromImage={footer.color.onPickFromImage}
              />
              {footer.color.value ? (
                <Button variant="ghost" onClick={() => footer.color!.onChange(null)}>
                  {footer.color.clearIcon && (
                    <HugeiconsIcon icon={footer.color.clearIcon} aria-hidden />
                  )}
                  {footer.color.clearLabel ?? "Clear"}
                </Button>
              ) : (
                footer.color.nullLabel && (
                  <span className="text-sm text-muted-foreground">{footer.color.nullLabel}</span>
                )
              )}
            </div>
          )}

          {footer.toggle && (
            <div className="flex items-center gap-2">
              <Button
                variant={footer.toggle.pressed ? "secondary" : "outline"}
                aria-pressed={footer.toggle.pressed}
                onClick={() => footer.toggle!.onPressedChange(!footer.toggle!.pressed)}
              >
                <HugeiconsIcon icon={footer.toggle.icon} aria-hidden />
                {footer.toggle.label}
              </Button>
              {footer.toggle.pressed && footer.toggle.color && (
                <ColorPicker
                  value={footer.toggle.color.value}
                  onChange={footer.toggle.color.onChange}
                  label={footer.toggle.color.label}
                  onPickFromImage={footer.toggle.color.onPickFromImage}
                />
              )}
              {footer.toggle.pressed && footer.toggle.slider && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {footer.toggle.slider.label}
                  </span>
                  <Slider
                    value={[footer.toggle.slider.value]}
                    onValueChange={([value]) => footer.toggle!.slider!.onValueChange(value)}
                    min={footer.toggle.slider.min}
                    max={footer.toggle.slider.max}
                    step={footer.toggle.slider.step ?? 1}
                    className="min-w-24 max-w-32"
                  />
                  <Input
                    type="number"
                    value={footer.toggle.slider.value}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      if (!Number.isFinite(parsed)) return
                      const { min, max } = footer.toggle!.slider!
                      footer.toggle!.slider!.onValueChange(Math.min(max, Math.max(min, parsed)))
                    }}
                    min={footer.toggle.slider.min}
                    max={footer.toggle.slider.max}
                    step={footer.toggle.slider.step ?? 1}
                    className="h-8 w-14 px-2 text-right"
                  />
                </>
              )}
            </div>
          )}

          {footer.inputs?.map((input, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">{input.label}</span>
              <Input
                type={input.type ?? "text"}
                min={input.min}
                value={input.value}
                onChange={(e) => input.onChange(e.target.value)}
                disabled={input.disabled}
                autoComplete="off"
                onKeyDown={
                  input.onEnter
                    ? (e) => {
                        if (e.key === "Enter") input.onEnter!()
                      }
                    : undefined
                }
                className={input.className ?? "w-28"}
              />
            </div>
          ))}

          {footer.zoom && (
            <div className="flex items-center gap-1">
              <IconTooltip label="Zoom out">
                <Button
                  variant="ghost"
                  onClick={footer.zoom.onZoomOut}
                  disabled={footer.zoom.zoomOutDisabled}
                  aria-label="Zoom out"
                >
                  <HugeiconsIcon icon={ZoomOutAreaIcon} aria-hidden />
                </Button>
              </IconTooltip>
              <span className="w-12 text-center text-sm text-muted-foreground">
                {footer.zoom.percent}%
              </span>
              <IconTooltip label="Zoom in">
                <Button
                  variant="ghost"
                  onClick={footer.zoom.onZoomIn}
                  disabled={footer.zoom.zoomInDisabled}
                  aria-label="Zoom in"
                >
                  <HugeiconsIcon icon={ZoomInAreaIcon} aria-hidden />
                </Button>
              </IconTooltip>
              <IconTooltip label="Fit to screen">
                <Button variant="ghost" onClick={footer.zoom.onFit} aria-label="Fit to screen">
                  <HugeiconsIcon icon={FitToScreenIcon} aria-hidden />
                </Button>
              </IconTooltip>
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
                disabled={footer.slider.disabled}
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
                disabled={footer.slider.disabled}
                className="h-8 w-14 px-2 text-right"
              />
            </div>
          )}

          {footer.hint && <span className="text-sm text-muted-foreground">{footer.hint}</span>}

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
