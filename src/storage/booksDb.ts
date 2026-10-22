import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export type StoredBook = {
  id: string
  title: string
  rawText: string
  cleanedText: string
  createdAt: number
  updatedAt: number
}

export type BookPosition = {
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
  const books = await db.getAllFromIndex('books', 'by-updated')
  return books.reverse()
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('books', id)
  await db.delete('positions', id)
}

export async function savePosition(bookId: string, wordIndex: number): Promise<void> {
  const db = await getDb()
  await db.put('positions', { bookId, wordIndex, updatedAt: Date.now() })
}

export async function getPosition(bookId: string): Promise<number> {
  const db = await getDb()
  const pos = await db.get('positions', bookId)
  return pos?.wordIndex ?? 0
}

export function newBookId(): string {
  return `book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
