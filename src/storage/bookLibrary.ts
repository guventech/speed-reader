import { bookmarkDetails, relocateBookmark } from '../lib/bookmark'
import { describeBook, downloadBook, sourceUrl } from '../lib/bookSource'
import { cleanText, extractGutenbergTitle } from '../lib/cleanText'
import { tokenize } from '../lib/tokenize'
import { getBookmark, listBooks, newBookId, saveBook, saveBookWithPosition, type BookPosition, type StoredBook } from './booksDb'

export async function importBook(rawText: string, fileName: string, source?: string, keepOffline = true): Promise<StoredBook> {
  const url = source?.trim() ? sourceUrl(source) : undefined
  const cleanedText = cleanText(rawText)
  if (!cleanedText.trim()) throw new Error('No readable text found')
  const metadata = await describeBook(cleanedText)
  const existing = (await listBooks()).find((book) => book.cleanedText === cleanedText || book.fingerprint === metadata.fingerprint)
  const stored = await saveBook({
    id: existing?.id ?? newBookId(),
    title: existing?.title ?? extractGutenbergTitle(rawText) ?? fileName.replace(/\.txt$/i, ''),
    // New records need only the cleaned copy. Preserve legacy records until explicitly updated.
    rawText: '',
    cleanedText: keepOffline || existing?.cleanedText ? cleanedText : '',
    ...metadata,
    sourceUrl: url ?? existing?.sourceUrl,
  })
  return { ...stored, cleanedText }
}

export async function importLinkedBook(value: string): Promise<StoredBook> {
  const url = sourceUrl(value)
  const raw = await downloadBook(url)
  const name = new URL(url).pathname.split('/').pop() || 'Linked book'
  return importBook(raw, name, url, false)
}

export type PreparedBook = {
  activeBook: StoredBook
  storedBook: StoredBook
  position: BookPosition
  needsRestart: boolean
  changed: boolean
}

export async function prepareBook(book: StoredBook, keepOffline = false): Promise<PreparedBook> {
  const saved = await getBookmark(book.id)
  if (book.cleanedText) return { activeBook: book, storedBook: book, position: saved, needsRestart: false, changed: false }
  if (!book.sourceUrl) throw new Error('This book has no downloaded text or source link. Reimport the original file to resume.')
  const cleanedText = cleanText(await downloadBook(book.sourceUrl))
  const metadata = await describeBook(cleanedText)
  const tokens = tokenize(cleanedText)
  const changed = book.fingerprint !== metadata.fingerprint
  const wordIndex = relocateBookmark(tokens, saved, !changed)
  const position: BookPosition = { bookId: book.id, updatedAt: saved.updatedAt, wordIndex: wordIndex ?? 0,
    ...bookmarkDetails(tokens, wordIndex ?? 0), ...(!changed && saved.chapter ? { chapter: saved.chapter } : {}) }
  const storedBook = { ...book, ...metadata, rawText: '', cleanedText: keepOffline ? cleanedText : '' }
  return { activeBook: { ...storedBook, cleanedText }, storedBook, position, needsRestart: wordIndex === null, changed }
}

export async function savePreparedBook(prepared: PreparedBook): Promise<void> {
  await saveBookWithPosition(prepared.storedBook, prepared.position)
}

export async function attachSource(book: StoredBook, value: string): Promise<void> {
  const url = value.trim() ? sourceUrl(value) : undefined
  if (!url && !book.cleanedText) throw new Error('Download this book before removing its only source link.')
  await saveBook({ ...book, sourceUrl: url })
}

export async function removeDownloadedText(book: StoredBook): Promise<void> {
  if (!book.cleanedText || !book.sourceUrl) throw new Error('Add a working source link before removing downloaded text.')
  const downloaded = cleanText(await downloadBook(book.sourceUrl))
  const [local, remote] = await Promise.all([describeBook(book.cleanedText), describeBook(downloaded)])
  if (local.fingerprint !== remote.fingerprint) {
    throw new Error('The source contains different text. Your downloaded copy and bookmark were kept. Add a link to the same edition.')
  }
  const saved = await getBookmark(book.id)
  const position = { ...saved, ...bookmarkDetails(tokenize(book.cleanedText), saved.wordIndex) }
  await saveBookWithPosition({ ...book, ...local, rawText: '', cleanedText: '' }, position)
}
