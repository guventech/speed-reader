// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { webcrypto } from 'node:crypto'
import type { StoredBook } from './storage/booksDb'
import type { BookmarkDetails } from './lib/bookmark'

const storage = vi.hoisted(() => ({ books: [] as StoredBook[], positions: new Map<string, number>(), bookmarks: new Map<string, BookmarkDetails>() }))
vi.mock('./storage/booksDb', () => ({
  listBooks: vi.fn(async () => [...storage.books]),
  getPosition: vi.fn(async (id: string) => storage.positions.get(id) ?? 0),
  getBookmark: vi.fn(async (id: string) => ({ bookId: id, wordIndex: storage.positions.get(id) ?? 0, updatedAt: 1, ...storage.bookmarks.get(id) })),
  savePosition: vi.fn(async (id: string, position: number, details: BookmarkDetails) => { storage.positions.set(id, position); storage.bookmarks.set(id, details) }),
  saveBook: vi.fn(async (book) => {
    const saved = { ...book, createdAt: 1, updatedAt: 1 }
    storage.books = [...storage.books.filter((b) => b.id !== book.id), saved]
    return saved
  }),
  saveBookWithPosition: vi.fn(async (book, position) => {
    storage.books = [...storage.books.filter((b) => b.id !== book.id), book]
    storage.positions.set(book.id, position.wordIndex)
    storage.bookmarks.set(book.id, position)
  }),
  newBookId: () => 'test-book', deleteBook: vi.fn(), restoreBooks: vi.fn(),
}))

let root: Root
let host: HTMLDivElement
async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find((b) => b.textContent === text)
  expect(button, `button ${text}`).toBeTruthy()
  await act(async () => button!.click())
  await vi.waitFor(async () => {
    await act(async () => {})
    expect(host.textContent).not.toContain('Working…')
  })
}
async function fill(selector: string, value: string) {
  const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  await act(async () => {
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
beforeEach(async () => {
  vi.useFakeTimers()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  localStorage.clear()
  storage.books = []
  storage.positions.clear()
  storage.bookmarks.clear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(createElement(App)))
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('full reading workflow', () => {
  it('applies independent sizes to the RSVP word, paused context and pacer', async () => {
    await fill('#paste-box', 'one two three four five six seven eight nine ten.')
    await click('Use pasted text')
    expect(host.querySelector<HTMLElement>('.rsvp-stage')?.style.fontSize).toBe('32px')
    expect(host.querySelector<HTMLElement>('.paused-sentence')?.style.fontSize).toBe('20px')
    await click('Show paragraph')
    expect(host.querySelector<HTMLElement>('.paused-paragraph')?.style.fontSize).toBe('20px')
    await click('Settings')
    await fill('#rsvp-font-size', '48')
    await fill('#context-font-size', '24')
    await fill('#font-size', '22')
    await click('Back')
    expect(host.querySelector<HTMLElement>('.rsvp-stage')?.style.fontSize).toBe('48px')
    expect(host.querySelector<HTMLElement>('.paused-sentence')?.style.fontSize).toBe('24px')
    await click('Show paragraph')
    expect(host.querySelector<HTMLElement>('.paused-paragraph')?.style.fontSize).toBe('24px')
    await click('Pacer')
    expect(host.querySelector<HTMLElement>('.pacer-stage')?.style.fontSize).toBe('22px')
    expect(host.querySelector('.paused-sentence')).toBeNull()
    expect(JSON.parse(localStorage.getItem('speed-reader:settings')!)).toMatchObject({ rsvpFontSizePx: 48, contextFontSizePx: 24, fontSizePx: 22 })
  })
  it('shows saved books before the collapsed import form without hiding action errors', async () => {
    await fill('#paste-box', 'one two three four five six seven eight nine ten.')
    await click('Use pasted text')
    await click('Books')
    const library = host.querySelector('.book-list')!
    const importer = host.querySelector<HTMLDetailsElement>('.import-panel')!
    expect(library.compareDocumentPosition(importer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(importer.open).toBe(false)
    await act(async () => importer.querySelector('summary')!.click())
    expect(importer.open).toBe(true)
    await fill('#import-source', 'https://example.org/book.txt')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await click('Open from link')
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('source could not be read')
    expect(importer.contains(host.querySelector('[role="alert"]'))).toBe(false)
  })
  it('selects pacer words with the keyboard, keeps focus and respects book boundaries', async () => {
    await fill('#paste-box', 'one two one three. A quiet room.')
    await click('Use pasted text')
    await click('Pacer')
    expect(host.querySelector('.paused-panel')).toBeNull()
    const active = () => host.querySelector<HTMLButtonElement>('.pacer-word-active')!
    const arrow = async (key: string) => {
      await act(async () => active().dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true })))
    }
    active().focus()
    await arrow('ArrowRight')
    expect(active().textContent).toBe('two')
    expect(document.activeElement).toBe(active())
    await arrow('ArrowLeft')
    expect(active().textContent).toBe('one')
    await arrow('ArrowLeft')
    expect(active().dataset.wordIndex).toBe('0')
    await act(async () => host.querySelectorAll<HTMLButtonElement>('.pacer-word')[2].click())
    expect(active().dataset.wordIndex).toBe('2')
    expect(host.querySelectorAll('.pacer-word[tabindex="0"]')).toHaveLength(1)
    const words = host.querySelectorAll<HTMLButtonElement>('.pacer-word')
    await act(async () => words[words.length - 1].click())
    await arrow('ArrowRight')
    expect(active().textContent).toBe('room.')
    await click('Play')
    expect(active().disabled).toBe(true)
    await click('Pause')
    await click('RSVP')
    expect(host.querySelector('.word-mark')?.textContent).toBe('room.')
  })
  it('reads a linked book without storing its text, then downloads, frees space and resumes', async () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen'
    const fetcher = vi.fn().mockImplementation(async () => new Response(text, { headers: { 'content-type': 'text/plain' } }))
    vi.stubGlobal('fetch', fetcher)
    await fill('#import-source', 'https://example.org/book.txt')
    expect(fetcher).not.toHaveBeenCalled()
    await click('Open from link')
    expect(storage.books[0].cleanedText).toBe('')
    expect(storage.books[0].sourceUrl).toBe('https://example.org/book.txt')
    const chosen = [...host.querySelectorAll<HTMLButtonElement>('.context-word')].find((b) => b.textContent === 'seven')!
    await act(async () => chosen.click())
    await click('Books')
    expect(storage.positions.get('test-book')).toBe(6)
    expect(host.textContent).toContain('Internet required')
    await click('Keep offline')
    expect(storage.books[0].cleanedText).toBe(text)
    expect(host.textContent).toContain('Available offline')
    await click('Remove downloaded text, keep my place')
    expect(storage.books[0].cleanedText).toBe('')
    expect(storage.books[0].rawText).toBe('')
    expect(storage.positions.get('test-book')).toBe(6)
    await click('Continue reading')
    expect(host.querySelector('.word-mark')?.textContent).toBe('seven')
    expect(storage.books[0].cleanedText).toBe('')
    await click('Books')
    fetcher.mockRejectedValueOnce(new TypeError('offline'))
    await click('Continue reading')
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('source could not be read')
    expect(storage.positions.get('test-book')).toBe(6)
    expect(storage.books[0].sourceUrl).toBe('https://example.org/book.txt')
  })
  it('lets the reader cancel a changed edition without replacing the saved bookmark', async () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen'
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(text, { headers: { 'content-type': 'text/plain' } }))
    vi.stubGlobal('fetch', fetcher)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await fill('#import-source', 'https://example.org/book.txt')
    await click('Open from link')
    await act(async () => host.querySelectorAll<HTMLButtonElement>('.context-word')[4].click())
    await click('Books')
    const fingerprint = storage.books[0].fingerprint
    const position = storage.positions.get('test-book')
    fetcher.mockResolvedValueOnce(new Response('a completely different edition', { headers: { 'content-type': 'text/plain' } }))
    await click('Continue reading')
    expect(window.confirm).toHaveBeenCalled()
    expect(storage.books[0].fingerprint).toBe(fingerprint)
    expect(storage.positions.get('test-book')).toBe(position)
    expect(host.textContent).toContain('Continue reading')
    vi.restoreAllMocks()
  })
  it('imports, finds a passage, selects the correct repeated word, and resumes after settings or reimport', async () => {
    const text = 'Title: A Test Book\n*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\n\nCHAPTER I\n\none two one three. A quiet room.\n\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***'
    await fill('#paste-box', text)
    await click('Use pasted text')
    expect(host.querySelector('h1')?.textContent).toBe('A Test Book')
    await click('Find text')
    await fill('#book-search', 'quiet room')
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(host.querySelectorAll('.search-results button')).toHaveLength(1)
    await act(async () => host.querySelector<HTMLButtonElement>('.search-results button')!.click())
    expect(host.querySelector('.word-mark')?.textContent).toBe('quiet')
    await click('Back sentence')
    await click('Back sentence')
    const repeated = [...host.querySelectorAll<HTMLButtonElement>('.context-word')].filter((b) => b.textContent === 'one')
    expect(repeated).toHaveLength(2)
    await act(async () => repeated[1].click())
    expect(repeated[1].getAttribute('aria-current')).toBe('location')
    expect(repeated[0].getAttribute('aria-current')).toBeNull()
    const position = storage.positions.get('test-book')
    await click('Settings')
    await click('Back')
    expect(host.querySelector('.word-mark')?.textContent).toBe('one')
    expect(storage.positions.get('test-book')).toBe(position)
    await click('Books')
    expect(host.textContent).toContain('Continue reading')
    await fill('#paste-box', text)
    await click('Use pasted text')
    expect(storage.books).toHaveLength(1)
    expect(storage.positions.get('test-book')).toBe(position)
    expect(host.querySelectorAll('.context-word')[2].getAttribute('aria-current')).toBe('location')
  })
  it('preserves place across reading modes and pauses before navigation', async () => {
    await fill('#paste-box', 'one two three four five six seven eight nine ten.')
    await click('Use pasted text')
    await click('Play')
    await act(async () => vi.advanceTimersByTime(720))
    await click('Pacer')
    expect(host.querySelector('.pacer-word-active')?.textContent?.trim()).toBe('four')
    await click('Chapters')
    const position = storage.positions.get('test-book')
    await act(async () => vi.advanceTimersByTime(10000))
    expect(storage.positions.get('test-book')).toBe(position)
    await click('Back')
    expect(host.querySelector('.pacer-word-active')?.textContent?.trim()).toBe('four')
    expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Play')).toBe(true)
  })
})
