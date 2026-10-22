import type { WordToken } from './tokenize'

/** Delay in ms before advancing past this word, given WPM and token features. */
export function wordDelayMs(token: WordToken, wpm: number): number {
  const safeWpm = Math.max(1, wpm)
  let delay = 60000 / safeWpm

  const letterCount = token.core.replace(/'/g, '').length
  if (letterCount > 12) delay *= 1.6
  else if (letterCount > 8) delay *= 1.3

  if (/\d/.test(token.core)) delay *= 1.5

  if (token.endsParagraph) {
    delay *= 3
  } else if (/[.!?]/.test(token.trailingPunct) || token.endsSentence) {
    delay *= 2
  } else if (/[,;:]/.test(token.trailingPunct)) {
    delay *= 1.5
  }

  return Math.round(delay)
}
