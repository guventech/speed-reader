import { describe, expect, it } from 'vitest'
import { wordDelayMs } from './pacing'
import type { WordToken } from './tokenize'

function token(partial: Partial<WordToken> & Pick<WordToken, 'text'>): WordToken {
  return {
    index: 0,
    text: partial.text,
    core: partial.core ?? partial.text.replace(/[^\p{L}\p{N}']+/gu, ''),
    sentenceIndex: 0,
    paragraphIndex: 0,
    endsSentence: partial.endsSentence ?? false,
    endsParagraph: partial.endsParagraph ?? false,
    trailingPunct: partial.trailingPunct ?? '',
  }
}

describe('wordDelayMs', () => {
  const wpm = 600 // base = 100ms

  it('uses base time from wpm', () => {
    expect(wordDelayMs(token({ text: 'hello' }), wpm)).toBe(100)
  })

  it('slows words longer than 8 letters', () => {
    expect(wordDelayMs(token({ text: 'abcdefghi' }), wpm)).toBe(130)
  })

  it('slows words longer than 12 letters more', () => {
    expect(wordDelayMs(token({ text: 'abcdefghijklm' }), wpm)).toBe(160)
  })

  it('slows words with digits', () => {
    expect(wordDelayMs(token({ text: 'A1' }), wpm)).toBe(150)
  })

  it('slows after comma semicolon or colon', () => {
    expect(wordDelayMs(token({ text: 'wait', trailingPunct: ',' }), wpm)).toBe(150)
    expect(wordDelayMs(token({ text: 'wait', trailingPunct: ';' }), wpm)).toBe(150)
    expect(wordDelayMs(token({ text: 'wait', trailingPunct: ':' }), wpm)).toBe(150)
  })

  it('slows after full stop question or exclamation', () => {
    expect(wordDelayMs(token({ text: 'End', trailingPunct: '.', endsSentence: true }), wpm)).toBe(
      200,
    )
    expect(wordDelayMs(token({ text: 'End', trailingPunct: '?', endsSentence: true }), wpm)).toBe(
      200,
    )
    expect(wordDelayMs(token({ text: 'End', trailingPunct: '!', endsSentence: true }), wpm)).toBe(
      200,
    )
  })

  it('slows at the end of a paragraph', () => {
    expect(
      wordDelayMs(
        token({ text: 'End', trailingPunct: '.', endsSentence: true, endsParagraph: true }),
        wpm,
      ),
    ).toBe(300)
  })
})
