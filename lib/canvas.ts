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

/**
 * Convert a pointer event's client coordinates into `canvas`'s own pixel
 * space, accounting for however it's scaled/transformed on screen (CSS
 * size, zoom/pan transforms, etc. — `getBoundingClientRect` already reflects
 * all of that).
 */
export function canvasPointFromEvent(
  canvas: HTMLCanvasElement,
  e: { clientX: number; clientY: number }
): { x: number; y: number } {
  const box = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - box.left) * (canvas.width / box.width),
    y: (e.clientY - box.top) * (canvas.height / box.height),
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
 * Copy `source` onto `dest` and obscure the given rect(s) — with a Gaussian
 * blur or a blocky pixelate mosaic — by processing a single full-canvas blur
 * of the source (so neighbouring pixels bleed in naturally at the edges) and
 * clipping that copy onto the destination through the union of the rects.
 */
export function blurRegion(
  dest: HTMLCanvasElement,
  source: HTMLCanvasElement,
  rects: Rect | Rect[],
  blurPx: number,
  mode: BlurMode = "gaussian"
) {
  const destCtx = dest.getContext("2d")
  if (!destCtx) return
  destCtx.drawImage(source, 0, 0)
  const list = (Array.isArray(rects) ? rects : [rects]).filter(
    (rect) => rect.width > 0 && rect.height > 0
  )
  if (list.length === 0 || blurPx <= 0) return

  const blurred =
    mode === "pixelate"
      ? pixelateCanvas(source, Math.max(2, blurPx))
      : supportsCanvasFilter()
        ? filterBlurCanvas(source, blurPx)
        : fallbackBlurCanvas(source, blurPx)

  destCtx.save()
  destCtx.beginPath()
  for (const rect of list) destCtx.rect(rect.x, rect.y, rect.width, rect.height)
  destCtx.clip()
  destCtx.drawImage(blurred, 0, 0)
  destCtx.restore()
}

/**
 * Copy `source` onto a new same-size canvas, clipped to rounded corners of
 * `radius` (clamped to half the smaller dimension). The cut-away corners are
 * filled with `bgColor`, or left transparent when null.
 */
export function roundCorners(
  source: HTMLCanvasElement,
  radius: number,
  bgColor: string | null
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas
  const { width, height } = canvas
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))

  if (bgColor) {
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)
  }

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(width - r, 0)
  ctx.arcTo(width, 0, width, r, r)
  ctx.lineTo(width, height - r)
  ctx.arcTo(width, height, width - r, height, r)
  ctx.lineTo(r, height)
  ctx.arcTo(0, height, 0, height - r, r)
  ctx.lineTo(0, r)
  ctx.arcTo(0, 0, r, 0, r)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(source, 0, 0)
  ctx.restore()
  return canvas
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

/**
 * Bounding box of every pixel with non-zero alpha, in `canvas`'s own pixel
 * space — used to trim fully-transparent margins. Returns null if every
 * pixel is fully transparent (nothing to keep).
 */
export function findOpaqueBounds(canvas: HTMLCanvasElement): Rect | null {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX || maxY < minY) return null

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`
}

export type Point = { x: number; y: number }
/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point]

/** A quad inset from the canvas edges by `insetRatio`, so it starts fully visible and easy to grab. */
export function defaultQuad(
  width: number,
  height: number,
  insetRatio = 0.08
): Quad {
  const ix = width * insetRatio
  const iy = height * insetRatio
  return [
    { x: ix, y: iy },
    { x: width - ix, y: iy },
    { x: width - ix, y: height - iy },
    { x: ix, y: height - iy },
  ]
}

/** Clamp a point so it stays fully inside a `width` x `height` canvas. */
export function clampPoint(point: Point, width: number, height: number): Point {
  return {
    x: Math.max(0, Math.min(point.x, width)),
    y: Math.max(0, Math.min(point.y, height)),
  }
}

/** Index of the quad corner within `tol` (canvas px) of (x, y), or null. */
export function hitQuadCorner(
  x: number,
  y: number,
  quad: Quad,
  tol: number
): number | null {
  for (let i = 0; i < quad.length; i++) {
    const dx = x - quad[i].x
    const dy = y - quad[i].y
    if (Math.sqrt(dx * dx + dy * dy) <= tol) return i
  }
  return null
}

/**
 * Scale a quad from one canvas's coordinate space to another — e.g. to apply
 * a corner selection made on one queued image to a different image of
 * another size (see `scaleRect`, its rectangle equivalent).
 */
export function scaleQuad(
  quad: Quad,
  from: { width: number; height: number },
  to: { width: number; height: number }
): Quad {
  return quad.map((p) => ({
    x: (p.x / from.width) * to.width,
    y: (p.y / from.height) * to.height,
  })) as Quad
}

/**
 * Draw the quad selection chrome onto `canvas`: everything outside the quad
 * dimmed, a solid outline connecting the 4 corners, and a round grab handle
 * at each one.
 */
export function drawQuadSelection(canvas: HTMLCanvasElement, quad: Quad) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.save()
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
  ctx.beginPath()
  ctx.rect(0, 0, canvas.width, canvas.height)
  ctx.moveTo(quad[0].x, quad[0].y)
  ctx.lineTo(quad[1].x, quad[1].y)
  ctx.lineTo(quad[2].x, quad[2].y)
  ctx.lineTo(quad[3].x, quad[3].y)
  ctx.closePath()
  ctx.fill("evenodd")
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = "#3b82f6"
  ctx.lineWidth = Math.max(1, canvas.width / 400)
  ctx.beginPath()
  ctx.moveTo(quad[0].x, quad[0].y)
  ctx.lineTo(quad[1].x, quad[1].y)
  ctx.lineTo(quad[2].x, quad[2].y)
  ctx.lineTo(quad[3].x, quad[3].y)
  ctx.closePath()
  ctx.stroke()

  const radius = ctx.lineWidth * 2.5
  ctx.fillStyle = "#3b82f6"
  for (const point of quad) {
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** A reasonable output size for de-skewing `quad`: the average of each pair of opposite edge lengths. */
export function quadOutputSize(quad: Quad): { width: number; height: number } {
  const [tl, tr, br, bl] = quad
  return {
    width: Math.max(
      1,
      Math.round((pointDistance(tl, tr) + pointDistance(bl, br)) / 2)
    ),
    height: Math.max(
      1,
      Math.round((pointDistance(tl, bl) + pointDistance(tr, br)) / 2)
    ),
  }
}

/**
 * Bilinear-sample `data` (a `sw` x `sh` RGBA buffer) at floating-point (x, y),
 * clamping to the edge outside its bounds.
 */
function sampleBilinear(
  data: Uint8ClampedArray,
  sw: number,
  sh: number,
  x: number,
  y: number
): [number, number, number, number] {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const cx0 = Math.min(sw - 1, Math.max(0, x0))
  const cy0 = Math.min(sh - 1, Math.max(0, y0))
  const cx1 = Math.min(sw - 1, Math.max(0, x0 + 1))
  const cy1 = Math.min(sh - 1, Math.max(0, y0 + 1))
  const i00 = (cy0 * sw + cx0) * 4
  const i10 = (cy0 * sw + cx1) * 4
  const i01 = (cy1 * sw + cx0) * 4
  const i11 = (cy1 * sw + cx1) * 4

  const result: [number, number, number, number] = [0, 0, 0, 0]
  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] * (1 - tx) + data[i10 + c] * tx
    const bottom = data[i01 + c] * (1 - tx) + data[i11 + c] * tx
    result[c] = top * (1 - ty) + bottom * ty
  }
  return result
}

/**
 * Warp the `quad` region of `source` into a flat `outWidth` x `outHeight`
 * rectangle — a projective (perspective) transform, not just an affine crop,
 * so a document photographed at an angle comes out straightened. Maps each
 * destination pixel back to its source position via the classic "unit
 * square to quadrilateral" homography (Heckbert), then bilinear-samples the
 * source there — an inverse mapping, so every destination pixel gets a
 * value with no gaps.
 */
export function warpQuadToRect(
  source: HTMLCanvasElement,
  quad: Quad,
  outWidth: number,
  outHeight: number
): HTMLCanvasElement {
  const out = document.createElement("canvas")
  out.width = outWidth
  out.height = outHeight
  const srcCtx = source.getContext("2d")
  const outCtx = out.getContext("2d")
  if (!srcCtx || !outCtx) return out

  const sw = source.width
  const sh = source.height
  const src = srcCtx.getImageData(0, 0, sw, sh).data
  const outData = outCtx.createImageData(outWidth, outHeight)
  const dst = outData.data

  const [p0, p1, p2, p3] = quad
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const dy3 = p0.y - p1.y + p2.y - p3.y

  let a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    // Already a parallelogram (dx3/dy3 ~ 0): a pure affine map, no perspective term.
    a = p1.x - p0.x
    b = p3.x - p0.x
    c = p0.x
    d = p1.y - p0.y
    e = p3.y - p0.y
    f = p0.y
    g = 0
    h = 0
  } else {
    const denom = dx1 * dy2 - dx2 * dy1
    g = denom === 0 ? 0 : (dx3 * dy2 - dx2 * dy3) / denom
    h = denom === 0 ? 0 : (dx1 * dy3 - dx3 * dy1) / denom
    a = p1.x - p0.x + g * p1.x
    b = p3.x - p0.x + h * p3.x
    c = p0.x
    d = p1.y - p0.y + g * p1.y
    e = p3.y - p0.y + h * p3.y
    f = p0.y
  }

  for (let dy = 0; dy < outHeight; dy++) {
    const v = dy / outHeight
    for (let dx = 0; dx < outWidth; dx++) {
      const u = dx / outWidth
      const w = g * u + h * v + 1
      const x = (a * u + b * v + c) / w
      const y = (d * u + e * v + f) / w
      const [r, gCol, bCol, aCol] = sampleBilinear(src, sw, sh, x, y)
      const di = (dy * outWidth + dx) * 4
      dst[di] = r
      dst[di + 1] = gCol
      dst[di + 2] = bCol
      dst[di + 3] = aCol
    }
  }

  outCtx.putImageData(outData, 0, 0)
  return out
}

/**
 * Map (clientX, clientY) — viewport coordinates, e.g. from a click event —
 * onto pixel coordinates within content of `naturalWidth`x`naturalHeight`
 * rendered scaled-to-fit inside `box` (preserving aspect ratio, e.g. via
 * `object-contain` or `max-h`/`max-w`). Returns null if the point falls in
 * the box's letterbox padding rather than on the content itself.
 */
function mapPointToContent(
  box: DOMRect,
  naturalWidth: number,
  naturalHeight: number,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const scale = Math.min(box.width / naturalWidth, box.height / naturalHeight)
  const renderedWidth = naturalWidth * scale
  const renderedHeight = naturalHeight * scale
  const localX = clientX - box.left - (box.width - renderedWidth) / 2
  const localY = clientY - box.top - (box.height - renderedHeight) / 2
  if (
    localX < 0 ||
    localY < 0 ||
    localX > renderedWidth ||
    localY > renderedHeight
  ) {
    return null
  }
  return {
    x: Math.min(naturalWidth - 1, Math.floor(localX / scale)),
    y: Math.min(naturalHeight - 1, Math.floor(localY / scale)),
  }
}

/**
 * Sample the color at (clientX, clientY) directly off a `<canvas>` or `<img>`
 * element on the page — used for a generic "pick a color from anywhere on
 * the page" eyedropper (`ColorPicker`'s screen-eyedropper fallback) that
 * doesn't need to know in advance which element holds the relevant preview.
 * Returns null if the element isn't a canvas/image, or the point misses its
 * rendered content (e.g. letterbox padding).
 */
export function sampleColorAtPoint(
  target: Element,
  clientX: number,
  clientY: number
): string | null {
  if (target instanceof HTMLCanvasElement) {
    const point = mapPointToContent(
      target.getBoundingClientRect(),
      target.width,
      target.height,
      clientX,
      clientY
    )
    if (!point) return null
    const ctx = target.getContext("2d")
    if (!ctx) return null
    const [r, g, b] = ctx.getImageData(point.x, point.y, 1, 1).data
    return rgbToHex(r, g, b)
  }

  if (target instanceof HTMLImageElement) {
    const point = mapPointToContent(
      target.getBoundingClientRect(),
      target.naturalWidth,
      target.naturalHeight,
      clientX,
      clientY
    )
    if (!point) return null
    const canvas = document.createElement("canvas")
    canvas.width = target.naturalWidth
    canvas.height = target.naturalHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    try {
      ctx.drawImage(target, 0, 0)
      const [r, g, b] = ctx.getImageData(point.x, point.y, 1, 1).data
      return rgbToHex(r, g, b)
    } catch {
      return null // tainted canvas — e.g. a cross-origin image without CORS
    }
  }

  return null
}
