import type { WordToken } from './tokenize'

export type Chapter = {
  title: string
  /** Word index where this chapter starts. */
  wordIndex: number
}

/** CHAPTER I, Chapter 1, BOOK II, PART ONE, etc. */
const NAMED_HEADING =
  /^(?:CHAPTER|BOOK|PART)\s+(?:[IVXLCDM]+|\d+|[A-Za-z]+)(?:[.\])])?(?:\s+[A-Za-z][\w'-]*){0,4}\.?$/i

/** Short all-caps title lines only (not prose). */
const ALL_CAPS_TITLE = /^[A-Z0-9][A-Z0-9 ,.'-]{1,50}$/

function isNamedHeading(line: string): boolean {
  return NAMED_HEADING.test(line.trim())
}

function isStrictAllCapsTitle(line: string): boolean {
  const trimmed = line.trim()
  if (!ALL_CAPS_TITLE.test(trimmed)) return false
  if (/[.!?]$/.test(trimmed)) return false
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 5) return false
  // Reject all-caps sentences that look like prose fragments.
  const proseStarters = /^(THE|A|AN|IT|HE|SHE|THEY|WE|YOU|I|AND|BUT|FOR|SO|AS|IF|WHEN|WHERE|WHAT|THIS|THAT)\b/
  if (proseStarters.test(trimmed)) return false
  return true
}

/**
 * Build chapter list from heading paragraphs, or ~2000-word sections if none found.
 * Headings: CHAPTER/BOOK/PART lines, or short all-caps titles alone between blank lines.
 */
export function findChapters(cleanedText: string, tokens: WordToken[]): Chapter[] {
  const paragraphs = cleanedText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const explicitHeadings: Chapter[] = []
  const titleHeadings: Chapter[] = []
  let searchFrom = 0

  for (const paragraph of paragraphs) {
    const idxInText = cleanedText.indexOf(paragraph, searchFrom)
    searchFrom = idxInText + paragraph.length
    // Gutenberg illustration captions can leave headings such as "Chapter I.]".
    // Normalize the navigation label only; keep book text and word offsets intact.
    const title = paragraph.replace(/^[[(]\s*/, '').replace(/\s*[)\]]+$/, '').trim()
    const explicit = isNamedHeading(title)
    if (!explicit && !isStrictAllCapsTitle(paragraph)) continue
    const wordIndex = wordIndexAtOffset(cleanedText, tokens, Math.max(0, idxInText))
    if (explicit) explicitHeadings.push({ title, wordIndex })
    else titleHeadings.push({ title: paragraph, wordIndex })
  }

  // Numbered/named headings are stronger evidence than capitals in front matter.
  const headingWordIndices = explicitHeadings.length ? explicitHeadings : titleHeadings
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
  if (chapters[0] && wordIndex < chapters[0].wordIndex) return { title: 'Front matter', wordIndex: 0 }
  let current = chapters[0] ?? { title: 'Section 1', wordIndex: 0 }
  for (const chapter of chapters) {
    if (chapter.wordIndex <= wordIndex) current = chapter
    else break
  }
  return current
}
