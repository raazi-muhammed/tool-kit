import {
  decodePDFRawStream,
  EncryptedPDFError,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  type PDFObject,
} from "@cantoo/pdf-lib"

import { canvasToBlob } from "@/lib/canvas"

/**
 * How hard to squeeze a PDF's embedded images: JPEG re-encode quality (0-1)
 * plus an optional cap on each image's longest side, in pixels.
 */
export type PdfCompressSettings = {
  jpegQuality: number
  maxDimension: number | null
}

/**
 * Map a single 1-100 "Quality" dial onto both image knobs: JPEG quality
 * tracks it directly, and below 90 images are also downscaled — from a
 * ~3000px longest side (roughly a 300 DPI letter page) at 89 down to ~1000px
 * at 1.
 */
export function settingsForQuality(quality: number): PdfCompressSettings {
  const q = Math.min(100, Math.max(1, quality))
  return {
    jpegQuality: Math.min(0.95, Math.max(0.05, q / 100)),
    maxDimension: q >= 90 ? null : Math.round(1000 + (q / 90) * 2000),
  }
}

function lookupName(dict: PDFDict, key: string): string | null {
  const value = dict.lookup(PDFName.of(key))
  return value instanceof PDFName ? value.decodeText() : null
}

function lookupNumber(dict: PDFDict, key: string): number | null {
  const value = dict.lookup(PDFName.of(key))
  return value instanceof PDFNumber ? value.asNumber() : null
}

/** The image's single filter name, or `null` for none/a filter chain. */
function singleFilter(dict: PDFDict): string | null {
  const filter = dict.lookup(PDFName.of("Filter"))
  if (filter instanceof PDFName) return filter.decodeText()
  if (filter instanceof PDFArray && filter.size() === 1) {
    const only = filter.lookup(0)
    return only instanceof PDFName ? only.decodeText() : null
  }
  return null
}

/**
 * Number of color components for the color spaces this tool can safely
 * round-trip through a canvas (gray/RGB, plain or ICC-tagged) — `null` for
 * everything else (CMYK, Indexed, Separation, Lab, …), which is left alone.
 */
function colorComponents(dict: PDFDict): 1 | 3 | null {
  const cs = dict.lookup(PDFName.of("ColorSpace"))
  if (cs instanceof PDFName) {
    const name = cs.decodeText()
    if (name === "DeviceRGB") return 3
    if (name === "DeviceGray") return 1
    return null
  }
  if (cs instanceof PDFArray && cs.size() === 2) {
    const kind = cs.lookup(0)
    const profile = cs.lookup(1)
    if (
      kind instanceof PDFName &&
      kind.decodeText() === "ICCBased" &&
      profile instanceof PDFRawStream
    ) {
      const n = lookupNumber(profile.dict, "N")
      if (n === 3) return 3
      if (n === 1) return 1
    }
  }
  return null
}

/** Image XObjects used as another image's /SMask — alpha channels, which a lossy JPEG would fringe. */
function softMaskRefs(doc: PDFDocument): Set<string> {
  const refs = new Set<string>()
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    const smask = obj.dict.get(PDFName.of("SMask"))
    if (smask instanceof PDFRef) refs.add(smask.toString())
  }
  return refs
}

type Candidate = {
  ref: PDFRef
  stream: PDFRawStream
  width: number
  height: number
  components: 1 | 3
  filter: "DCTDecode" | "FlateDecode"
}

/** Whether `obj` is an 8-bit gray/RGB JPEG or unpredicted-Flate image this tool knows how to re-encode. */
function asCandidate(
  ref: PDFRef,
  obj: PDFObject,
  masks: Set<string>
): Candidate | null {
  if (!(obj instanceof PDFRawStream)) return null
  const dict = obj.dict
  if (lookupName(dict, "Subtype") !== "Image") return null
  if (masks.has(ref.toString())) return null
  // Stencil masks, color-key masks, and custom decode ranges all depend on
  // exact sample values that a lossy re-encode wouldn't preserve.
  if (dict.has(PDFName.of("ImageMask"))) return null
  if (dict.lookup(PDFName.of("Mask")) instanceof PDFArray) return null
  if (dict.has(PDFName.of("Decode"))) return null
  if (lookupNumber(dict, "BitsPerComponent") !== 8) return null

  const width = lookupNumber(dict, "Width")
  const height = lookupNumber(dict, "Height")
  if (!width || !height) return null

  const components = colorComponents(dict)
  if (!components) return null

  const filter = singleFilter(dict)
  if (filter === "DCTDecode") {
    return { ref, stream: obj, width, height, components, filter }
  }
  if (filter === "FlateDecode") {
    // PNG/TIFF predictors would need un-filtering first — skip those.
    const parms = dict.lookup(PDFName.of("DecodeParms"))
    if (parms instanceof PDFDict && (lookupNumber(parms, "Predictor") ?? 1) > 1)
      return null
    if (parms instanceof PDFArray) return null
    return { ref, stream: obj, width, height, components, filter }
  }
  return null
}

/** Decode a candidate image into a drawable source (bitmap or a filled canvas). */
async function decodeImage(
  candidate: Candidate
): Promise<CanvasImageSource | null> {
  const { stream, width, height, components } = candidate
  if (candidate.filter === "DCTDecode") {
    const blob = new Blob([stream.contents as BlobPart], { type: "image/jpeg" })
    return createImageBitmap(blob, { colorSpaceConversion: "none" }).catch(
      () => null
    )
  }

  const raw = decodePDFRawStream(stream).decode()
  if (raw.length < width * height * components) return null
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const pixels = ctx.createImageData(width, height)
  const out = pixels.data
  for (let i = 0, j = 0; i < width * height; i++, j += components) {
    const o = i * 4
    if (components === 3) {
      out[o] = raw[j]
      out[o + 1] = raw[j + 1]
      out[o + 2] = raw[j + 2]
    } else {
      out[o] = out[o + 1] = out[o + 2] = raw[j]
    }
    out[o + 3] = 255
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}

/**
 * Re-encode one image as a (possibly downscaled) JPEG, swapping it into the
 * document only if that actually came out smaller than what was there.
 */
async function recompressImage(
  doc: PDFDocument,
  candidate: Candidate,
  settings: PdfCompressSettings
) {
  const source = await decodeImage(candidate)
  if (!source) return

  const { width, height } = candidate
  const scale = settings.maxDimension
    ? Math.min(1, settings.maxDimension / Math.max(width, height))
    : 1
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  if ("close" in source) source.close()

  const blob = await canvasToBlob(canvas, "image/jpeg", settings.jpegQuality)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes.length >= candidate.stream.contents.length) return

  const dict = candidate.stream.dict.clone(doc.context)
  dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"))
  dict.set(PDFName.of("Width"), PDFNumber.of(canvas.width))
  dict.set(PDFName.of("Height"), PDFNumber.of(canvas.height))
  dict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8))
  dict.delete(PDFName.of("DecodeParms"))
  // A canvas always encodes a 3-channel JPEG, even from a gray source.
  if (candidate.components === 1)
    dict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"))
  doc.context.assign(candidate.ref, PDFRawStream.of(dict, bytes))
}

/**
 * Shrink a PDF in-browser: re-encode its gray/RGB raster images as JPEGs at
 * `settings` (keeping text and vector content untouched), then re-save with
 * compressed object streams. Throws a friendly error for encrypted files.
 */
export async function compressPdf(
  bytes: ArrayBuffer,
  settings: PdfCompressSettings
): Promise<Uint8Array> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (err) {
    if (err instanceof EncryptedPDFError)
      throw new Error(
        "This PDF is password-protected. Remove the password with PDF Unlock first."
      )
    throw new Error("This file couldn't be read as a PDF.")
  }

  const masks = softMaskRefs(doc)
  const candidates: Candidate[] = []
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    const candidate = asCandidate(ref, obj, masks)
    if (candidate) candidates.push(candidate)
  }
  // One at a time — decoding every page image at once can exhaust memory on
  // a large scanned PDF.
  for (const candidate of candidates) {
    await recompressImage(doc, candidate, settings).catch(() => {})
  }

  return doc.save({ useObjectStreams: true })
}
