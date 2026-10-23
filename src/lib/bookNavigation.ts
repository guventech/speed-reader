import type { WordToken } from './tokenize'

/** Bounded display chunks, including books with unusually long paragraphs. */
export function readingChunks(tokens: WordToken[], maxWords = 180): WordToken[][] {
  const chunks: WordToken[][] = []
  for (const token of tokens) {
    const last = chunks[chunks.length - 1]
    if (!last || last.length >= maxWords || last[0].paragraphIndex !== token.paragraphIndex) {
      chunks.push([token])
    } else last.push(token)
  }
  return chunks
}

export function searchBook(tokens: WordToken[], query: string) {
  const needle = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (needle.length < 2) return []
  const text = tokens.map((t) => t.text.toLowerCase()).join(' ')
  const results: { wordIndex: number; excerpt: string }[] = []
  let offset = 0
  let wordIndex = 0
  let wordOffset = 0
  while (results.length < 30) {
    const found = text.indexOf(needle, offset)
    if (found < 0) break
    while (wordIndex + 1 < tokens.length && wordOffset + tokens[wordIndex].text.length < found) {
      wordOffset += tokens[wordIndex].text.length + 1
      wordIndex += 1
    }
    if (results.at(-1)?.wordIndex !== wordIndex) {
      results.push({ wordIndex, excerpt: tokens.slice(Math.max(0, wordIndex - 5), wordIndex + 16).map((t) => t.text).join(' ') })
    }
    offset = found + needle.length
  }
  return results
}
