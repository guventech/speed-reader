import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookPosition, StoredBook } from './booksDb'
import { attachSource, importBook, importLinkedBook, prepareBook, removeDownloadedText, savePreparedBook } from './bookLibrary'
import { bookmarkDetails } from '../lib/bookmark'
import { describeBook } from '../lib/bookSource'
import { tokenize } from '../lib/tokenize'

const memory = vi.hoisted(() => ({ books: new Map<string, StoredBook>(), positions: new Map<string, BookPosition>() }))
vi.mock('./booksDb', () => ({
  listBooks: async () => [...memory.books.values()],
  newBookId: () => 'new-book',
  getBookmark: async (id: string) => memory.positions.get(id) ?? { bookId: id, wordIndex: 0, updatedAt: 0 },
  saveBook: async (book: StoredBook) => {
    const saved = { ...book, createdAt: book.createdAt ?? 1, updatedAt: 1 }
    memory.books.set(book.id, saved)
    return saved
  },
  saveBookWithPosition: async (book: StoredBook, position: BookPosition) => {
    memory.books.set(book.id, book)
    memory.positions.set(book.id, position)
  },
}))
const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen'
function serve(body = text) {
  const fetcher = vi.fn().mockImplementation(async () => new Response(body, { headers: { 'content-type': 'text/plain' } }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
beforeEach(() => { memory.books.clear(); memory.positions.clear() })
afterEach(() => vi.unstubAllGlobals())

describe('book storage choices', () => {
  it('keeps a new linked book only in memory until offline storage is requested', async () => {
    serve()
    const active = await importLinkedBook('https://example.org/book.txt')
    expect(active.cleanedText).toBe(text)
    expect(memory.books.get(active.id)?.cleanedText).toBe('')
    expect(memory.books.get(active.id)?.rawText).toBe('')
    const prepared = await prepareBook(memory.books.get(active.id)!, true)
    await savePreparedBook(prepared)
    expect(memory.books.get(active.id)?.cleanedText).toBe(text)
  })
  it('stores only cleaned text for pasted books and resumes matching imports', async () => {
    const active = await importBook(text, 'pasted.txt')
    memory.positions.set(active.id, { bookId: active.id, wordIndex: 6, updatedAt: 1 })
    const again = await importBook(text, 'renamed.txt', 'https://example.org/book.txt')
    expect(again.id).toBe(active.id)
    expect(memory.books.size).toBe(1)
    expect(again.rawText).toBe('')
    expect(again.sourceUrl).toBe('https://example.org/book.txt')
    expect(memory.positions.get(active.id)?.wordIndex).toBe(6)
  })
  it('verifies the source before removing text, preserving a relocatable bookmark', async () => {
    const book = await importBook(text, 'book.txt', 'https://example.org/book.txt')
    memory.positions.set(book.id, { bookId: book.id, wordIndex: 6, updatedAt: 1 })
    serve('different edition')
    await expect(removeDownloadedText(book)).rejects.toThrow('different text')
    expect(memory.books.get(book.id)?.cleanedText).toBe(text)
    expect(memory.positions.get(book.id)?.wordIndex).toBe(6)
    serve()
    await removeDownloadedText(book)
    expect(memory.books.get(book.id)?.cleanedText).toBe('')
    expect(memory.positions.get(book.id)?.context).toContain('seven')
    expect(memory.positions.get(book.id)?.wordIndex).toBe(6)
    const reopened = await prepareBook(memory.books.get(book.id)!)
    expect(reopened.position.wordIndex).toBe(6)
    expect(reopened.storedBook.cleanedText).toBe('')
    expect(reopened.activeBook.cleanedText).toBe(text)
    const recovered = await importBook(text, 'renamed-copy.txt')
    expect(recovered.id).toBe(book.id)
    expect(memory.positions.get(book.id)?.wordIndex).toBe(6)
    expect(memory.books.get(book.id)?.cleanedText).toBe(text)
  })
  it('keeps the download and bookmark when the source fails', async () => {
    const book = await importBook(text, 'book.txt', 'https://example.org/book.txt')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(removeDownloadedText(book)).rejects.toThrow()
    expect(memory.books.get(book.id)).toEqual(book)
  })
  it('relocates changed editions without silently overwriting an unresolvable bookmark', async () => {
    const original = { id: 'linked', title: 'Book', rawText: '', cleanedText: '', sourceUrl: 'https://example.org/book.txt',
      ...await describeBook(text), createdAt: 1, updatedAt: 1 }
    memory.books.set(original.id, original)
    const saved = { bookId: original.id, wordIndex: 6, updatedAt: 1, ...bookmarkDetails(tokenize(text), 6) }
    memory.positions.set(original.id, saved)
    serve('new introduction ' + text)
    const relocated = await prepareBook(original)
    expect(relocated.changed).toBe(true)
    expect(relocated.needsRestart).toBe(false)
    expect(relocated.position.wordIndex).toBe(8)
    expect(memory.positions.get(original.id)).toEqual(saved)
    serve('a completely different edition')
    const changed = await prepareBook(original)
    expect(changed.needsRestart).toBe(true)
    expect(memory.positions.get(original.id)).toEqual(saved)
    expect(memory.books.get(original.id)).toEqual(original)
  })
  it('does not allow removing the only recovery link from a link-only book', async () => {
    serve()
    const active = await importLinkedBook('https://example.org/book.txt')
    const stored = memory.books.get(active.id)!
    await expect(attachSource(stored, '')).rejects.toThrow('Download this book')
    expect(memory.books.get(active.id)?.sourceUrl).toBe('https://example.org/book.txt')
  })
})
