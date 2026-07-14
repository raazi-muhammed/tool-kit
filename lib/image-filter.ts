export type ScanFilter = "original" | "grayscale" | "bw" | "enhance"

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas")
  out.width = source.width
  out.height = source.height
  out.getContext("2d")?.drawImage(source, 0, 0)
  return out
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function clamp255(value: number): number {
  return Math.min(255, Math.max(0, value))
}

/**
 * Apply a scanner-style look to `source`, returning a new canvas (the
 * original is left untouched, since the filter is meant to stay swappable
 * rather than get baked into the working image):
 * - `grayscale` desaturates.
 * - `bw` thresholds to pure black/white at `threshold` (0-255).
 * - `enhance` contrast-stretches by luminance percentiles (clipping the
 *   dimmest/brightest 1% as outliers), then applies `contrast` (100 = the
 *   plain stretch, higher pushes values further from mid-gray) around the
 *   midpoint — applies the same scale/offset to every channel, so color
 *   balance is preserved — pushes the page background toward white and
 *   deepens text without fully binarizing.
 * `"original"` is returned as-is (no copy needed).
 */
export function applyScanFilter(
  source: HTMLCanvasElement,
  filter: ScanFilter,
  threshold: number,
  contrast = 100
): HTMLCanvasElement {
  if (filter === "original") return source

  const out = cloneCanvas(source)
  const ctx = out.getContext("2d")
  if (!ctx) return out
  const imageData = ctx.getImageData(0, 0, out.width, out.height)
  const data = imageData.data

  if (filter === "grayscale") {
    for (let i = 0; i < data.length; i += 4) {
      const l = luminance(data[i], data[i + 1], data[i + 2])
      data[i] = l
      data[i + 1] = l
      data[i + 2] = l
    }
  } else if (filter === "bw") {
    for (let i = 0; i < data.length; i += 4) {
      const v =
        luminance(data[i], data[i + 1], data[i + 2]) >= threshold ? 255 : 0
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
    }
  } else if (filter === "enhance") {
    const histogram = new Array(256).fill(0)
    for (let i = 0; i < data.length; i += 4) {
      histogram[Math.round(luminance(data[i], data[i + 1], data[i + 2]))]++
    }
    const total = data.length / 4
    let low = 0
    let cumulative = 0
    for (let t = 0; t < 256; t++) {
      cumulative += histogram[t]
      if (cumulative >= total * 0.01) {
        low = t
        break
      }
    }
    let high = 255
    cumulative = 0
    for (let t = 255; t >= 0; t--) {
      cumulative += histogram[t]
      if (cumulative >= total * 0.01) {
        high = t
        break
      }
    }
    const range = Math.max(1, high - low)
    const contrastFactor = contrast / 100
    for (let i = 0; i < data.length; i += 4) {
      const stretched0 = ((data[i] - low) / range) * 255
      const stretched1 = ((data[i + 1] - low) / range) * 255
      const stretched2 = ((data[i + 2] - low) / range) * 255
      data[i] = clamp255((stretched0 - 128) * contrastFactor + 128)
      data[i + 1] = clamp255((stretched1 - 128) * contrastFactor + 128)
      data[i + 2] = clamp255((stretched2 - 128) * contrastFactor + 128)
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return out
}
