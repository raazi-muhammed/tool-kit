// Pure-JS WAV encoding for the Video → Audio tool.
//
// No FFmpeg.wasm, no SharedArrayBuffer, no external libraries — just the Web
// Audio API for decoding (in the page) and the helpers below for turning the
// decoded PCM into a 16-bit mono WAV Blob. Works in Safari and Chrome.

/** Return the browser's AudioContext constructor, or null if unsupported. */
export function getAudioContext(): (new () => AudioContext) | null {
  if (typeof window === "undefined") return null
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: new () => AudioContext })
      .webkitAudioContext ??
    null
  )
}

/**
 * Decode an ArrayBuffer to an AudioBuffer, supporting both the modern
 * promise-based `decodeAudioData` and the older Safari callback signature.
 */
export function decodeAudioData(
  ctx: AudioContext,
  data: ArrayBuffer,
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const maybePromise = ctx.decodeAudioData(data, resolve, reject)
    // Modern browsers also return a promise from decodeAudioData.
    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise.then(resolve, reject)
    }
  })
}

/** Average every channel of an AudioBuffer into a single mono Float32Array. */
export function mixToMono(buffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = buffer
  const mono = new Float32Array(length)
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) mono[i] += data[i]
  }
  if (numberOfChannels > 1) {
    for (let i = 0; i < length; i++) mono[i] /= numberOfChannels
  }
  return mono
}

/**
 * Encode mono Float32 samples as a 16-bit PCM mono WAV Blob by writing the
 * 44-byte RIFF/WAV header manually, then the samples clamped to [-1, 1] and
 * scaled to little-endian Int16.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataSize = samples.length * 2 // 2 bytes per 16-bit sample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // --- 44-byte RIFF/WAV header ---
  writeString(0, "RIFF") // ChunkID
  view.setUint32(4, 36 + dataSize, true) // ChunkSize
  writeString(8, "WAVE") // Format
  writeString(12, "fmt ") // Subchunk1ID
  view.setUint32(16, 16, true) // Subchunk1Size
  view.setUint16(20, 1, true) // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true) // NumChannels (mono)
  view.setUint32(24, sampleRate, true) // SampleRate
  view.setUint32(28, sampleRate * 2, true) // ByteRate = sampleRate * blockAlign
  view.setUint16(32, 2, true) // BlockAlign = NumChannels * bitsPerSample/8
  view.setUint16(34, 16, true) // BitsPerSample
  writeString(36, "data") // Subchunk2ID
  view.setUint32(40, dataSize, true) // Subchunk2Size

  // --- PCM samples: clamp to [-1, 1], scale to Int16, little-endian ---
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped * 32767, true)
    offset += 2
  }

  return new Blob([view], { type: "audio/wav" })
}

/** Swap a filename's extension for `.wav` (e.g. `clip.mp4` → `clip.wav`). */
export function toWavFilename(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "")
  return `${base || "audio"}.wav`
}

/** Human-readable byte size, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}
