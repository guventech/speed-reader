import { getBookmark, listBooks, restoreBooks, type BookPosition, type StoredBook } from './booksDb'
import { tokenize } from '../lib/tokenize'
import { describeBook, sourceUrl } from '../lib/bookSource'

export type ReadingBackup = { version: 1 | 2; books: StoredBook[]; positions: BookPosition[] }

export function parseBackup(raw: string): ReadingBackup {
  const data = JSON.parse(raw) as ReadingBackup
  if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.books) || !Array.isArray(data.positions)) {
    throw new Error('Choose a Speed Reader backup file (version 1 or 2).')
  }
  const ids = new Set<string>()
  const books: StoredBook[] = data.books.map((book) => {
    if (!book || typeof book.id !== 'string' || !book.id || ids.has(book.id) ||
      typeof book.title !== 'string' || typeof book.rawText !== 'string' || typeof book.cleanedText !== 'string' ||
      !Number.isFinite(book.createdAt) || !Number.isFinite(book.updatedAt)) {
      throw new Error('This backup contains invalid book data.')
    }
    ids.add(book.id)
    const stored: StoredBook = { id: book.id, title: book.title, rawText: book.rawText, cleanedText: book.cleanedText,
      createdAt: book.createdAt, updatedAt: book.updatedAt }
    if (data.version === 2) {
      if (book.sourceUrl !== undefined) {
        if (typeof book.sourceUrl !== 'string') throw new Error('Invalid source link in backup.')
        stored.sourceUrl = sourceUrl(book.sourceUrl)
      }
      if (book.fingerprint !== undefined) {
        if (typeof book.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(book.fingerprint)) throw new Error('Invalid book fingerprint in backup.')
        stored.fingerprint = book.fingerprint
      }
      if (book.wordCount !== undefined) {
        if (!Number.isSafeInteger(book.wordCount) || book.wordCount < 1) throw new Error('Invalid word count in backup.')
        stored.wordCount = book.wordCount
      }
    }
    if (!stored.cleanedText.trim() && (!stored.sourceUrl || !stored.fingerprint || !stored.wordCount)) {
      throw new Error('A book without downloaded text needs a source link and valid book information.')
    }
    return stored
  })
  const positioned = new Set<string>()
  const positions: BookPosition[] = data.positions.map((p) => {
    if (!p || !ids.has(p.bookId) || positioned.has(p.bookId) || !Number.isSafeInteger(p.wordIndex) || p.wordIndex < 0 || !Number.isFinite(p.updatedAt)) {
      throw new Error('This backup contains invalid reading positions.')
    }
    positioned.add(p.bookId)
    const book = books.find((b) => b.id === p.bookId)!
    const count = book.cleanedText ? tokenize(book.cleanedText).length : book.wordCount!
    if (p.wordIndex >= count) throw new Error('A saved position is outside its book.')
    const position: BookPosition = { bookId: p.bookId, wordIndex: p.wordIndex, updatedAt: p.updatedAt }
    if (data.version === 2) {
      if (p.context !== undefined || p.contextOffset !== undefined) {
        if (typeof p.context !== 'string' || !p.context.trim() || p.context.length > 4096 || typeof p.contextOffset !== 'number' || !Number.isSafeInteger(p.contextOffset) ||
          p.contextOffset < 0 || p.contextOffset >= p.context.split(' ').length) throw new Error('Invalid bookmark passage in backup.')
        position.context = p.context
        position.contextOffset = p.contextOffset
      }
      if (p.chapter !== undefined) {
        if (typeof p.chapter !== 'string' || p.chapter.length > 500) throw new Error('Invalid chapter in backup.')
        position.chapter = p.chapter
      }
    }
    return position
  })
  return { version: data.version, books, positions }
}

export async function downloadBackup(): Promise<void> {
  const books = await listBooks()
  const positions = await Promise.all(books.map((book) => getBookmark(book.id)))
  const backup: ReadingBackup = { version: 2, books, positions }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'speed-reader-books-and-progress.json'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function importBackup(file: File): Promise<void> {
  if (file.size > 50 * 1024 * 1024) throw new Error('Choose a backup smaller than 50 MB.')
  const backup = parseBackup(await file.text())
  for (const book of backup.books) {
    if (book.cleanedText && (book.fingerprint || book.wordCount)) {
      const metadata = await describeBook(book.cleanedText)
      if ((book.fingerprint && book.fingerprint !== metadata.fingerprint) ||
        (book.wordCount && book.wordCount !== metadata.wordCount)) {
        throw new Error('The backup text does not match its book information. No data was restored.')
      }
    }
  }
  await restoreBooks(backup.books, backup.positions)
}
