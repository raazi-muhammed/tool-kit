"use client"

import { useState } from "react"

/**
 * A width/height input pair with an optional locked aspect ratio, derived
 * from a `reference` size (e.g. the active job's own dimensions) — used by
 * tools that rasterize/resize to an explicit target size (Image Resize,
 * SVG to PNG). The target size is shared across every queued file, so
 * `seed` only fills the fields once (the first picked file), never again.
 */
export function useLockedSize(reference: { width: number; height: number } | null) {
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [lockAspect, setLockAspect] = useState(true)

  function onWidthChange(value: string) {
    setWidth(value)
    const parsed = Number(value)
    if (lockAspect && reference && parsed > 0) {
      setHeight(String(Math.max(1, Math.round(parsed * (reference.height / reference.width)))))
    }
  }

  function onHeightChange(value: string) {
    setHeight(value)
    const parsed = Number(value)
    if (lockAspect && reference && parsed > 0) {
      setWidth(String(Math.max(1, Math.round(parsed * (reference.width / reference.height)))))
    }
  }

  function toggleLockAspect() {
    // Re-derive height from the current width so re-locking snaps back to
    // the reference ratio instead of carrying over a distorted size.
    if (!lockAspect && reference) {
      const parsedWidth = Number(width)
      if (parsedWidth > 0) {
        setHeight(String(Math.max(1, Math.round(parsedWidth * (reference.height / reference.width)))))
      }
    }
    setLockAspect(!lockAspect)
  }

  /** Seed both fields from `reference` — a no-op once either already has a value. */
  function seed() {
    if (!width && !height && reference) {
      setWidth(String(reference.width))
      setHeight(String(reference.height))
    }
  }

  function reset() {
    setWidth("")
    setHeight("")
    setLockAspect(true)
  }

  return { width, height, lockAspect, onWidthChange, onHeightChange, toggleLockAspect, seed, reset }
}
