// MP3 encoding for the Video to Audio tool.
//
// Uses the pure-JS lamejs encoder (bundled at build time) so encoding still
// runs entirely client-side — no backend, no FFmpeg.wasm, no SharedArrayBuffer.
import { Mp3Encoder } from "@breezystack/lamejs"

import { floatToInt16 } from "./wav"

const BLOCK_SIZE = 1152 // MP3 frames are encoded in 1152-sample blocks.

/**
 * Encode mono Float32 samples as an MP3 Blob at the given bitrate (kbps).
 * The samples are clamped and converted to 16-bit PCM, then fed to lamejs
 * one block at a time.
 */
export function encodeMp3(
  samples: Float32Array,
  sampleRate: number,
  kbps: number
): Blob {
  const pcm = floatToInt16(samples)
  const encoder = new Mp3Encoder(1, sampleRate, kbps)
  const chunks: Uint8Array[] = []

  for (let i = 0; i < pcm.length; i += BLOCK_SIZE) {
    const block = pcm.subarray(i, i + BLOCK_SIZE)
    const encoded = encoder.encodeBuffer(block)
    if (encoded.length > 0) chunks.push(encoded)
  }

  const flushed = encoder.flush()
  if (flushed.length > 0) chunks.push(flushed)

  // lamejs' typings return a generic Uint8Array (ArrayBufferLike); at runtime
  // these are plain ArrayBuffer-backed views, safe to pass to Blob.
  return new Blob(chunks as unknown as BlobPart[], { type: "audio/mpeg" })
}
