import { describe, expect, it } from 'vitest'
import { splitSentences } from './sentences'

describe('splitSentences', () => {
  it('splits after closing dialogue quotes without splitting abbreviations', () => {
    expect(splitSentences('"Enough!" She left. "Ask Mr. Smith." Then silence.')).toEqual([
      '"Enough!"', 'She left.', '"Ask Mr. Smith."', 'Then silence.',
    ])
  })
  it('splits on full stops', () => {
    expect(splitSentences('Hello there. How are you? Fine!')).toEqual([
      'Hello there.',
      'How are you?',
      'Fine!',
    ])
  })

  it('does not split on common abbreviations', () => {
    const text =
      'Mr. Smith met Dr. Jones at St. Mary. Prof. Lee said e.g. this and i.e. that, vs. the rest, etc. No. 3 arrived.'
    const sentences = splitSentences(text)
    expect(sentences.length).toBeGreaterThanOrEqual(2)
    expect(sentences[0]).toContain('Mr. Smith')
    expect(sentences[0]).toContain('Dr. Jones')
    expect(sentences[0]).toContain('St. Mary.')
    expect(sentences.some((s) => s.includes('Prof. Lee'))).toBe(true)
  })

  it('does not split on single capital initials', () => {
    expect(splitSentences('J. R. Tolkien wrote books. End.')).toEqual([
      'J. R. Tolkien wrote books.',
      'End.',
    ])
  })

  it('does not split on decimal numbers', () => {
    expect(splitSentences('Pi is about 3.14 today. Done.')).toEqual([
      'Pi is about 3.14 today.',
      'Done.',
    ])
  })
})
