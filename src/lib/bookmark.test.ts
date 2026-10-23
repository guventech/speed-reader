import { describe, expect, it } from 'vitest'
import { bookmarkDetails, relocateBookmark } from './bookmark'
import { tokenize } from './tokenize'

describe('source bookmarks', () => {
  const original = tokenize('one two three four five six seven eight nine ten eleven twelve thirteen fourteen')
  const saved = { wordIndex: 6, ...bookmarkDetails(original, 6) }
  it('keeps the exact word position for identical content', () => {
    expect(relocateBookmark(original, saved, true)).toBe(6)
  })
  it('relocates a unique passage after text is inserted', () => {
    const changed = tokenize('new introduction ' + original.map((t) => t.text).join(' '))
    expect(relocateBookmark(changed, saved, false)).toBe(8)
  })
  it('does not guess if a passage is missing or repeated', () => {
    expect(relocateBookmark(tokenize('a different book entirely'), saved, false)).toBeNull()
    expect(relocateBookmark(tokenize(saved.context + ' ' + saved.context), saved, false)).toBeNull()
    expect(relocateBookmark(original, { wordIndex: 6 }, false)).toBeNull()
  })
})
