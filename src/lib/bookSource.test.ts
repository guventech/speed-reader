import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeBook, downloadBook, MAX_BOOK_BYTES, sourceUrl } from './bookSource'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('book source downloads', () => {
  it('accepts HTTPS links and rejects credentials and unsafe protocols', () => {
    expect(sourceUrl(' https://example.org/book.txt#chapter ')).toBe('https://example.org/book.txt')
    for (const url of ['javascript:alert(1)', 'http://example.org/a.txt', 'https://user:secret@example.org/a.txt', 'not a URL']) {
      expect(() => sourceUrl(url)).toThrow()
    }
  })
  it('downloads only plain text without cookies, referrers or a persistent cache', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('A plain book.', { headers: { 'content-type': 'text/plain; charset=utf-8' } }))
    vi.stubGlobal('fetch', fetcher)
    expect(await downloadBook('https://example.org/book.txt')).toBe('A plain book.')
    expect(fetcher).toHaveBeenCalledWith('https://example.org/book.txt', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', mode: 'cors' }))
  })
  it('rejects HTTP errors, HTML, empty text, invalid UTF-8 and oversized responses', async () => {
    for (const response of [
      new Response('missing', { status: 404 }),
      new Response('<html>page</html>', { headers: { 'content-type': 'text/html' } }),
      new Response('<!doctype html><html>page</html>', { headers: { 'content-type': 'text/plain' } }),
      new Response(' ', { headers: { 'content-type': 'text/plain' } }),
      new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'text/plain' } }),
      new Response('huge', { headers: { 'content-type': 'text/plain', 'content-length': String(MAX_BOOK_BYTES + 1) } }),
      new Response(new Uint8Array(MAX_BOOK_BYTES + 1), { headers: { 'content-type': 'text/plain' } }),
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
      await expect(downloadBook('https://example.org/book.txt')).rejects.toThrow()
    }
  })
  it('explains network/CORS failures without changing data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(downloadBook('https://example.org/book.txt')).rejects.toThrow('import the file manually')
  })
  it('aborts a stalled source after 20 seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))
    const result = expect(downloadBook('https://example.org/book.txt')).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(20000)
    await result
  })
  it('fingerprints the cleaned edition and counts its words', async () => {
    const metadata = await describeBook('one two three')
    expect(metadata.wordCount).toBe(3)
    expect(metadata.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(await describeBook('one two three')).toEqual(metadata)
    expect((await describeBook('different words')).fingerprint).not.toBe(metadata.fingerprint)
  })
})
