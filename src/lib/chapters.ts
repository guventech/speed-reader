import type { WordToken } from './tokenize'

export type Chapter = {
  title: string
  /** Word index where this chapter starts. */
  wordIndex: number
}

const NAMED_HEADING = /^(?:CHAPTER|BOOK|PART)\s+\S+(?:\s+\S+){0,6}$/i

const ALL_CAPS_SHORT = /^[A-Z0-9][A-Z0-9 ,.'-]{0,60}$/

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (NAMED_HEADING.test(trimmed)) return true
  if (trimmed.length <= 60 && ALL_CAPS_SHORT.test(trimmed) && /[A-Z]/.test(trimmed)) {
    // Avoid treating ordinary short uppercase words mid-paragraph as headings:
    // require the line to look like a title (at least one space or roman/number pattern already covered)
    if (trimmed.split(/\s+/).length >= 2 || /^(?:CHAPTER|BOOK|PART)\b/i.test(trimmed)) {
      return true
    }
  }
  return false
}

/**
 * Build chapter list from heading lines, or ~2000-word sections if none found.
 * Headings are lines like CHAPTER I, Chapter 1, BOOK II, PART ONE, or short all-caps lines alone between blanks.
 */
export function findChapters(cleanedText: string, tokens: WordToken[]): Chapter[] {
  const lines = cleanedText.split(/\r?\n/)
  const headingWordIndices: Chapter[] = []

  // Map character offset of each paragraph-ish block start to nearest word index by scanning tokens text.
  // Simpler approach: walk cleaned text with a word counter matching tokenize.
  let searchFrom = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const prevBlank = i === 0 || lines[i - 1].trim() === ''
    const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === ''
    if (prevBlank && nextBlank && isHeadingLine(line)) {
      const title = line.trim()
      const idxInText = cleanedText.indexOf(line, searchFrom)
      const wordIndex = wordIndexAtOffset(cleanedText, tokens, Math.max(0, idxInText))
      headingWordIndices.push({ title, wordIndex })
      searchFrom = idxInText + line.length
    }
  }

  if (headingWordIndices.length > 0) {
    return dedupeChapters(headingWordIndices)
  }

  const sections: Chapter[] = []
  for (let i = 0; i < tokens.length; i += 2000) {
    sections.push({
      title: `Section ${sections.length + 1}`,
      wordIndex: i,
    })
  }
  if (sections.length === 0) {
    sections.push({ title: 'Section 1', wordIndex: 0 })
  }
  return sections
}

function wordIndexAtOffset(
  cleanedText: string,
  tokens: WordToken[],
  offset: number,
): number {
  if (tokens.length === 0) return 0
  // Approximate: count whitespace-separated tokens before offset
  const before = cleanedText.slice(0, offset)
  const count = before.match(/[^\s]+/g)?.length ?? 0
  return Math.min(count, tokens.length - 1)
}

function dedupeChapters(chapters: Chapter[]): Chapter[] {
  const result: Chapter[] = []
  for (const chapter of chapters) {
    const last = result[result.length - 1]
    if (last && last.wordIndex === chapter.wordIndex) continue
    result.push(chapter)
  }
  return result
}

export function chapterForWordIndex(chapters: Chapter[], wordIndex: number): Chapter {
  let current = chapters[0] ?? { title: 'Section 1', wordIndex: 0 }
  for (const chapter of chapters) {
    if (chapter.wordIndex <= wordIndex) current = chapter
    else break
  }
  return current
}
