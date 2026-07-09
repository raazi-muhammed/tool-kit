/** Broad but simple image-file check; tools that accept more container
 *  formats (e.g. .tiff, .ico) than the browser reliably reports via MIME
 *  type should layer their own extension check on top of this. */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error("This file couldn't be decoded as an image."))
    img.src = url
  })
}

/** Draw a loaded image onto a same-size canvas at its natural resolution. */
export function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas isn't supported in this browser.")
  ctx.drawImage(img, 0, 0)
  return canvas
}

/** A picked file's `loadResource` for editor tools that work on a decoded canvas. */
export async function loadImageAsCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    return imageToCanvas(await loadImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}
