"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
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
  /** Heading shown above the control once it renders in the sidebar (e.g. "Blur Type"). */
  label?: string
  /**
   * Where the control renders. `"sidebar"` (default) is for a setting that
   * configures a transform (blur type, aspect ratio, format). `"inline"` is
   * for a view switch that changes what `children` renders (e.g. JSON
   * Parser's Text/Viewer) — keeping it next to the content it swaps instead
   * of moving it into the sidebar, away from what it controls.
   */
  placement?: "sidebar" | "inline"
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
  /** Suffix shown next to the live value readout (e.g. "px"). */
  unit?: string
}

type FooterAction = {
  label: string
  icon: IconSvgElement
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "outline" | "ghost" | "secondary"
  // A secondary "do this to every job" option (e.g. "Apply blur to all"),
  // rendered as a Download-style ButtonGroup + dropdown chevron instead of a
  // separate button.
  more?: {
    label: string
    icon: IconSvgElement
    onClick: () => void
    disabled?: boolean
  }
  /**
   * `"primary"` (default) renders full-width in the sidebar's pinned action
   * stack, alongside Download. `"secondary"` renders smaller, at natural
   * width, in a row above that stack (e.g. a momentary "Cancel selection" or
   * a pressed/unpressed toggle button) — set explicitly per action rather
   * than inferred from `variant`, since a toggle's `variant` can itself
   * change between "secondary"/"outline" depending on its pressed state.
   */
  emphasis?: "primary" | "secondary"
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
  /** Muted contextual text (e.g. "No transparent margin to trim.") shown in the sidebar. */
  hint?: ReactNode
  actions?: (FooterAction | false | null | undefined)[]
  download?: FooterDownload
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
      {children}
    </span>
  )
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
  fileStrip,
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
  /** A `JobStrip` (or similar) element, rendered in the bottom bar next to zoom controls and Add file. */
  fileStrip?: ReactNode
  footer?: Footer
  children: ReactNode
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    onCopy?.()
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const inlineSegments = segments?.placement === "inline" ? segments : undefined
  const sidebarSegments = segments && segments.placement !== "inline" ? segments : undefined

  const hasHeaderRow = !!(actions || onCopy || onLoadSample || onClear)
  const hasBottomBar = !!(fileStrip || onAddFile)
  const hasSidebar = !!(sidebarSegments || footer)

  const allActions = (footer?.actions ?? []).filter((action): action is FooterAction => !!action)
  const secondaryActions = allActions.filter((action) => action.emphasis === "secondary")
  const primaryActions = allActions.filter((action) => action.emphasis !== "secondary")
  const hasSidebarFooterBlock = allActions.length > 0 || !!footer?.download

  return (
    <div className="flex min-h-svh">
      <div className="mx-auto flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageBreadcrumb page={page} icon={icon} />

        {inlineSegments && (
          <Tabs value={inlineSegments.value} onValueChange={inlineSegments.onValueChange}>
            <TabsList>
              {inlineSegments.options.map((option) => (
                <TabsTrigger key={option.value} value={option.value} disabled={inlineSegments.disabled}>
                  <HugeiconsIcon icon={option.icon} aria-hidden />
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {hasHeaderRow && (
          <div className="flex flex-wrap items-center gap-2">
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
                <IconTooltip label="Clear">
                  <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear">
                    <HugeiconsIcon icon={Eraser01Icon} aria-hidden />
                  </Button>
                </IconTooltip>
              )}
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-4">{children}</div>

        {hasBottomBar && (
          <div className="flex min-h-11 items-center gap-4">
            {fileStrip && <div className="min-w-0 flex-1">{fileStrip}</div>}

            {onAddFile && (
              <Button variant="secondary" onClick={onAddFile} className="ml-auto">
                <HugeiconsIcon icon={Add01Icon} aria-hidden />
                Add file
              </Button>
            )}
          </div>
        )}
      </div>

      {hasSidebar && (
        <div className="flex w-80 shrink-0 flex-col border-l bg-card">
          <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6">
            {footer?.zoom && (
              <div className="flex flex-col gap-3">
                <SidebarLabel>Zoom</SidebarLabel>
                <div className="flex w-full items-center gap-2">
                  <div className="flex flex-1 items-center justify-between rounded-lg bg-muted">
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
                    <span className="text-center text-sm text-muted-foreground">
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
                  </div>
                  <div className="shrink-0 rounded-lg bg-muted">
                    <IconTooltip label="Fit to screen">
                      <Button variant="ghost" onClick={footer.zoom.onFit} aria-label="Fit to screen">
                        <HugeiconsIcon icon={FitToScreenIcon} aria-hidden />
                      </Button>
                    </IconTooltip>
                  </div>
                </div>
              </div>
            )}

            {sidebarSegments && (
              <div className="flex flex-col gap-3">
                {sidebarSegments.label && <SidebarLabel>{sidebarSegments.label}</SidebarLabel>}
                {/* A handful of options (Blur Type, Format, …) should split the
                    row evenly, matching the mockup and the default Tabs look
                    used elsewhere — only a crowded row (image-crop's 6-option
                    aspect picker) needs to wrap to natural-width chips instead
                    of being squeezed into equal slices. */}
                {sidebarSegments.options.length > 3 ? (
                  <Tabs value={sidebarSegments.value} onValueChange={sidebarSegments.onValueChange}>
                    <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
                      {sidebarSegments.options.map((option) => (
                        <TabsTrigger
                          key={option.value}
                          value={option.value}
                          disabled={sidebarSegments.disabled}
                          className="flex-none"
                        >
                          <HugeiconsIcon icon={option.icon} aria-hidden />
                          {option.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                ) : (
                  <Tabs value={sidebarSegments.value} onValueChange={sidebarSegments.onValueChange}>
                    <TabsList className="w-full">
                      {sidebarSegments.options.map((option) => (
                        <TabsTrigger
                          key={option.value}
                          value={option.value}
                          disabled={sidebarSegments.disabled}
                        >
                          <HugeiconsIcon icon={option.icon} aria-hidden />
                          {option.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}
              </div>
            )}

            {footer?.color && (
              <div className="flex flex-col gap-3">
                <SidebarLabel>{footer.color.label}</SidebarLabel>
                <div className="flex items-center gap-2">
                  <ColorPicker
                    value={footer.color.value ?? footer.color.fallback}
                    onChange={(value) => footer.color!.onChange(value)}
                    label={footer.color.label}
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
              </div>
            )}

            {footer?.toggle && (
              <div className="flex flex-col gap-3">
                <Button
                  variant={footer.toggle.pressed ? "secondary" : "outline"}
                  aria-pressed={footer.toggle.pressed}
                  onClick={() => footer.toggle!.onPressedChange(!footer.toggle!.pressed)}
                  className="w-full"
                >
                  <HugeiconsIcon icon={footer.toggle.icon} aria-hidden />
                  {footer.toggle.label}
                </Button>
                {footer.toggle.pressed && footer.toggle.color && (
                  <ColorPicker
                    value={footer.toggle.color.value}
                    onChange={footer.toggle.color.onChange}
                    label={footer.toggle.color.label}
                  />
                )}
                {footer.toggle.pressed && footer.toggle.slider && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {footer.toggle.slider.label}
                      </span>
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
                    </div>
                    <Slider
                      value={[footer.toggle.slider.value]}
                      onValueChange={([value]) => footer.toggle!.slider!.onValueChange(value)}
                      min={footer.toggle.slider.min}
                      max={footer.toggle.slider.max}
                      step={footer.toggle.slider.step ?? 1}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            )}

            {footer?.inputs?.map((input, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <SidebarLabel>{input.label}</SidebarLabel>
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
                  className={input.className ?? "w-full"}
                />
              </div>
            ))}

            {footer?.slider && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <SidebarLabel>{footer.slider.label}</SidebarLabel>
                  <span className="flex items-baseline gap-0.5">
                    <input
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
                      className="w-10 border-none bg-transparent p-0 text-right text-sm font-medium text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    {footer.slider.unit && (
                      <span className="text-sm text-muted-foreground">{footer.slider.unit}</span>
                    )}
                  </span>
                </div>
                <Slider
                  value={[footer.slider.value]}
                  onValueChange={([value]) => footer.slider!.onValueChange(value)}
                  min={footer.slider.min}
                  max={footer.slider.max}
                  step={footer.slider.step ?? 1}
                  disabled={footer.slider.disabled}
                  className="w-full"
                />
              </div>
            )}

            {footer?.hint && <span className="text-sm text-muted-foreground">{footer.hint}</span>}
          </div>

          {hasSidebarFooterBlock && (
            <div className="flex shrink-0 flex-col gap-3 border-t p-6">
              {secondaryActions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {secondaryActions.map((action, index) => (
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
                </div>
              )}

              {primaryActions.map((action, index) =>
                action.more ? (
                  <ButtonGroup key={index} className="w-full">
                    <Button
                      variant={action.variant}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="flex-1"
                    >
                      <HugeiconsIcon icon={action.icon} aria-hidden />
                      {action.label}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={action.variant}
                          size="icon"
                          aria-label={`More ${action.label.toLowerCase()} options`}
                        >
                          <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-max">
                        <DropdownMenuItem
                          onClick={action.more.onClick}
                          disabled={action.more.disabled}
                        >
                          <HugeiconsIcon icon={action.more.icon} aria-hidden />
                          {action.more.label}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ButtonGroup>
                ) : (
                  <Button
                    key={index}
                    variant={action.variant}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="w-full"
                  >
                    <HugeiconsIcon icon={action.icon} aria-hidden />
                    {action.label}
                  </Button>
                )
              )}

              {footer?.download && (
                <ButtonGroup className="w-full">
                  <Button
                    variant="secondary"
                    onClick={footer.download.onDownload}
                    disabled={footer.download.disabled}
                    className="flex-1"
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
                      <DropdownMenuContent align="end" className="w-max">
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
          )}
        </div>
      )}
    </div>
  )
}
