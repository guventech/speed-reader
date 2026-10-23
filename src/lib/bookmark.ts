import type { WordToken } from './tokenize'

export type BookmarkDetails = { context?: string; contextOffset?: number; chapter?: string }

export function bookmarkDetails(tokens: WordToken[], wordIndex: number): BookmarkDetails {
  const start = Math.max(0, wordIndex - 4)
  const context = tokens.slice(start, wordIndex + 8).map((t) => t.text).join(' ')
  return context && context.length <= 4096 ? { context, contextOffset: wordIndex - start } : {}
}

/** Return null rather than guessing when a changed edition has no unique anchor. */
export function relocateBookmark(tokens: WordToken[], saved: BookmarkDetails & { wordIndex: number }, unchanged: boolean): number | null {
  if (!tokens.length) return null
  if (unchanged) return Math.min(saved.wordIndex, tokens.length - 1)
  if (saved.wordIndex === 0) return 0
  if (!saved.context || saved.contextOffset === undefined) return null
  const words = saved.context.split(' ')
  let match: number | null = null
  for (let i = 0; i <= tokens.length - words.length; i++) {
    if (tokens[i].text !== words[0]) continue
    if (words.every((word, offset) => tokens[i + offset].text === word)) {
      if (match !== null) return null
      match = i + saved.contextOffset
    }
  }
  return match
}
