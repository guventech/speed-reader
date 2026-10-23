import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookPosition, StoredBook } from './booksDb'

const memory = vi.hoisted(() => ({ books: new Map<string, StoredBook>(), positions: new Map<string, BookPosition>() }))
vi.mock('idb', () => ({
  openDB: vi.fn(async () => {
    const store = (name: string) => name === 'books' ? memory.books : memory.positions
    return {
      getAll: async (name: string) => [...store(name).values()],
      get: async (name: string, id: string) => store(name).get(id),
      transaction: () => ({
        objectStore: (name: string) => ({
          getAll: async () => [...store(name).values()],
          put: async (value: StoredBook & BookPosition) => { store(name).set(name === 'books' ? value.id : value.bookId, value) },
        }),
        done: Promise.resolve(),
      }),
    }
  }),
}))
import { getBook, getPosition, listBooks, restoreBooks } from './booksDb'

const book = (id: string, text: string): StoredBook => ({ id, title: id, rawText: text, cleanedText: text, createdAt: 1, updatedAt: 1 })
beforeEach(() => { memory.books.clear(); memory.positions.clear() })
describe('restored library identities', () => {
  it('restores matching text into its existing identity and preserves unrelated books', async () => {
    memory.books.set('existing', book('existing', 'same book text'))
    memory.books.set('other', book('other', 'another book'))
    await restoreBooks([book('backup-id', 'same book text')], [{ bookId: 'backup-id', wordIndex: 2, updatedAt: 1 }])
    expect((await listBooks()).map((b) => b.id)).toEqual(['existing', 'other'])
    expect(await getPosition('existing')).toBe(2)
    expect(await getBook('other')).toEqual(book('other', 'another book'))
  })
  it('does not overwrite different book text when a restored ID collides', async () => {
    memory.books.set('collision', book('collision', 'original text'))
    await restoreBooks([book('collision', 'new text')], [{ bookId: 'collision', wordIndex: 1, updatedAt: 1 }])
    expect((await getBook('collision'))?.cleanedText).toBe('original text')
    const restored = (await listBooks()).find((b) => b.cleanedText === 'new text')!
    expect(restored.id).not.toBe('collision')
    expect(await getPosition(restored.id)).toBe(1)
    expect(await listBooks()).toHaveLength(2)
  })
  it('keeps different link-only books separate even though both texts are empty', async () => {
    memory.books.set('first', { ...book('first', ''), sourceUrl: 'https://example.org/first.txt', fingerprint: 'a'.repeat(64), wordCount: 10 })
    await restoreBooks([{ ...book('second', ''), sourceUrl: 'https://example.org/second.txt', fingerprint: 'b'.repeat(64), wordCount: 10 }], [{ bookId: 'second', wordIndex: 5, updatedAt: 1 }])
    expect(await listBooks()).toHaveLength(2)
    expect(await getPosition('second')).toBe(5)
  })
})
