import { quadOutputSize, type Point, type Quad } from "@/lib/canvas"

// Detection runs on a downscaled copy — plenty of resolution to find a
// document's silhouette, and keeps the flood fill fast regardless of the
// source photo's actual size.
const ANALYSIS_MAX_SIZE = 500
// Reject a detected region smaller than this fraction of the analysis
// image's area — too small to plausibly be the photographed document
// itself, rather than a stray bright/dark blob.
const MIN_AREA_RATIO = 0.1

function toGrayscale(imageData: ImageData): Uint8ClampedArray {
  const { data, width, height } = imageData
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return gray
}

/** 3x3 box blur — denoises paper texture/JPEG artifacts before thresholding. */
function boxBlur(
  gray: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          sum += gray[ny * width + nx]
          count++
        }
      }
      out[y * width + x] = sum / count
    }
  }
  return out
}

/** Otsu's method: the brightness threshold that best splits the image into two classes. */
function otsuThreshold(gray: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0)
  for (const v of gray) histogram[v]++
  const total = gray.length

  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * histogram[t]

  let sumB = 0
  let weightB = 0
  let maxVariance = 0
  let threshold = 127

  for (let t = 0; t < 256; t++) {
    weightB += histogram[t]
    if (weightB === 0) continue
    const weightF = total - weightB
    if (weightF === 0) break

    sumB += t * histogram[t]
    const meanB = sumB / weightB
    const meanF = (sum - sumB) / weightF
    const variance = weightB * weightF * (meanB - meanF) ** 2
    if (variance > maxVariance) {
      maxVariance = variance
      threshold = t
    }
  }
  return threshold
}

/** Every point in the largest 4-connected blob of `mask`, via BFS flood fill. */
function largestComponent(
  mask: Uint8Array,
  width: number,
  height: number
): Point[] {
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let best: Point[] = []

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue
    let head = 0
    let tail = 0
    queue[tail++] = start
    visited[start] = 1
    const points: Point[] = []

    while (head < tail) {
      const idx = queue[head++]
      const x = idx % width
      const y = (idx - x) / width
      points.push({ x, y })

      // Left/right neighbors must stay on the same row (no wraparound).
      if (x > 0 && mask[idx - 1] && !visited[idx - 1]) {
        visited[idx - 1] = 1
        queue[tail++] = idx - 1
      }
      if (x < width - 1 && mask[idx + 1] && !visited[idx + 1]) {
        visited[idx + 1] = 1
        queue[tail++] = idx + 1
      }
      if (idx - width >= 0 && mask[idx - width] && !visited[idx - width]) {
        visited[idx - width] = 1
        queue[tail++] = idx - width
      }
      if (
        idx + width < mask.length &&
        mask[idx + width] &&
        !visited[idx + width]
      ) {
        visited[idx + width] = 1
        queue[tail++] = idx + width
      }
    }

    if (points.length > best.length) best = points
  }

  return best
}

/**
 * Best-effort auto-detection of a photographed document's 4 corners, for
 * seeding the scan tool's quad selection so the user doesn't have to place
 * every corner by hand. Segments the image into two brightness classes via
 * Otsu thresholding, assumes whichever class the image's center pixel falls
 * into is the document (it's usually framed roughly centered), takes that
 * class's largest connected blob, and picks its 4 extreme corners by
 * x+y/x-y (min/max of each is always a boundary point of a filled,
 * roughly-convex blob, so this avoids needing a full contour/convex-hull
 * pass). Returns null if nothing plausible was found — e.g. a background
 * with too little contrast against the document — so the caller can fall
 * back to a plain inset default.
 */
export function detectDocumentQuad(source: HTMLCanvasElement): Quad | null {
  const scale = Math.min(
    1,
    ANALYSIS_MAX_SIZE / Math.max(source.width, source.height)
  )
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const analysis = document.createElement("canvas")
  analysis.width = width
  analysis.height = height
  const ctx = analysis.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, width, height)

  const gray = boxBlur(
    toGrayscale(ctx.getImageData(0, 0, width, height)),
    width,
    height
  )
  const threshold = otsuThreshold(gray)
  const centerBright =
    gray[Math.floor(height / 2) * width + Math.floor(width / 2)] >= threshold

  const mask = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    mask[i] = gray[i] >= threshold === centerBright ? 1 : 0
  }

  const points = largestComponent(mask, width, height)
  if (points.length < width * height * MIN_AREA_RATIO) return null

  let minSum = Infinity
  let maxSum = -Infinity
  let minDiff = Infinity
  let maxDiff = -Infinity
  let topLeft = points[0]
  let bottomRight = points[0]
  let topRight = points[0]
  let bottomLeft = points[0]

  for (const p of points) {
    const sum = p.x + p.y
    const diff = p.x - p.y
    if (sum < minSum) {
      minSum = sum
      topLeft = p
    }
    if (sum > maxSum) {
      maxSum = sum
      bottomRight = p
    }
    if (diff > maxDiff) {
      maxDiff = diff
      topRight = p
    }
    if (diff < minDiff) {
      minDiff = diff
      bottomLeft = p
    }
  }

  const sx = source.width / width
  const sy = source.height / height
  const quad: Quad = [
    { x: topLeft.x * sx, y: topLeft.y * sy },
    { x: topRight.x * sx, y: topRight.y * sy },
    { x: bottomRight.x * sx, y: bottomRight.y * sy },
    { x: bottomLeft.x * sx, y: bottomLeft.y * sy },
  ]

  const { width: qw, height: qh } = quadOutputSize(quad)
  if (qw < source.width * MIN_AREA_RATIO || qh < source.height * MIN_AREA_RATIO)
    return null

  return quad
}
