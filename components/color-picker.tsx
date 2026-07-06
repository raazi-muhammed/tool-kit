"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ColorPickerIcon, DropperIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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

/**
 * A color swatch button that opens a popover with a hex input, a native
 * color input (for the OS picker's full palette/sliders), a screen
 * eyedropper where the browser supports it (Chrome/Edge), and — when the
 * caller wires up `onPickFromImage` — a button to sample a color directly
 * from an in-page preview, which works everywhere including Safari.
 */
export function ColorPicker({
  value,
  onChange,
  label = "Pick color",
  onPickFromImage,
}: {
  value: string
  onChange: (color: string) => void
  label?: string
  /** Enter "pick from image" mode; call `onChange` once the caller samples a color. */
  onPickFromImage?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState(value)
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
        {onPickFromImage && (
          <Button
            variant="outline"
            onClick={() => {
              onPickFromImage()
              setOpen(false)
            }}
          >
            <HugeiconsIcon icon={ColorPickerIcon} aria-hidden />
            Pick from image
          </Button>
        )}
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
