import { splitSentences } from './sentences'

export type WordToken = {
  index: number
  text: string
  /** Letters/digits only, for ORP and length rules. */
  core: string
  sentenceIndex: number
  paragraphIndex: number
  endsSentence: boolean
  endsParagraph: boolean
  trailingPunct: string
}

const WORD_RE = /[^\s]+/g

function splitTrailingPunct(word: string): { text: string; core: string; trailingPunct: string } {
  const match = word.match(/^(.+?)([,;:.…!?]+)?$/)
  if (!match) {
    return { text: word, core: word, trailingPunct: '' }
  }
  const body = match[1]
  const trailingPunct = match[2] ?? ''
  const core = body.replace(/[^\p{L}\p{N}']+/gu, '') || body
  return { text: word, core, trailingPunct }
}

/** Tokenize cleaned book text into words with sentence/paragraph metadata. */
export function tokenize(cleanedText: string): WordToken[] {
  const paragraphs = cleanedText.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  const tokens: WordToken[] = []
  let sentenceIndex = 0

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const sentences = splitSentences(paragraph.trim())
    sentences.forEach((sentence, sentenceOffsetInParagraph) => {
      const words = sentence.match(WORD_RE) ?? []
      words.forEach((word, wordOffset) => {
        const { text, core, trailingPunct } = splitTrailingPunct(word)
        const isLastInSentence = wordOffset === words.length - 1
        const isLastInParagraph =
          isLastInSentence && sentenceOffsetInParagraph === sentences.length - 1
        tokens.push({
          index: tokens.length,
          text,
          core,
          sentenceIndex,
          paragraphIndex,
          endsSentence: isLastInSentence,
          endsParagraph: isLastInParagraph,
          trailingPunct: isLastInSentence
            ? trailingPunct || sentence.slice(-1).match(/[.!?]/)?.[0] || ''
            : trailingPunct,
        })
      })
      sentenceIndex += 1
    })
  })

  return tokens
}

/** Index of the first word of the sentence containing `wordIndex`. */
export function sentenceStartIndex(tokens: WordToken[], wordIndex: number): number {
  if (tokens.length === 0) return 0
  const clamped = Math.max(0, Math.min(wordIndex, tokens.length - 1))
  const target = tokens[clamped].sentenceIndex
  for (let i = clamped; i >= 0; i -= 1) {
    if (tokens[i].sentenceIndex !== target) return i + 1
  }
  return 0
}

/** Index of the first word of the previous sentence, or current sentence start if already there. */
export function backOneSentenceIndex(tokens: WordToken[], wordIndex: number): number {
  if (tokens.length === 0) return 0
  const start = sentenceStartIndex(tokens, wordIndex)
  if (wordIndex > start) return start
  if (start === 0) return 0
  return sentenceStartIndex(tokens, start - 1)
}

export function sentenceText(tokens: WordToken[], wordIndex: number): string {
  if (tokens.length === 0) return ''
  const start = sentenceStartIndex(tokens, wordIndex)
  const sentenceIdx = tokens[Math.min(wordIndex, tokens.length - 1)].sentenceIndex
  const words: string[] = []
  for (let i = start; i < tokens.length && tokens[i].sentenceIndex === sentenceIdx; i += 1) {
    words.push(tokens[i].text)
  }
  return words.join(' ')
}

export function paragraphText(tokens: WordToken[], wordIndex: number): string {
  if (tokens.length === 0) return ''
  const paragraphIdx = tokens[Math.min(wordIndex, tokens.length - 1)].paragraphIndex
  const words: string[] = []
  let start = wordIndex
  while (start > 0 && tokens[start - 1].paragraphIndex === paragraphIdx) start -= 1
  for (let i = start; i < tokens.length && tokens[i].paragraphIndex === paragraphIdx; i += 1) {
    words.push(tokens[i].text)
  }
  return words.join(' ')
}
