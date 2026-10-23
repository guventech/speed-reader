import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { BookmarkDetails } from '../lib/bookmark'
import { tokenize } from '../lib/tokenize'

export type StoredBook = {
  id: string
  title: string
  rawText: string
  cleanedText: string
  createdAt: number
  updatedAt: number
  sourceUrl?: string
  fingerprint?: string
  wordCount?: number
}

export type BookPosition = BookmarkDetails & {
  bookId: string
  wordIndex: number
  updatedAt: number
}

interface SpeedReaderDB extends DBSchema {
  books: {
    key: string
    value: StoredBook
    indexes: { 'by-updated': number }
  }
  positions: {
    key: string
    value: BookPosition
  }
}

const DB_NAME = 'speed-reader'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<SpeedReaderDB>> | null = null

function getDb(): Promise<IDBPDatabase<SpeedReaderDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpeedReaderDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          const books = db.createObjectStore('books', { keyPath: 'id' })
          books.createIndex('by-updated', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('positions')) {
          db.createObjectStore('positions', { keyPath: 'bookId' })
        }
      },
    })
  }
  return dbPromise
}

export async function saveBook(
  book: Omit<StoredBook, 'createdAt' | 'updatedAt'> & {
    createdAt?: number
    updatedAt?: number
  },
): Promise<StoredBook> {
  const db = await getDb()
  const now = Date.now()
  const existing = await db.get('books', book.id)
  const stored: StoredBook = {
    id: book.id,
    title: book.title,
    rawText: book.rawText,
    cleanedText: book.cleanedText,
    createdAt: existing?.createdAt ?? book.createdAt ?? now,
    updatedAt: book.updatedAt ?? now,
    ...(book.sourceUrl ? { sourceUrl: book.sourceUrl } : {}),
    ...(book.fingerprint ? { fingerprint: book.fingerprint } : {}),
    ...(book.wordCount !== undefined ? { wordCount: book.wordCount } : {}),
  }
  await db.put('books', stored)
  return stored
}

export async function getBook(id: string): Promise<StoredBook | undefined> {
  const db = await getDb()
  return db.get('books', id)
}

export async function listBooks(): Promise<StoredBook[]> {
  const db = await getDb()
  const [books, positions] = await Promise.all([db.getAll('books'), db.getAll('positions')])
  const updated = new Map(positions.map((p) => [p.bookId, p.updatedAt]))
  return books.sort((a, b) => (updated.get(b.id) ?? b.updatedAt) - (updated.get(a.id) ?? a.updatedAt))
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('books', id)
  await db.delete('positions', id)
}

export async function savePosition(bookId: string, wordIndex: number, details: BookmarkDetails = {}): Promise<void> {
  const db = await getDb()
  await db.put('positions', { bookId, wordIndex, ...details, updatedAt: Date.now() })
}

export async function getPosition(bookId: string): Promise<number> {
  return (await getBookmark(bookId)).wordIndex
}

export async function getBookmark(bookId: string): Promise<BookPosition> {
  const db = await getDb()
  const pos = await db.get('positions', bookId)
  return pos ?? { bookId, wordIndex: 0, updatedAt: 0 }
}

/** Keep edition metadata and its bookmark consistent in one transaction. */
export async function saveBookWithPosition(book: StoredBook, position: BookPosition): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['books', 'positions'], 'readwrite')
  await Promise.all([
    tx.objectStore('books').put({ ...book, updatedAt: Date.now() }),
    tx.objectStore('positions').put({ ...position, bookId: book.id, updatedAt: Date.now() }),
    tx.done,
  ])
}

export function newBookId(): string {
  return `book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function restoreBooks(books: StoredBook[], positions: BookPosition[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['books', 'positions'], 'readwrite')
  const existing = await tx.objectStore('books').getAll()
  const restored: { book: StoredBook; position?: BookPosition }[] = []
  for (const book of books) {
    const match = existing.find((b) => (b.cleanedText && b.cleanedText === book.cleanedText) ||
      (b.fingerprint && b.fingerprint === book.fingerprint))
    // Preserve existing identities; do not overwrite a different book with a colliding ID.
    const id = match?.id ?? (existing.some((b) => b.id === book.id) ? newBookId() : book.id)
    const stored = match ? { ...match,
      sourceUrl: match.sourceUrl ?? book.sourceUrl,
      fingerprint: match.fingerprint ?? book.fingerprint,
      wordCount: match.wordCount ?? book.wordCount,
      cleanedText: match.cleanedText || book.cleanedText,
    } : { ...book, id }
    if (!match) existing.push(stored)
    const position = positions.find((p) => p.bookId === book.id)
    if (position && stored.cleanedText && position.wordIndex >= tokenize(stored.cleanedText).length) {
      throw new Error('A restored bookmark is outside the matching book. No books were restored.')
    }
    restored.push({ book: stored, position: position ? { ...position, bookId: id, updatedAt: Date.now() } : undefined })
  }
  await Promise.all([
    ...restored.flatMap(({ book, position }) => [
      tx.objectStore('books').put(book),
      ...(position ? [tx.objectStore('positions').put(position)] : []),
    ]),
    tx.done,
  ])
}
