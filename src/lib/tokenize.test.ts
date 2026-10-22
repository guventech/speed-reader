import { describe, expect, it } from 'vitest'
import { tokenize } from './tokenize'

describe('tokenize', () => {
  it('builds word tokens with sentence and paragraph ends', () => {
    const tokens = tokenize('Hello world. Next para.\n\nSecond bit!')
    expect(tokens.map((t) => t.text)).toEqual([
      'Hello',
      'world.',
      'Next',
      'para.',
      'Second',
      'bit!',
    ])
    expect(tokens[1].endsSentence).toBe(true)
    expect(tokens[3].endsParagraph).toBe(true)
    expect(tokens[5].endsSentence).toBe(true)
    expect(tokens[5].endsParagraph).toBe(true)
  })
})
