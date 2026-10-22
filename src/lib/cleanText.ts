const START_MARKER = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*\n]*\*\*\*/i
const END_MARKER = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*\n]*\*\*\*/i

/** Strip Gutenberg wrapper; keep body between START and END markers when present. */
export function stripGutenbergBoilerplate(text: string): string {
  const start = text.search(START_MARKER)
  const end = text.search(END_MARKER)

  if (start === -1 || end === -1 || end <= start) {
    return text
  }

  const afterStart = text.slice(start).indexOf('\n')
  const bodyStart = afterStart === -1 ? start : start + afterStart + 1
  return text.slice(bodyStart, end).trim()
}

/** Join hyphenated line-breaks; keep in-line hyphens. */
export function joinHyphenatedLineBreaks(text: string): string {
  return text.replace(/(\w)-\r?\n(\w)/g, '$1$2')
}

/** Join wrapped lines; blank line starts a new paragraph. */
export function joinWrappedLines(text: string): string {
  const paragraphs = text.split(/\n\s*\n/)
  return paragraphs
    .map((paragraph) =>
      paragraph
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(' '),
    )
    .filter((paragraph) => paragraph.length > 0)
    .join('\n\n')
}

/** Normalise curly quotes/apostrophes and turn `--` into an em dash. */
export function normalisePunctuation(text: string): string {
  return text
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/--/g, '—')
}

/** Remove `_underscores_` used for italics markup. */
export function removeItalicUnderscores(text: string): string {
  return text.replace(/_([^_\n]+)_/g, '$1')
}

/** Full cleaning pipeline for Gutenberg (or plain) book text. */
export function cleanText(raw: string): string {
  let text = stripGutenbergBoilerplate(raw)
  text = joinHyphenatedLineBreaks(text)
  text = joinWrappedLines(text)
  text = normalisePunctuation(text)
  text = removeItalicUnderscores(text)
  return text.trim()
}

/** Read Gutenberg metadata Title: line, if present. */
export function extractGutenbergTitle(raw: string): string | null {
  const match = raw.match(/^\s*Title:\s*(.+)$/im)
  if (!match) return null
  return match[1].trim() || null
}
