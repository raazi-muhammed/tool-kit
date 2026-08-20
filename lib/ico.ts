import { canvasToPngBytes } from "@/lib/canvas"

type IcoImage = { size: number; png: Uint8Array }

/**
 * Pack pre-encoded PNG images into a single .ico file — the modern
 * PNG-in-ICO format (supported by Windows Vista+ and every current browser)
 * rather than the legacy uncompressed BMP entries, so no separate BMP
 * encoder is needed.
 */
function encodeIco(images: IcoImage[]): Blob {
  const dirSize = 6 + 16 * images.length
  const header = new Uint8Array(dirSize)
  const view = new DataView(header.buffer)
  view.setUint16(2, 1, true) // image type: icon
  view.setUint16(4, images.length, true)

  let offset = dirSize
  images.forEach((image, i) => {
    const entry = 6 + i * 16
    // A dimension byte of 0 means 256px — the format has no other way to
    // encode that size in a single byte.
    header[entry] = image.size >= 256 ? 0 : image.size
    header[entry + 1] = image.size >= 256 ? 0 : image.size
    view.setUint16(entry + 4, 1, true) // color planes
    view.setUint16(entry + 6, 32, true) // bits per pixel
    view.setUint32(entry + 8, image.png.length, true)
    view.setUint32(entry + 12, offset, true)
    offset += image.png.length
  })

  return new Blob([header, ...images.map((image) => image.png)] as BlobPart[], {
    type: "image/x-icon",
  })
}

export type IconShape = "square" | "rounded" | "circle"

// How much of a "rounded" icon's half-width the corner radius takes up —
// close to the ~22% squircle look of iOS/macOS app icons.
const ROUNDED_RADIUS_RATIO = 0.22

/** Trace a rounded-rect path (corner radius `r`) onto `ctx`, ready to `clip()` or `stroke()`. */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  size: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.arcTo(size, 0, size, r, r)
  ctx.lineTo(size, size - r)
  ctx.arcTo(size, size, size - r, size, r)
  ctx.lineTo(r, size)
  ctx.arcTo(0, size, 0, size - r, r)
  ctx.lineTo(0, r)
  ctx.arcTo(0, 0, r, 0, r)
  ctx.closePath()
}

/**
 * Render `source` onto a `size` x `size` canvas, clipped to `shape` and
 * composited over `bg` if set, else left transparent outside the shape (and
 * inside it too, when there's no `bg`).
 */
export function renderIconCanvas(
  source: CanvasImageSource,
  size: number,
  bg: string | null,
  shape: IconShape
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  ctx.save()
  if (shape === "circle") {
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()
  } else if (shape === "rounded") {
    roundedRectPath(ctx, size, size * ROUNDED_RADIUS_RATIO)
    ctx.clip()
  }

  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size, size)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, size, size)
  ctx.restore()
  return canvas
}

/**
 * Build a multi-resolution .ico from `source`, rasterized fresh at each of
 * `sizes` (rather than downscaled from one raster) so a vector source stays
 * sharp at every embedded size.
 */
export async function buildIco(
  source: CanvasImageSource,
  sizes: number[],
  bg: string | null,
  shape: IconShape = "square"
): Promise<Blob> {
  const images = await Promise.all(
    sizes
      .slice()
      .sort((a, b) => a - b)
      .map(async (size) => ({
        size,
        png: await canvasToPngBytes(renderIconCanvas(source, size, bg, shape)),
      }))
  )
  return encodeIco(images)
}
