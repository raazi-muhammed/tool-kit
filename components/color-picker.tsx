"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ColorPickerIcon, DropperIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { sampleColorAtPoint } from "@/lib/canvas"
import { cn } from "@/lib/utils"

// Not yet in the TS DOM lib — Chrome/Edge only, feature-detected below.
type EyeDropperResult = { sRGBHex: string }
type EyeDropperConstructor = new () => { open: () => Promise<EyeDropperResult> }

function isValidHex(value: string): value is `#${string}` {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

/** Accept `#fff`, `fff`, `#ffffff`, or `ffffff` and normalize to `#rrggbb`. */
function normalizeHex(value: string): string | null {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`
  if (!isValidHex(withHash)) return null
  if (withHash.length === 4) {
    const [, r, g, b] = withHash
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return withHash.toLowerCase()
}

// Hue in degrees (0-360), saturation and value (brightness) in 0-1. Kept as
// the picker's own state rather than re-derived from the hex each render, so
// dragging to pure black/white/gray (where hue is undefined) doesn't snap
// the hue bar back to red.
type Hsv = { h: number; s: number; v: number }

function hexToHsv(hex: string): Hsv {
  const n = parseInt((normalizeHex(hex) ?? "#000000").slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  let h = 0
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h = (h * 60 + 360) % 360
  }
  return { h, s: max ? delta / max : 0, v: max }
}

function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

// Pointer handlers for a drag surface (the saturation area, the hue bar):
// reports the pointer's position as 0-1 fractions of the element's box on
// press and while dragging, via pointer capture so a drag that leaves the
// element keeps tracking.
function dragHandlers(onMove: (x: number, y: number) => void) {
  function move(e: React.PointerEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    onMove(
      clamp01((e.clientX - rect.left) / rect.width),
      clamp01((e.clientY - rect.top) / rect.height)
    )
  }
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      move(e)
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e)
    },
  }
}

// Arrow-key step for the saturation area and hue bar — Shift for a coarse
// step, matching native range inputs.
function arrowStep(e: React.KeyboardEvent, fine: number, coarse: number) {
  const step = e.shiftKey ? coarse : fine
  switch (e.key) {
    case "ArrowLeft":
      return { x: -step, y: 0 }
    case "ArrowRight":
      return { x: step, y: 0 }
    case "ArrowUp":
      return { x: 0, y: step }
    case "ArrowDown":
      return { x: 0, y: -step }
    default:
      return null
  }
}

const PRESETS = [
  "#ffffff",
  "#000000",
  "#6b7280",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
]

// The usual light/gray checkerboard that stands for "no fill".
const TRANSPARENT_STYLE: React.CSSProperties = {
  backgroundImage: "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%)",
  backgroundSize: "8px 8px",
}

const SWATCH_CLASS =
  "aspect-square rounded-sm ring-1 ring-foreground/10 ring-inset transition-transform outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-foreground"

// White ring plus a faint dark outline, so the thumb stays visible on both
// light and dark parts of the gradient underneath it.
const THUMB_CLASS =
  "pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_1px_3px_rgb(0_0_0/0.4)]"

// Walk up from the exact element under the cursor to find the nearest
// canvas/image — every tool preview renders its canvas/img as a direct,
// unwrapped layer, so this is mostly a small safety net.
function findSampleable(el: Element | null): Element | null {
  let node = el
  for (let i = 0; node && i < 4; i++) {
    if (node instanceof HTMLCanvasElement || node instanceof HTMLImageElement)
      return node
    node = node.parentElement
  }
  return null
}

/**
 * A color picker: a swatch + hex input row, where the swatch opens a custom
 * popover instead of the browser's native color dialog, which looks
 * different in every browser and clashes with the app. The popover holds a
 * saturation/brightness area, a hue bar, presets, and two eyedroppers: "From
 * image", a fallback that works everywhere (including Safari/Firefox) by
 * sampling whatever canvas/image is under the next click anywhere on the
 * page, so no caller has to wire up how to sample its own preview; and "From
 * screen", the native eyedropper where the browser supports it
 * (Chrome/Edge).
 */
export function ColorPicker({
  value,
  onChange,
  label = "Pick color",
  disabled,
  transparent = false,
  onTransparent,
}: {
  value: string
  onChange: (color: string) => void
  label?: string
  disabled?: boolean
  /** Whether "no fill" is currently selected — the swatch shows a checkerboard and the hex field reads "Transparent". `value` still positions the picker, so choosing a color picks up from there. */
  transparent?: boolean
  /** Set to offer a "Transparent" option in the popover, alongside the presets. */
  onTransparent?: () => void
}) {
  const displayed = transparent ? "" : value
  const [text, setText] = React.useState(displayed)
  const [picking, setPicking] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  // Adjust local text when `value` changes from outside (e.g. a reset) —
  // done during render, per React's guidance, instead of in an effect.
  const [hsv, setHsv] = React.useState(() => hexToHsv(value))
  const [prevDisplayed, setPrevDisplayed] = React.useState(displayed)
  if (displayed !== prevDisplayed) {
    setPrevDisplayed(displayed)
    setText(displayed)
    // Only re-derive when the color really changed from outside — a value
    // we just emitted ourselves already matches `hsv`, and re-deriving it
    // would lose the hue at zero saturation/brightness.
    if (hsvToHex(hsv) !== normalizeHex(value)) setHsv(hexToHsv(value))
  }

  function changeHsv(next: Hsv) {
    setHsv(next)
    onChange(hsvToHex(next))
  }
  const supportsEyeDropper =
    typeof window !== "undefined" && "EyeDropper" in window

  function commitText(raw: string) {
    const normalized = normalizeHex(raw)
    if (normalized) onChange(normalized)
    else setText(displayed) // invalid entry — revert to the last good color
  }

  async function pickFromScreen() {
    try {
      const EyeDropper = (
        window as unknown as { EyeDropper: EyeDropperConstructor }
      ).EyeDropper
      const result = await new EyeDropper().open()
      onChange(result.sRGBHex)
    } catch {
      // User pressed Escape or the pick failed — leave the color as is.
    }
  }

  // Consumes the next click anywhere on the page — capture phase, so it can
  // intercept (and cancel the effects of) the click before it reaches
  // whatever it landed on — and samples a color if that's a canvas or image.
  React.useEffect(() => {
    if (!picking) return
    const prevCursor = document.body.style.cursor
    document.body.style.cursor = "crosshair"

    function finish(color: string | null) {
      if (color) onChange(color)
      setPicking(false)
    }

    function onClick(e: MouseEvent) {
      e.preventDefault()
      e.stopPropagation()
      const target = findSampleable(
        document.elementFromPoint(e.clientX, e.clientY)
      )
      finish(target ? sampleColorAtPoint(target, e.clientX, e.clientY) : null)
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") finish(null)
    }

    document.addEventListener("click", onClick, true)
    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.body.style.cursor = prevCursor
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("keydown", onKeyDown, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking])

  return (
    <div className="flex items-center gap-0 rounded-lg border border-input bg-transparent pl-1 transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 dark:bg-input/30">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            disabled={disabled}
            className="size-9 shrink-0 cursor-pointer rounded-sm p-1 outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className="block size-full rounded-sm ring-1 ring-foreground/10 ring-inset"
              style={
                transparent ? TRANSPARENT_STYLE : { backgroundColor: value }
              }
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 gap-3 p-3">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
            {...dragHandlers((x, y) => changeHsv({ ...hsv, s: x, v: 1 - y }))}
            onKeyDown={(e) => {
              const step = arrowStep(e, 0.01, 0.1)
              if (!step) return
              e.preventDefault()
              changeHsv({
                ...hsv,
                s: clamp01(hsv.s + step.x),
                v: clamp01(hsv.v + step.y),
              })
            }}
            className="relative h-40 cursor-crosshair touch-none rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            style={{
              backgroundColor: `hsl(${hsv.h} 100% 50%)`,
              backgroundImage:
                "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
            }}
          >
            <span
              className={THUMB_CLASS}
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                backgroundColor: value,
              }}
            />
          </div>

          <div
            role="slider"
            tabIndex={0}
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
            {...dragHandlers((x) => changeHsv({ ...hsv, h: x * 360 }))}
            onKeyDown={(e) => {
              const step = arrowStep(e, 1, 10)
              if (!step) return
              e.preventDefault()
              const h = hsv.h + step.x + step.y
              changeHsv({ ...hsv, h: Math.min(360, Math.max(0, h)) })
            }}
            className="relative h-3 cursor-pointer touch-none rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            style={{
              backgroundImage:
                "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
          >
            <span
              className={cn(THUMB_CLASS, "top-1/2")}
              style={{
                left: `${(hsv.h / 360) * 100}%`,
                backgroundColor: `hsl(${hsv.h} 100% 50%)`,
              }}
            />
          </div>

          <div
            className={cn(
              "grid gap-1.5",
              onTransparent ? "grid-cols-9" : "grid-cols-8"
            )}
          >
            {onTransparent && (
              <button
                type="button"
                onClick={onTransparent}
                aria-label="Transparent"
                title="Transparent"
                aria-pressed={transparent}
                className={SWATCH_CLASS}
                style={TRANSPARENT_STYLE}
              />
            )}
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                aria-label={preset}
                aria-pressed={!transparent && normalizeHex(value) === preset}
                className={SWATCH_CLASS}
                style={{ backgroundColor: preset }}
              />
            ))}
          </div>

          {/* Each closes the popover first, so it isn't covering the
                image (or the screen) you're about to pick from. */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setOpen(false)
                setPicking(true)
              }}
              className="flex-1"
            >
              <HugeiconsIcon icon={ColorPickerIcon} aria-hidden />
              From image
            </Button>
            {supportsEyeDropper && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  pickFromScreen()
                }}
                className="flex-1"
              >
                <HugeiconsIcon icon={DropperIcon} aria-hidden />
                From screen
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commitText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitText(e.currentTarget.value)
        }}
        className="h-8 flex-1 border-0 bg-transparent px-2 font-mono uppercase shadow-none outline-none placeholder:font-sans placeholder:normal-case focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        maxLength={7}
        placeholder={transparent ? "Transparent" : undefined}
        aria-label="Hex color code"
        disabled={disabled}
      />
    </div>
  )
}
