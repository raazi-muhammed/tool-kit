export type Rect = { x: number; y: number; width: number; height: number }

/** Normalize a drag from two arbitrary points into a rect with positive width/height. */
export function rectFromPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Rect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  }
}

/**
 * Like `rectFromPoints`, but locked to `ratio` (width / height). The rect is
 * anchored at the drag start (x0, y0), grows toward the current point, and is
 * clamped to the `maxWidth` × `maxHeight` canvas without breaking the ratio.
 */
export function rectFromPointsWithRatio(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ratio: number,
  maxWidth: number,
  maxHeight: number
): Rect {
  const dx = x1 - x0
  const dy = y1 - y0
  // Let the dominant drag axis drive the size, then cap it by the space
  // available between the anchor and the canvas edge in the drag direction.
  const availWidth = dx >= 0 ? maxWidth - x0 : x0
  const availHeight = dy >= 0 ? maxHeight - y0 : y0
  const width = Math.max(
    0,
    Math.min(
      Math.max(Math.abs(dx), Math.abs(dy) * ratio),
      availWidth,
      availHeight * ratio
    )
  )
  const height = width / ratio
  return {
    x: dx >= 0 ? x0 : x0 - width,
    y: dy >= 0 ? y0 : y0 - height,
    width,
    height,
  }
}

/** Clamp a rect so it stays fully inside a `width` × `height` canvas. */
export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(rect.x, width))
  const y = Math.max(0, Math.min(rect.y, height))
  const w = Math.max(0, Math.min(rect.width, width - x))
  const h = Math.max(0, Math.min(rect.height, height - y))
  return { x, y, width: w, height: h }
}

let filterSupported: boolean | null = null

/**
 * Whether the 2D canvas `filter` property actually renders. Browsers without
 * it silently ignore the assignment rather than throwing — and merely reading
 * the property back can pass even when rendering ignores it — so probe by
 * drawing with a blur and checking that pixels actually bled past the shape.
 */
function supportsCanvasFilter(): boolean {
  if (filterSupported !== null) return filterSupported
  const probe = document.createElement("canvas")
  probe.width = 10
  probe.height = 10
  const ctx = probe.getContext("2d")
  if (!ctx) {
    filterSupported = false
    return filterSupported
  }
  ctx.filter = "blur(2px)"
  ctx.fillRect(0, 0, 5, 10)
  // A real blur bleeds opacity past the fill's right edge (x = 5); if the
  // filter didn't render, this pixel is untouched and fully transparent.
  filterSupported = ctx.getImageData(7, 5, 1, 1).data[3] > 0
  return filterSupported
}

/** Blur a full copy of `source` with the native canvas `filter` API. */
function filterBlurCanvas(
  source: HTMLCanvasElement,
  blurPx: number
): HTMLCanvasElement {
  const blurred = document.createElement("canvas")
  blurred.width = source.width
  blurred.height = source.height
  const ctx = blurred.getContext("2d")
  if (!ctx) return blurred
  ctx.filter = `blur(${blurPx}px)`
  ctx.drawImage(source, 0, 0)
  return blurred
}

/**
 * Approximate a Gaussian blur without `filter` support: downscale in halving
 * steps (each step low-pass filters via bilinear sampling), then upscale back
 * to full size with smoothing.
 */
function fallbackBlurCanvas(
  source: HTMLCanvasElement,
  blurPx: number
): HTMLCanvasElement {
  const factor = Math.max(1, blurPx / 2)
  const targetWidth = Math.max(1, Math.round(source.width / factor))
  const targetHeight = Math.max(1, Math.round(source.height / factor))

  let current: HTMLCanvasElement = source
  let width = source.width
  let height = source.height
  while (width > targetWidth || height > targetHeight) {
    width = Math.max(targetWidth, Math.round(width / 2))
    height = Math.max(targetHeight, Math.round(height / 2))
    const step = document.createElement("canvas")
    step.width = width
    step.height = height
    const stepCtx = step.getContext("2d")
    if (!stepCtx) break
    stepCtx.imageSmoothingEnabled = true
    stepCtx.imageSmoothingQuality = "high"
    stepCtx.drawImage(current, 0, 0, width, height)
    current = step
  }

  const blurred = document.createElement("canvas")
  blurred.width = source.width
  blurred.height = source.height
  const ctx = blurred.getContext("2d")
  if (!ctx) return blurred
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(current, 0, 0, source.width, source.height)
  return blurred
}

/**
 * Mosaic-pixelate a full copy of `source`: downscale with smoothing (averages
 * each block), then upscale without smoothing (keeps the blocks crisp).
 */
function pixelateCanvas(
  source: HTMLCanvasElement,
  blockPx: number
): HTMLCanvasElement {
  const out = document.createElement("canvas")
  out.width = source.width
  out.height = source.height
  const outCtx = out.getContext("2d")
  if (!outCtx) return out

  const small = document.createElement("canvas")
  small.width = Math.max(1, Math.round(source.width / blockPx))
  small.height = Math.max(1, Math.round(source.height / blockPx))
  const smallCtx = small.getContext("2d")
  if (!smallCtx) return out
  smallCtx.imageSmoothingEnabled = true
  smallCtx.imageSmoothingQuality = "high"
  smallCtx.drawImage(source, 0, 0, small.width, small.height)

  outCtx.imageSmoothingEnabled = false
  outCtx.drawImage(small, 0, 0, out.width, out.height)
  return out
}

export type BlurMode = "gaussian" | "pixelate"

/**
 * Copy `source` onto `dest` and obscure just the given rect — with a Gaussian
 * blur or a blocky pixelate mosaic — by processing a full copy of the source
 * (so neighbouring pixels bleed in naturally at the edges) and clipping that
 * copy onto the destination.
 */
export function blurRegion(
  dest: HTMLCanvasElement,
  source: HTMLCanvasElement,
  rect: Rect,
  blurPx: number,
  mode: BlurMode = "gaussian"
) {
  const destCtx = dest.getContext("2d")
  if (!destCtx) return
  destCtx.drawImage(source, 0, 0)
  if (rect.width <= 0 || rect.height <= 0 || blurPx <= 0) return

  const blurred =
    mode === "pixelate"
      ? pixelateCanvas(source, Math.max(2, blurPx))
      : supportsCanvasFilter()
        ? filterBlurCanvas(source, blurPx)
        : fallbackBlurCanvas(source, blurPx)

  destCtx.save()
  destCtx.beginPath()
  destCtx.rect(rect.x, rect.y, rect.width, rect.height)
  destCtx.clip()
  destCtx.drawImage(blurred, 0, 0)
  destCtx.restore()
}
