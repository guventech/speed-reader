import { describe, expect, it } from 'vitest'
import { readingChunks, searchBook } from './bookNavigation'
import { tokenize } from './tokenize'

describe('book navigation', () => {
  it('bounds display work even for a whole book with no paragraph breaks', () => {
    const tokens = tokenize('word '.repeat(100000))
    const chunks = readingChunks(tokens)
    expect(chunks.every((c) => c.length <= 180)).toBe(true)
    expect(chunks.flat()).toEqual(tokens)
  })
  it('finds case-insensitive phrases at exact word positions', () => {
    const tokens = tokenize('First word.\n\nMr. Darcy saw Mr. Darcy again.')
    expect(searchBook(tokens, 'MR.   darcy').map((r) => r.wordIndex)).toEqual([2, 5])
    expect(searchBook(tokens, 'missing')).toEqual([])
    expect(searchBook(tokens, ' ')).toEqual([])
  })
  it('caps search results for common words in long books', () => {
    expect(searchBook(tokenize('the '.repeat(10000)), 'the')).toHaveLength(30)
  })
})
