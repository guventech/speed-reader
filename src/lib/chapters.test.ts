import { describe, expect, it } from 'vitest'
import { findChapters } from './chapters'
import { tokenize } from './tokenize'

describe('findChapters', () => {
  it('detects CHAPTER and PART headings', () => {
    const text = [
      'CHAPTER I',
      '',
      'It is a truth.',
      '',
      'CHAPTER II',
      '',
      'More text here.',
      '',
      'PART ONE',
      '',
      'Final words.',
    ].join('\n')
    const tokens = tokenize(text)
    const chapters = findChapters(text, tokens)
    expect(chapters.map((c) => c.title)).toEqual(['CHAPTER I', 'CHAPTER II', 'PART ONE'])
    expect(chapters[0].wordIndex).toBe(0)
  })

  it('does not treat all-caps prose fragments as chapters', () => {
    const text = [
      'IT IS A TRUTH UNIVERSALLY ACKNOWLEDGED',
      '',
      'That a single man must be in want of a wife.',
      '',
      'HE WAS QUITE SURPRISED',
      '',
      'And then he left.',
    ].join('\n')
    const tokens = tokenize(text)
    const chapters = findChapters(text, tokens)
    expect(chapters).toEqual([{ title: 'Section 1', wordIndex: 0 }])
  })

  it('falls back to ~2000-word sections when no headings', () => {
    const words = Array.from({ length: 4500 }, (_, i) => `w${i}`).join(' ')
    const tokens = tokenize(words)
    const chapters = findChapters(words, tokens)
    expect(chapters.length).toBe(3)
    expect(chapters[0].title).toBe('Section 1')
    expect(chapters[1].wordIndex).toBe(2000)
    expect(chapters[2].wordIndex).toBe(4000)
  })
})
