const READING_WORDS_PER_MINUTE = 200
const SPEAKING_WORDS_PER_MINUTE = 150

export type TextStats = {
  characters: number
  words: number
  sentences: number
  paragraphs: number
  readingSeconds: number
  speakingSeconds: number
}

export function computeTextStats(text: string): TextStats {
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/).length : 0
  const sentences = trimmed
    ? trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0).length
    : 0
  const paragraphs = trimmed
    ? trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length
    : 0

  return {
    characters: text.length,
    words,
    sentences,
    paragraphs,
    readingSeconds: (words / READING_WORDS_PER_MINUTE) * 60,
    speakingSeconds: (words / SPEAKING_WORDS_PER_MINUTE) * 60,
  }
}

// e.g. 0 -> "0s", 49 -> "49s", 109 -> "1m 49s"
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}
