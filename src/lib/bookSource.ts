import { cleanText } from './cleanText'
import { tokenize } from './tokenize'

export const MAX_BOOK_BYTES = 10 * 1024 * 1024

export function sourceUrl(value: string): string {
  let url: URL
  try { url = new URL(value.trim()) }
  catch { throw new Error('Enter a full HTTPS link to a plain-text book.') }
  if (url.protocol !== 'https:' || url.username || url.password || value.length > 4096) {
    throw new Error('Use an HTTPS link without a username or password.')
  }
  url.hash = ''
  return url.href
}

export async function describeBook(cleanedText: string) {
  if (!crypto.subtle) throw new Error('Open the app over HTTPS to save a reliable book bookmark.')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cleanedText))
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { fingerprint, wordCount: tokenize(cleanedText).length }
}

/** User-initiated, bounded download. No credentials, referrer, proxy or persistent HTTP cache. */
export async function downloadBook(value: string): Promise<string> {
  const url = sourceUrl(value)
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, 20000)
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
      cache: 'no-store', redirect: 'error', signal: controller.signal })
    if (!response.ok) throw new Error(`The book could not be downloaded (HTTP ${response.status}). Your saved place is unchanged.`)
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (type !== 'text/plain') throw new Error('This link is not a plain-text book. Choose the direct UTF-8 .txt download link.')
    if (Number(response.headers.get('content-length')) > MAX_BOOK_BYTES) throw new Error('Choose a book smaller than 10 MB.')
    if (!response.body) throw new Error('The source returned an empty download.')
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    const parts: string[] = []
    let size = 0
    try {
      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        size += chunk.byteLength
        if (size > MAX_BOOK_BYTES) {
          controller.abort()
          throw new Error('Choose a book smaller than 10 MB.')
        }
        parts.push(decoder.decode(chunk, { stream: true }))
      }
      parts.push(decoder.decode())
    } finally { reader.releaseLock() }
    const text = parts.join('')
    if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(text) || !cleanText(text).trim()) {
      throw new Error('The source did not return readable plain text. Choose a direct .txt link.')
    }
    return text
  } catch (error) {
    if (timedOut) {
      throw new Error('The download timed out. Your saved place is unchanged; try again when connected.')
    }
    if (error instanceof TypeError) {
      throw new Error('The source could not be read. Check your connection and use a direct UTF-8 .txt link that allows browser downloads. Redirects are not followed. You can still import the file manually.')
    }
    throw error
  } finally { clearTimeout(timeout); controller.abort() }
}
