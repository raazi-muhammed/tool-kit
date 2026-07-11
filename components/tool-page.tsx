"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  Copy01Icon,
  Download04Icon,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

// A segmented picker rendered inside the sidebar alongside a tool's other
// settings — use this instead of the top-level `segments` prop when the
// value is per-job (e.g. Image Converter's per-file output format) rather
// than one shared page-level setting.
type SidebarSegments = {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string; icon: IconSvgElement }[]
  disabled?: boolean
  /** Heading shown above the control (e.g. "Format"). */
  label?: string
}

type SidebarZoom = {
  percent: number
  onZoomOut: () => void
  onZoomIn: () => void
  onFit: () => void
  zoomOutDisabled?: boolean
  zoomInDisabled?: boolean
}

type SidebarSlider = {
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

type SidebarAction = {
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

type SidebarDownload = {
  onDownload: () => void
  disabled?: boolean
  onDownloadAll?: () => void
  downloadAllDisabled?: boolean
}

// A color swatch that can also be "unset" (e.g. a transparent background) —
// rendered as a ColorPicker plus a clear button, or a muted label when unset.
type SidebarColor = {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  fallback: string
  nullLabel?: string
  clearLabel?: string
  clearIcon?: IconSvgElement
  /** Set false to skip the visible label row (e.g. a toggle's nested color, where the toggle's own label already says what it's for). `label` is still used as the ColorPicker's aria-label. */
  showLabel?: boolean
}

// A pressable toggle (e.g. "Remove background") that reveals its own color
// picker and/or strength slider only while pressed.
type SidebarToggle = {
  label: string
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  color?: {
    label: string
    value: string
    onChange: (value: string) => void
  }
  slider?: SidebarSlider
}

// A single labeled text/number/password field (e.g. a resize width, a PDF
// password) — rendered label-above-input, matching the app's form fields.
type SidebarInput = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "number" | "password"
  disabled?: boolean
  min?: number
  className?: string
  onEnter?: () => void
}

type Sidebar = {
  segments?: SidebarSegments
  color?: SidebarColor
  toggle?: SidebarToggle
  inputs?: SidebarInput[]
  zoom?: SidebarZoom
  slider?: SidebarSlider
  /** Muted contextual text (e.g. "No transparent margin to trim.") shown in the sidebar. */
  hint?: ReactNode
  actions?: (SidebarAction | false | null | undefined)[]
  download?: SidebarDownload
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
      {children}
    </span>
  )
}

// Shared by the standalone `sidebar.slider` and the nested
// `sidebar.toggle.slider` (e.g. Image Converter's Quality and Tolerance) so
// both render identically instead of drifting into two different looks.
function SidebarSliderControl({ slider }: { slider: SidebarSlider }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <SidebarLabel>{slider.label}</SidebarLabel>
        <span className="flex items-baseline gap-1">
          <Input
            type="number"
            value={slider.value}
            onChange={(e) => {
              const parsed = Number(e.target.value)
              if (!Number.isFinite(parsed)) return
              slider.onValueChange(
                Math.min(slider.max, Math.max(slider.min, parsed))
              )
            }}
            min={slider.min}
            max={slider.max}
            step={slider.step ?? 1}
            disabled={slider.disabled}
            className="h-8 w-14 px-2 text-right"
          />
          {slider.unit && (
            <span className="text-sm text-muted-foreground">{slider.unit}</span>
          )}
        </span>
      </div>
      <Slider
        value={[slider.value]}
        onValueChange={([value]) => slider.onValueChange(value)}
        min={slider.min}
        max={slider.max}
        step={slider.step ?? 1}
        disabled={slider.disabled}
        className="w-full"
      />
    </div>
  )
}

// Shared by the standalone `sidebar.color` and the nested
// `sidebar.toggle.color` (e.g. Image Converter's Background and Background
// color to remove) so both render identically instead of drifting into two
// different looks. The clear/nullLabel row only shows once a caller opts in
// via `clearLabel`/`clearIcon`/`nullLabel` — the toggle's nested color never
// sets those, so it just gets a plain label above its `ColorPicker`.
function SidebarColorControl({ color }: { color: SidebarColor }) {
  return (
    <div className="flex flex-col gap-3">
      {color.showLabel !== false && (
        <div className="flex items-center justify-between">
          <SidebarLabel>{color.label}</SidebarLabel>
          {color.value
            ? (color.clearLabel || color.clearIcon) && (
                <button
                  type="button"
                  onClick={() => color.onChange(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {color.clearIcon && (
                    <HugeiconsIcon
                      icon={color.clearIcon}
                      className="size-3.5"
                      aria-hidden
                    />
                  )}
                  {color.clearLabel ?? "Clear"}
                </button>
              )
            : color.nullLabel && (
                <span className="text-xs text-muted-foreground">
                  {color.nullLabel}
                </span>
              )}
        </div>
      )}
      <ColorPicker
        value={color.value ?? color.fallback}
        onChange={(value) => color.onChange(value)}
        label={color.label}
      />
    </div>
  )
}

export function ToolPage({
  page,
  icon,
  onCopy,
  onLoadSample,
  onAddFile,
  segments,
  actions,
  fileStrip,
  sidebar,
  children,
}: {
  page: string
  icon: IconSvgElement
  onCopy?: () => void
  onLoadSample?: () => void
  onAddFile?: () => void
  segments?: Segments
  actions?: ReactNode
  /** A `JobStrip` (or similar) element, rendered in the bottom bar next to zoom controls and Add file. */
  fileStrip?: ReactNode
  sidebar?: Sidebar
  children: ReactNode
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    onCopy?.()
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const inlineSegments = segments?.placement === "inline" ? segments : undefined
  const sidebarSegments =
    (segments && segments.placement !== "inline" ? segments : undefined) ??
    sidebar?.segments

  const hasHeaderRow = !!(actions || onCopy || onLoadSample)
  const hasBottomBar = !!(fileStrip || onAddFile)
  const hasSidebar = !!(sidebarSegments || sidebar)

  const allActions = (sidebar?.actions ?? []).filter(
    (action): action is SidebarAction => !!action
  )
  const secondaryActions = allActions.filter(
    (action) => action.emphasis === "secondary"
  )
  const primaryActions = allActions.filter(
    (action) => action.emphasis !== "secondary"
  )
  const hasSidebarActionsBlock = allActions.length > 0 || !!sidebar?.download

  return (
    <div className="flex min-h-svh">
      <div className="mx-auto flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageBreadcrumb page={page} icon={icon} />

        {inlineSegments && (
          <Tabs
            value={inlineSegments.value}
            onValueChange={inlineSegments.onValueChange}
          >
            <TabsList>
              {inlineSegments.options.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  disabled={inlineSegments.disabled}
                >
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
                  <HugeiconsIcon
                    icon={copied ? Tick02Icon : Copy01Icon}
                    aria-hidden
                  />
                  Copy
                </Button>
              )}
              {onLoadSample && (
                <Button variant="secondary" onClick={onLoadSample}>
                  <HugeiconsIcon icon={SparklesIcon} aria-hidden />
                  Load sample
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-4">{children}</div>

        {hasBottomBar && (
          <div className="flex min-h-11 items-center gap-4">
            {fileStrip && <div className="min-w-0 flex-1">{fileStrip}</div>}

            {onAddFile && (
              <Button
                variant="secondary"
                onClick={onAddFile}
                className="ml-auto"
              >
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
            {sidebar?.zoom && (
              <div className="flex flex-col gap-3">
                <SidebarLabel>Zoom</SidebarLabel>
                <div className="flex w-full items-center gap-2">
                  <div className="flex flex-1 items-center justify-between rounded-lg bg-muted">
                    <IconTooltip label="Zoom out">
                      <Button
                        variant="ghost"
                        onClick={sidebar.zoom.onZoomOut}
                        disabled={sidebar.zoom.zoomOutDisabled}
                        aria-label="Zoom out"
                      >
                        <HugeiconsIcon icon={ZoomOutAreaIcon} aria-hidden />
                      </Button>
                    </IconTooltip>
                    <span className="text-center text-sm text-muted-foreground">
                      {sidebar.zoom.percent}%
                    </span>
                    <IconTooltip label="Zoom in">
                      <Button
                        variant="ghost"
                        onClick={sidebar.zoom.onZoomIn}
                        disabled={sidebar.zoom.zoomInDisabled}
                        aria-label="Zoom in"
                      >
                        <HugeiconsIcon icon={ZoomInAreaIcon} aria-hidden />
                      </Button>
                    </IconTooltip>
                  </div>
                  <div className="shrink-0 rounded-lg bg-muted">
                    <IconTooltip label="Fit to screen">
                      <Button
                        variant="ghost"
                        onClick={sidebar.zoom.onFit}
                        aria-label="Fit to screen"
                      >
                        <HugeiconsIcon icon={FitToScreenIcon} aria-hidden />
                      </Button>
                    </IconTooltip>
                  </div>
                </div>
              </div>
            )}

            {sidebarSegments && (
              <div className="flex flex-col gap-3">
                {sidebarSegments.label && (
                  <SidebarLabel>{sidebarSegments.label}</SidebarLabel>
                )}
                {/* A couple of options (Blur Type, Format, …) read fine as an
                    evenly-split segmented control — a crowded row (image-crop's
                    6-option aspect picker) doesn't: wrapping it onto multiple
                    lines still looks broken inside a pill-shaped Tabs track, so
                    it gets a plain Select dropdown instead. */}
                {sidebarSegments.options.length > 3 ? (
                  <Select
                    value={sidebarSegments.value}
                    onValueChange={sidebarSegments.onValueChange}
                    disabled={sidebarSegments.disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sidebarSegments.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <HugeiconsIcon icon={option.icon} aria-hidden />
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Tabs
                    value={sidebarSegments.value}
                    onValueChange={sidebarSegments.onValueChange}
                  >
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

            {sidebar?.color && <SidebarColorControl color={sidebar.color} />}

            {sidebar?.toggle && (
              <div className="flex flex-col gap-3">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <SidebarLabel>{sidebar.toggle.label}</SidebarLabel>
                  <Checkbox
                    checked={sidebar.toggle.pressed}
                    onCheckedChange={(checked) =>
                      sidebar.toggle!.onPressedChange(checked === true)
                    }
                  />
                </label>
                {sidebar.toggle.pressed && sidebar.toggle.color && (
                  <SidebarColorControl
                    color={{
                      label: sidebar.toggle.color.label,
                      value: sidebar.toggle.color.value,
                      fallback: sidebar.toggle.color.value,
                      showLabel: false,
                      onChange: (value) => {
                        if (value !== null)
                          sidebar.toggle!.color!.onChange(value)
                      },
                    }}
                  />
                )}
                {sidebar.toggle.pressed && sidebar.toggle.slider && (
                  <SidebarSliderControl slider={sidebar.toggle.slider} />
                )}
              </div>
            )}

            {sidebar?.inputs?.map((input, index) => (
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

            {sidebar?.slider && (
              <SidebarSliderControl slider={sidebar.slider} />
            )}

            {sidebar?.hint && (
              <span className="text-sm text-muted-foreground">
                {sidebar.hint}
              </span>
            )}
          </div>

          {hasSidebarActionsBlock && (
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
                          disabled={action.disabled}
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

              {sidebar?.download && (
                <ButtonGroup className="w-full">
                  <Button
                    variant="secondary"
                    onClick={sidebar.download.onDownload}
                    disabled={sidebar.download.disabled}
                    className="flex-1"
                  >
                    <HugeiconsIcon icon={Download04Icon} aria-hidden />
                    Download
                  </Button>
                  {sidebar.download.onDownloadAll && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          disabled={sidebar.download.disabled}
                          aria-label="More download options"
                        >
                          <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-max">
                        <DropdownMenuItem
                          onClick={sidebar.download.onDownloadAll}
                          disabled={sidebar.download.downloadAllDisabled}
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
