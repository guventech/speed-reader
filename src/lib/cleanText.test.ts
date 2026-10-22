import { describe, expect, it } from 'vitest'
import { cleanText, extractGutenbergTitle } from './cleanText'

describe('cleanText', () => {
  it('removes Gutenberg header and footer including licence text', () => {
    const raw = [
      'Title: Sample Book',
      '',
      '*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE BOOK ***',
      '',
      'Hello world.',
      '',
      '*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE BOOK ***',
      '',
      '*** START: FULL LICENSE ***',
      'Licence junk',
    ].join('\n')

    expect(cleanText(raw)).toBe('Hello world.')
  })

  it('keeps the whole text when markers are missing', () => {
    expect(cleanText('Just a plain book.')).toBe('Just a plain book.')
  })

  it('joins words split by a hyphen at a line break', () => {
    expect(cleanText('impor-\ntant news')).toBe('important news')
  })

  it('keeps real hyphens inside a line', () => {
    expect(cleanText('a well-known fact')).toBe('a well-known fact')
  })

  it('joins wrapped lines inside a paragraph and keeps blank-line paragraphs', () => {
    const raw = ['First line', 'continues here.', '', 'Second paragraph.'].join('\n')
    expect(cleanText(raw)).toBe('First line continues here.\n\nSecond paragraph.')
  })

  it('normalises curly quotes and turns -- into an em dash', () => {
    expect(cleanText('“Hello,” she said—wait -- no.')).toBe(
      '"Hello," she said—wait — no.',
    )
  })

  it('removes underscores used for italics', () => {
    expect(cleanText('This is _important_ text.')).toBe('This is important text.')
  })
})

describe('extractGutenbergTitle', () => {
  it('reads the Title: line when present', () => {
    expect(extractGutenbergTitle('Title: Pride and Prejudice\n\nBody')).toBe(
      'Pride and Prejudice',
    )
  })

  it('returns null when no Title: line exists', () => {
    expect(extractGutenbergTitle('No title here')).toBeNull()
  })
})
