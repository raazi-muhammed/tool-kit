"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ColorPickerIcon, DropperIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { sampleColorAtPoint } from "@/lib/canvas"

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

// Walk up from the exact element under the cursor to find the nearest
// canvas/image — every tool preview renders its canvas/img as a direct,
// unwrapped layer, so this is mostly a small safety net.
function findSampleable(el: Element | null): Element | null {
  let node = el
  for (let i = 0; node && i < 4; i++) {
    if (node instanceof HTMLCanvasElement || node instanceof HTMLImageElement) return node
    node = node.parentElement
  }
  return null
}

/**
 * A color swatch button that opens a popover with a hex input, a native
 * color input (for the OS picker's full palette/sliders), a screen
 * eyedropper where the browser supports it (Chrome/Edge), and a "pick from
 * image" fallback that works everywhere (including Safari/Firefox): it
 * samples whatever canvas/image is under the next click anywhere on the
 * page, so no caller has to wire up how to sample its own preview — it's
 * always available, not something a page opts into.
 */
export function ColorPicker({
  value,
  onChange,
  label = "Pick color",
}: {
  value: string
  onChange: (color: string) => void
  label?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState(value)
  const [picking, setPicking] = React.useState(false)
  // Adjust local text when `value` changes from outside (e.g. a reset) —
  // done during render, per React's guidance, instead of in an effect.
  const [prevValue, setPrevValue] = React.useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value)
  }
  const supportsEyeDropper =
    typeof window !== "undefined" && "EyeDropper" in window

  function commitText(raw: string) {
    const normalized = normalizeHex(raw)
    if (normalized) onChange(normalized)
    else setText(value) // invalid entry — revert to the last good color
  }

  async function pickFromScreen() {
    try {
      const EyeDropper = (window as unknown as { EyeDropper: EyeDropperConstructor })
        .EyeDropper
      const result = await new EyeDropper().open()
      onChange(result.sRGBHex)
    } catch {
      // User pressed Escape or the pick failed — leave the color as is.
    }
    setOpen(false)
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
      const target = findSampleable(document.elementFromPoint(e.clientX, e.clientY))
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={label}>
          <span
            className="size-4 shrink-0 rounded-full border"
            style={{ backgroundColor: value }}
            aria-hidden
          />
          {value}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
          />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commitText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText(e.currentTarget.value)
            }}
            className="flex-1 font-mono uppercase"
            maxLength={7}
            aria-label="Hex color code"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setOpen(false)
            setPicking(true)
          }}
        >
          <HugeiconsIcon icon={ColorPickerIcon} aria-hidden />
          Pick from image
        </Button>
        {supportsEyeDropper && (
          <Button variant="outline" onClick={pickFromScreen}>
            <HugeiconsIcon icon={DropperIcon} aria-hidden />
            Pick from screen
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
