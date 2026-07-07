export type Rect = { x: number; y: number; width: number; height: number }

/**
 * Scale a rect from one canvas's coordinate space to another — e.g. to apply
 * a selection made on one queued image to a different image of another size.
 */
export function scaleRect(
  rect: Rect,
  from: { width: number; height: number },
  to: { width: number; height: number }
): Rect {
  return {
    x: (rect.x / from.width) * to.width,
    y: (rect.y / from.height) * to.height,
    width: (rect.width / from.width) * to.width,
    height: (rect.height / from.height) * to.height,
  }
}

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

/** Whether the point (x, y) falls inside `rect` (edges inclusive). */
export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

/** Clamp a rect so it stays fully inside a `width` × `height` canvas. */
export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(rect.x, width))
  const y = Math.max(0, Math.min(rect.y, height))
  const w = Math.max(0, Math.min(rect.width, width - x))
  const h = Math.max(0, Math.min(rect.height, height - y))
  return { x, y, width: w, height: h }
}

export type Edges = {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

/** Which edges of `rect` the point grabs, within `tol` (canvas px). */
export function hitEdges(
  x: number,
  y: number,
  rect: Rect,
  tol: number
): Edges | null {
  if (
    x < rect.x - tol ||
    x > rect.x + rect.width + tol ||
    y < rect.y - tol ||
    y > rect.y + rect.height + tol
  ) {
    return null
  }
  const edges = {
    left: Math.abs(x - rect.x) <= tol,
    right: Math.abs(x - (rect.x + rect.width)) <= tol,
    top: Math.abs(y - rect.y) <= tol,
    bottom: Math.abs(y - (rect.y + rect.height)) <= tol,
  }
  return edges.left || edges.right || edges.top || edges.bottom ? edges : null
}

/** CSS cursor for hovering/dragging the given edge combination. */
export function edgeCursor(edges: Edges): string {
  const horizontal = edges.left || edges.right
  const vertical = edges.top || edges.bottom
  if (horizontal && vertical) {
    return edges.left === edges.top ? "nwse-resize" : "nesw-resize"
  }
  return horizontal ? "ew-resize" : "ns-resize"
}

/**
 * Resize `rect` by dragging the given edges to `point`, clamped to the
 * `maxWidth` × `maxHeight` canvas. With a locked `ratio`, corner drags
 * re-derive the rect from the opposite corner and edge drags keep the
 * opposite edge fixed with the perpendicular axis centred.
 */
export function resizeRect(
  edges: Edges,
  rect: Rect,
  point: { x: number; y: number },
  ratio: number | null,
  maxWidth: number,
  maxHeight: number
): Rect {
  const horizontal = edges.left || edges.right
  const vertical = edges.top || edges.bottom

  if (ratio && horizontal && vertical) {
    return rectFromPointsWithRatio(
      edges.left ? rect.x + rect.width : rect.x,
      edges.top ? rect.y + rect.height : rect.y,
      point.x,
      point.y,
      ratio,
      maxWidth,
      maxHeight
    )
  }

  if (ratio && horizontal) {
    const anchorX = edges.left ? rect.x + rect.width : rect.x
    const cy = rect.y + rect.height / 2
    const desired = edges.left ? anchorX - point.x : point.x - anchorX
    const max = Math.min(
      edges.left ? anchorX : maxWidth - anchorX,
      2 * Math.min(cy, maxHeight - cy) * ratio
    )
    const width = Math.max(1, Math.min(desired, max))
    const height = width / ratio
    return {
      x: edges.left ? anchorX - width : anchorX,
      y: cy - height / 2,
      width,
      height,
    }
  }
  if (ratio) {
    const anchorY = edges.top ? rect.y + rect.height : rect.y
    const cx = rect.x + rect.width / 2
    const desired = edges.top ? anchorY - point.y : point.y - anchorY
    const max = Math.min(
      edges.top ? anchorY : maxHeight - anchorY,
      (2 * Math.min(cx, maxWidth - cx)) / ratio
    )
    const height = Math.max(1, Math.min(desired, max))
    const width = height * ratio
    return {
      x: cx - width / 2,
      y: edges.top ? anchorY - height : anchorY,
      width,
      height,
    }
  }

  // Free resize: dragged edges follow the pointer, the rest stay put.
  // rectFromPoints re-normalizes if the pointer crosses the opposite edge.
  return clampRect(
    rectFromPoints(
      edges.left ? point.x : rect.x,
      edges.top ? point.y : rect.y,
      edges.right ? point.x : rect.x + rect.width,
      edges.bottom ? point.y : rect.y + rect.height
    ),
    maxWidth,
    maxHeight
  )
}

/**
 * Draw the standard selection chrome onto `canvas`: a dashed border plus
 * grab handles at the corners and edge midpoints.
 */
export function drawSelectionRect(canvas: HTMLCanvasElement, rect: Rect) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.save()
  ctx.strokeStyle = "#3b82f6"
  ctx.lineWidth = Math.max(1, canvas.width / 400)
  ctx.setLineDash([ctx.lineWidth * 4, ctx.lineWidth * 3])
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

  const handle = ctx.lineWidth * 4
  const xs = [rect.x, rect.x + rect.width / 2, rect.x + rect.width]
  const ys = [rect.y, rect.y + rect.height / 2, rect.y + rect.height]
  ctx.setLineDash([])
  ctx.fillStyle = "#3b82f6"
  for (const hx of xs) {
    for (const hy of ys) {
      if (hx === xs[1] && hy === ys[1]) continue
      ctx.fillRect(hx - handle / 2, hy - handle / 2, handle, handle)
    }
  }
  ctx.restore()
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

/**
 * Rotate `source` by a multiple of 90 degrees (clockwise) onto a new canvas,
 * swapping width/height for 90/270 so the output isn't stretched.
 */
export function rotateCanvas(
  source: HTMLCanvasElement,
  degrees: number
): HTMLCanvasElement {
  const normalized = ((degrees % 360) + 360) % 360
  const swapped = normalized === 90 || normalized === 270
  const out = document.createElement("canvas")
  out.width = swapped ? source.height : source.width
  out.height = swapped ? source.width : source.height
  const ctx = out.getContext("2d")
  if (!ctx) return out
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((normalized * Math.PI) / 180)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const num = parseInt(hex.replace("#", ""), 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

/**
 * Chroma-key background removal: make every pixel within `tolerance` of
 * `colorHex` fully transparent, in place. `tolerance` is 0-100, mapped to a
 * Euclidean RGB distance threshold — 0 matches only the exact color, 100
 * matches everything.
 */
export function removeBackgroundColor(
  canvas: HTMLCanvasElement,
  colorHex: string,
  tolerance: number
) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const { r, g, b } = hexToRgb(colorHex)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const maxDist = Math.sqrt(3 * 255 ** 2)
  const threshold = (tolerance / 100) * maxDist
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - r
    const dg = data[i + 1] - g
    const db = data[i + 2] - b
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= threshold) data[i + 3] = 0
  }
  ctx.putImageData(imageData, 0, 0)
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`
}

/**
 * Sample the color at (clientX, clientY) — viewport coordinates, e.g. from a
 * click event — on a `<canvas>` whose intrinsic bitmap is scaled down to fit
 * its box (preserving aspect ratio, e.g. via `max-h`/`max-w`). Returns null
 * if the point falls in the box's letterbox padding rather than on the
 * canvas content itself.
 */
export function sampleCanvasColorAtPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): string | null {
  const box = canvas.getBoundingClientRect()
  const scale = Math.min(box.width / canvas.width, box.height / canvas.height)
  const renderedWidth = canvas.width * scale
  const renderedHeight = canvas.height * scale
  const localX = clientX - box.left - (box.width - renderedWidth) / 2
  const localY = clientY - box.top - (box.height - renderedHeight) / 2
  if (localX < 0 || localY < 0 || localX > renderedWidth || localY > renderedHeight) {
    return null
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const [r, g, b] = ctx.getImageData(
    Math.min(canvas.width - 1, Math.floor(localX / scale)),
    Math.min(canvas.height - 1, Math.floor(localY / scale)),
    1,
    1
  ).data
  return rgbToHex(r, g, b)
}
