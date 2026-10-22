import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findChapters } from './chapters'
import { cleanText, extractGutenbergTitle } from './cleanText'
import { tokenize } from './tokenize'

const fixture = resolve(process.cwd(), 'fixtures/pride-and-prejudice.txt')

describe.runIf(existsSync(fixture))('Pride and Prejudice fixture', () => {
  const raw = readFileSync(fixture, 'utf8')

  it('strips header/licence and falls back when Title: is absent', () => {
    // Modern Gutenberg plain text for 1342 may omit the Title: metadata line.
    const title = extractGutenbergTitle(raw)
    expect(title === null || /Pride and Prejudice/i.test(title)).toBe(true)
    const cleaned = cleanText(raw)
    expect(cleaned).not.toMatch(/START OF (THE|THIS) PROJECT GUTENBERG/i)
    expect(cleaned).not.toMatch(/END OF (THE|THIS) PROJECT GUTENBERG/i)
    expect(cleaned).not.toMatch(/START: FULL LICENSE/i)
    expect(cleaned.length).toBeGreaterThan(1000)
  })

  it('finds chapters and tokenizes the book', () => {
    const cleaned = cleanText(raw)
    const tokens = tokenize(cleaned)
    const chapters = findChapters(cleaned, tokens)
    expect(tokens.length).toBeGreaterThan(10000)
    expect(chapters.length).toBeGreaterThan(5)
    expect(chapters.some((c) => /chapter/i.test(c.title))).toBe(true)
  })
})
