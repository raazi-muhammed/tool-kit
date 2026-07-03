// Pure-JS BMP encoding for the Image Converter tool.
//
// Canvas has no native BMP export, so we build the file by hand from raw
// pixels obtained via ctx.getImageData().

/**
 * Encode raw RGBA pixels as an uncompressed 32bpp BMP Blob: a 14-byte
 * BITMAPFILEHEADER, a 40-byte BITMAPINFOHEADER (top-down, so rows are
 * written in the same top-to-bottom order as ImageData), then the pixel
 * data with each RGBA pixel swapped to BGRA.
 */
export function encodeBmp(imageData: ImageData): Blob {
  const { width, height, data } = imageData
  const pixelDataSize = width * height * 4
  const fileSize = 54 + pixelDataSize
  const buffer = new ArrayBuffer(fileSize)
  const view = new DataView(buffer)

  // --- 14-byte BITMAPFILEHEADER ---
  view.setUint8(0, 0x42) // 'B'
  view.setUint8(1, 0x4d) // 'M'
  view.setUint32(2, fileSize, true) // file size
  view.setUint32(6, 0, true) // reserved
  view.setUint32(10, 54, true) // pixel data offset

  // --- 40-byte BITMAPINFOHEADER (BITMAPINFOHEADER / BI_RGB) ---
  view.setUint32(14, 40, true) // header size
  view.setInt32(18, width, true)
  view.setInt32(22, -height, true) // negative = top-down
  view.setUint16(26, 1, true) // planes
  view.setUint16(28, 32, true) // bits per pixel
  view.setUint32(30, 0, true) // compression (BI_RGB)
  view.setUint32(34, 0, true) // image size (0 is valid for BI_RGB)
  view.setInt32(38, 0, true) // x pixels per meter
  view.setInt32(42, 0, true) // y pixels per meter
  view.setUint32(46, 0, true) // colors used
  view.setUint32(50, 0, true) // important colors

  // --- pixel data: RGBA -> BGRA, top-down ---
  let offset = 54
  for (let i = 0; i < data.length; i += 4) {
    view.setUint8(offset++, data[i + 2]) // B
    view.setUint8(offset++, data[i + 1]) // G
    view.setUint8(offset++, data[i]) // R
    view.setUint8(offset++, data[i + 3]) // A
  }

  return new Blob([view], { type: "image/bmp" })
}

/**
 * Feature-detect WebP *encoding* support (not just decoding). Older Safari
 * versions can display WebP images but silently fall back to PNG when asked
 * to export one via canvas.toDataURL.
 */
export function supportsWebp(): boolean {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL("image/webp").startsWith("data:image/webp")
}
