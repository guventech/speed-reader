import { describe, expect, it, vi } from 'vitest'
vi.mock('./booksDb', () => ({ restoreBooks: vi.fn() }))
import { importBackup, parseBackup } from './backup'
import { restoreBooks } from './booksDb'

const book = { id: 'a', title: 'Book', rawText: 'one two', cleanedText: 'one two', createdAt: 1, updatedAt: 1 }
const valid = { version: 1, books: [book], positions: [{ bookId: 'a', wordIndex: 1, updatedAt: 1 }] }
describe('reading backup validation', () => {
  it('preserves books and saved places without unknown fields', () => {
    expect(parseBackup(JSON.stringify({ ...valid, extra: 'ignore' }))).toEqual(valid)
  })
  it('rejects unsupported versions and malformed book records', () => {
    expect(() => parseBackup(JSON.stringify({ ...valid, version: 3 }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...valid, books: [null] }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...valid, books: [book, book] }))).toThrow()
  })
  it('rejects negative, fractional, missing-book and out-of-range positions', () => {
    for (const wordIndex of [-1, 0.5, 2]) {
      expect(() => parseBackup(JSON.stringify({ ...valid, positions: [{ bookId: 'a', wordIndex, updatedAt: 1 }] }))).toThrow()
    }
    expect(() => parseBackup(JSON.stringify({ ...valid, positions: [{ bookId: 'b', wordIndex: 0, updatedAt: 1 }] }))).toThrow()
  })
  it('validates the entire backup before changing storage', async () => {
    const file = { size: 100, text: async () => JSON.stringify({ ...valid, positions: [{ bookId: 'a', wordIndex: -1, updatedAt: 1 }] }) } as File
    await expect(importBackup(file)).rejects.toThrow()
    expect(restoreBooks).not.toHaveBeenCalled()
    await importBackup({ size: 100, text: async () => JSON.stringify(valid) } as File)
    expect(restoreBooks).toHaveBeenCalledWith(valid.books, valid.positions)
  })
  it('round-trips link-only books and passage bookmarks in version 2', () => {
    const linked = { ...book, rawText: '', cleanedText: '', sourceUrl: 'https://example.org/book.txt', fingerprint: 'a'.repeat(64), wordCount: 20 }
    const backup = { version: 2, books: [linked], positions: [{ bookId: 'a', wordIndex: 3, updatedAt: 1, context: 'a short saved passage', contextOffset: 2, chapter: 'Chapter 1' }] }
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)
  })
  it('rejects unrecoverable link-only records and malformed bookmark context', () => {
    expect(() => parseBackup(JSON.stringify({ ...valid, version: 2, books: [{ ...book, cleanedText: '' }] }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...valid, version: 2, positions: [{ ...valid.positions[0], context: 'word', contextOffset: 2 }] }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...valid, version: 2, books: [{ ...book, sourceUrl: 'javascript:alert(1)' }] }))).toThrow()
  })
  it('rejects a backup whose fingerprint does not match its downloaded text', async () => {
    vi.mocked(restoreBooks).mockClear()
    const inconsistent = { ...valid, version: 2, books: [{ ...book, fingerprint: 'a'.repeat(64), wordCount: 2 }] }
    await expect(importBackup({ size: 100, text: async () => JSON.stringify(inconsistent) } as File)).rejects.toThrow('does not match')
    expect(restoreBooks).not.toHaveBeenCalled()
  })
})
