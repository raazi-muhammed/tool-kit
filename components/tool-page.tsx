"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  ClipboardPasteIcon,
  Copy01Icon,
  Download04Icon,
  FitToScreenIcon,
  Files02Icon,
  Settings01Icon,
  SparklesIcon,
  Tick02Icon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"

import { ColorPicker } from "@/components/color-picker"
import { IconTooltip } from "@/components/icon-tooltip"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
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
import { cn } from "@/lib/utils"

// Duck-typed against `DropzoneHandle` (`components/dropzone.tsx`) rather than
// imported directly, so `ToolPage` doesn't need a hard dependency on
// `Dropzone` — any ref exposing `open`/`paste` works.
type AddFileHandle = {
  open: () => void
  paste: () => void
}

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
  /**
   * Force the rendering — `"tabs"` for an evenly-split segmented control,
   * `"select"` for a dropdown. Omit to pick automatically by option count
   * (3 or fewer as tabs, more as a dropdown); set explicitly when a control
   * should read as a dropdown regardless of how few options it has (e.g.
   * Image to PDF's page size, alongside two other segmented pickers already
   * using the tabs look).
   */
  variant?: "tabs" | "select"
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

// Groups a row of `SidebarAction`s under an optional muted label (e.g.
// "This image" over "Rotate left"/"Rotate right", "All images" over
// "Rotate all left"/"Rotate all right") — each action renders at an even
// share of the row's width instead of stacking full-width.
type SidebarActionGroup = {
  label?: ReactNode
  actions: (SidebarAction | false | null | undefined)[]
  /**
   * `"bottom"` (default) renders this group in the sidebar's pinned bottom
   * action stack, alongside Download. `"top"` renders it in the scrollable
   * section instead, alongside `zoom`/`slider` — for standalone transform
   * controls with no single commit step (e.g. Image Rotate's rotate
   * buttons), as opposed to a tool's actual call to action.
   */
  placement?: "top" | "bottom"
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
  /** A plain checkbox sub-option, revealed only while `pressed` (e.g. a narrower refinement of the toggle's own behavior). */
  checkbox?: {
    label: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
  }
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
  /**
   * Additional segmented pickers beyond the single `segments` slot above —
   * e.g. Image to PDF's page orientation, page size, and margin, each an
   * independent choice rather than one shared "mode" setting. Rendered
   * stacked, in array order, right after `segments`.
   */
  groups?: SidebarSegments[]
  color?: SidebarColor
  toggle?: SidebarToggle
  inputs?: SidebarInput[]
  zoom?: SidebarZoom
  /** A single slider (the common case), or an array for a tool with more than one independent slider setting (e.g. ID Card Merge's gap and outer padding) — each renders identically, stacked in order. */
  slider?: SidebarSlider | SidebarSlider[]
  /** Muted contextual text (e.g. "No transparent margin to trim.") shown in the sidebar. */
  hint?: ReactNode
  /**
   * Each top-level entry renders as its own full-width row in the pinned
   * action stack. A `SidebarActionGroup` instead groups actions into a
   * single row, evenly split (e.g. Image Rotate's "Rotate left" / "Rotate
   * right" side by side) rather than stacking full-width, with an optional
   * muted label rendered above it.
   */
  actions?: (SidebarAction | SidebarActionGroup | false | null | undefined)[]
  download?: SidebarDownload
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
      {children}
    </span>
  )
}

// A `sidebar.inputs` field that re-focuses itself once re-enabled, if it was
// the focused element when it got disabled (e.g. PDF Unlock's password field
// disables mid-attempt and re-enables on a wrong-password error — disabling
// an input drops browser focus, and re-enabling it doesn't restore it).
function SidebarInputField({ input }: { input: SidebarInput }) {
  const ref = useRef<HTMLInputElement>(null)
  const wasFocusedRef = useRef(false)

  useEffect(() => {
    if (!input.disabled && wasFocusedRef.current) {
      wasFocusedRef.current = false
      ref.current?.focus()
    }
  }, [input.disabled])

  return (
    <Input
      ref={ref}
      type={input.type ?? "text"}
      min={input.min}
      value={input.value}
      onChange={(e) => input.onChange(e.target.value)}
      disabled={input.disabled}
      autoComplete="off"
      onBlur={(e) => {
        if (e.target.disabled) wasFocusedRef.current = true
      }}
      onKeyDown={
        input.onEnter
          ? (e) => {
              if (e.key === "Enter") input.onEnter!()
            }
          : undefined
      }
      className={input.className ?? "w-full"}
    />
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

// Shared by the top-level `segments`/`sidebar.segments` slot and each entry
// in `sidebar.groups` (e.g. Image to PDF's page orientation, page size, and
// margin) so every segmented picker renders identically. A couple of options
// read fine as an evenly-split segmented control — a crowded row (image-crop's
// 6-option aspect picker) doesn't: wrapping it onto multiple lines still
// looks broken inside a pill-shaped Tabs track, so it gets a plain Select
// dropdown instead once there are more than 3.
function SidebarSegmentsControl({ segments }: { segments: SidebarSegments }) {
  const useSelect = segments.variant
    ? segments.variant === "select"
    : segments.options.length > 3

  return (
    <div className="flex flex-col gap-3">
      {segments.label && <SidebarLabel>{segments.label}</SidebarLabel>}
      {useSelect ? (
        <Select
          value={segments.value}
          onValueChange={segments.onValueChange}
          disabled={segments.disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {segments.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <HugeiconsIcon icon={option.icon} aria-hidden />
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Tabs value={segments.value} onValueChange={segments.onValueChange}>
          <TabsList className="w-full">
            {segments.options.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                disabled={segments.disabled}
              >
                <HugeiconsIcon icon={option.icon} aria-hidden />
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
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

// Shared by a flat `sidebar.actions` entry and a grouped-row entry so both
// render identically — `widthClassName` is `"w-full"` for a standalone
// action, `"flex-1"` for one sharing a row with others.
function SidebarPrimaryAction({
  action,
  widthClassName,
}: {
  action: SidebarAction
  widthClassName: string
}) {
  if (!action.more) {
    return (
      <Button
        variant={action.variant}
        onClick={action.onClick}
        disabled={action.disabled}
        className={widthClassName}
      >
        <HugeiconsIcon icon={action.icon} aria-hidden />
        {action.label}
      </Button>
    )
  }

  return (
    <ButtonGroup className={widthClassName}>
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
  )
}

// Shared by a `SidebarActionGroup` wherever it renders — the scrollable top
// section (`placement: "top"`) or the pinned bottom stack (the default) — so
// both look identical: an optional muted label above a row of actions
// evenly split via `flex-1`.
function SidebarActionGroupRow({ group }: { group: SidebarActionGroup }) {
  const actions = group.actions.filter(
    (action): action is SidebarAction =>
      !!action && action.emphasis !== "secondary"
  )
  if (actions.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {group.label && <SidebarLabel>{group.label}</SidebarLabel>}
      <div className="flex w-full gap-2">
        {actions.map((action, index) => (
          <SidebarPrimaryAction
            key={index}
            action={action}
            widthClassName="flex-1"
          />
        ))}
      </div>
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
  /**
   * The same `dropzoneRef` a page already keeps for `ref={dropzoneRef}` on its
   * `Dropzone` — `ToolPage` renders "Add file" as a ButtonGroup + dropdown
   * chevron with a "Paste from clipboard" option, calling `.open()`/`.paste()`
   * on it directly, so there's nothing extra to wire per page.
   */
  onAddFile?: RefObject<AddFileHandle | null>
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

  const rawActions = sidebar?.actions ?? []
  const allActions = rawActions.flatMap((entry) =>
    entry && "actions" in entry
      ? entry.actions.filter((action): action is SidebarAction => !!action)
      : entry
        ? [entry]
        : []
  )
  const secondaryActions = allActions.filter(
    (action) => action.emphasis === "secondary"
  )
  // A group opts into the scrollable top section (alongside zoom/slider) via
  // `placement: "top"` — everything else stays in the pinned bottom stack.
  const topActionGroups = rawActions.filter(
    (entry): entry is SidebarActionGroup =>
      !!entry && "actions" in entry && entry.placement === "top"
  )
  // Groups are rendered separately below, preserving their own row — only
  // ungrouped primary actions are listed flat here.
  const primaryActionRows = rawActions.filter(
    (entry): entry is SidebarAction | SidebarActionGroup =>
      !!entry && !("actions" in entry && entry.placement === "top")
  )
  const hasSidebarActionsBlock = allActions.length > 0 || !!sidebar?.download

  // Rendered twice — once inline in the desktop side panel, once inside the
  // mobile Drawer's scrollable body — so both surfaces stay in sync with no
  // separate copy to maintain. Each render produces its own DOM nodes (e.g.
  // its own `<input>` per `SidebarInputField`), which is fine since only one
  // of the two surfaces is ever visible/interactive at a time.
  const sidebarBody = (
    <>
      {topActionGroups.map((group, index) => (
        <SidebarActionGroupRow key={index} group={group} />
      ))}

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

      {sidebarSegments && <SidebarSegmentsControl segments={sidebarSegments} />}

      {sidebar?.groups?.map((group, index) => (
        <SidebarSegmentsControl key={index} segments={group} />
      ))}

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
                  if (value !== null) sidebar.toggle!.color!.onChange(value)
                },
              }}
            />
          )}
          {sidebar.toggle.pressed && sidebar.toggle.slider && (
            <SidebarSliderControl slider={sidebar.toggle.slider} />
          )}
          {sidebar.toggle.pressed && sidebar.toggle.checkbox && (
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <SidebarLabel>{sidebar.toggle.checkbox.label}</SidebarLabel>
              <Checkbox
                checked={sidebar.toggle.checkbox.checked}
                onCheckedChange={(checked) =>
                  sidebar.toggle!.checkbox!.onCheckedChange(checked === true)
                }
              />
            </label>
          )}
        </div>
      )}

      {sidebar?.inputs?.map((input, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <SidebarLabel>{input.label}</SidebarLabel>
          <SidebarInputField input={input} />
        </div>
      ))}

      {sidebar?.slider &&
        (Array.isArray(sidebar.slider) ? (
          sidebar.slider.map((slider, index) => (
            <SidebarSliderControl key={index} slider={slider} />
          ))
        ) : (
          <SidebarSliderControl slider={sidebar.slider} />
        ))}

      {sidebar?.hint && (
        <span className="text-sm text-muted-foreground">{sidebar.hint}</span>
      )}
    </>
  )

  const sidebarActionsContent = (
    <>
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

      {primaryActionRows.map((entry, index) =>
        "actions" in entry ? (
          <SidebarActionGroupRow key={index} group={entry} />
        ) : (
          entry.emphasis !== "secondary" && (
            <SidebarPrimaryAction
              key={index}
              action={entry}
              widthClassName="w-full"
            />
          )
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
    </>
  )

  // Takes `className` rather than being a plain JSX const (like `sidebarBody`
  // above) since its two call sites need different widths: natural/`w-fit`
  // next to the file strip on desktop, full-width stacked under it inside
  // the mobile Drawer.
  function addFileButtonGroup(className: string) {
    if (!onAddFile) return null
    return (
      <ButtonGroup className={className}>
        <Button
          variant="secondary"
          onClick={() => onAddFile.current?.open()}
          className="flex-1"
        >
          <HugeiconsIcon icon={Add01Icon} aria-hidden />
          Add file
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              aria-label="More add file options"
            >
              <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-max">
            <DropdownMenuItem onClick={() => onAddFile.current?.paste()}>
              <HugeiconsIcon icon={ClipboardPasteIcon} aria-hidden />
              Paste from clipboard
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    )
  }

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <div
        className={cn(
          "flex w-full min-w-0 flex-1 flex-col gap-4 p-6",
          // Extra bottom padding on mobile so content isn't hidden behind the
          // fixed Files/Settings bar below.
          (fileStrip || hasSidebar) && "pb-28 md:pb-6"
        )}
      >
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          {children}
        </div>

        {hasBottomBar && (
          <div
            className={cn(
              "flex min-h-11 items-center gap-4",
              // On mobile, a file strip moves into the combined Files/
              // Settings bar below instead of sharing this row — its chips
              // are each `shrink-0` (a thumbnail/name/size never gets
              // squished), which leaves no reliable width to share with Add
              // file on a narrow viewport.
              fileStrip && "hidden md:flex"
            )}
          >
            {fileStrip ? (
              <>
                <div className="min-w-0 flex-1">{fileStrip}</div>
                {addFileButtonGroup("ml-auto")}
              </>
            ) : (
              addFileButtonGroup("ml-auto")
            )}
          </div>
        )}
      </div>

      {hasSidebar && (
        // Desktop: the settings sidebar as a static side panel.
        <div className="hidden bg-card md:flex md:w-80 md:shrink-0 md:flex-col md:border-l">
          <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6">
            {sidebarBody}
          </div>

          {hasSidebarActionsBlock && (
            <div className="flex shrink-0 flex-col gap-3 border-t p-6">
              {sidebarActionsContent}
            </div>
          )}
        </div>
      )}

      {/* Mobile: Files and Settings share one fixed bottom bar, split evenly
          — each opens its own Drawer instead of either stacking inline
          (file strip) or living in its own full-width bar (settings). Only
          one of the two renders if a tool has just one. */}
      {(fileStrip || hasSidebar) && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          {fileStrip && (
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="secondary" className="flex-1">
                  <HugeiconsIcon icon={Files02Icon} aria-hidden />
                  Files
                </Button>
              </DrawerTrigger>
              <DrawerContent className="md:hidden">
                <DrawerHeader>
                  <DrawerTitle>Files</DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col gap-4 overflow-y-auto p-4">
                  {fileStrip}
                  {addFileButtonGroup("w-full")}
                </div>
              </DrawerContent>
            </Drawer>
          )}

          {hasSidebar && (
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="secondary" className="flex-1">
                  <HugeiconsIcon icon={Settings01Icon} aria-hidden />
                  Settings
                </Button>
              </DrawerTrigger>
              <DrawerContent className="md:hidden">
                <DrawerHeader>
                  <DrawerTitle>Settings</DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col gap-8 overflow-y-auto p-4">
                  {sidebarBody}
                </div>

                {hasSidebarActionsBlock && (
                  <div className="flex flex-col gap-3 border-t p-4">
                    {sidebarActionsContent}
                  </div>
                )}
              </DrawerContent>
            </Drawer>
          )}
        </div>
      )}
    </div>
  )
}
