// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReadingSession } from './useReadingSession'
import { DEFAULT_SETTINGS, type ReadingMode } from '../storage/settings'
import { wordDelayMs } from '../lib/pacing'

vi.mock('../storage/booksDb', () => ({ savePosition: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../storage/sessionLog', () => ({ appendSessionEntry: vi.fn() }))
import { savePosition } from '../storage/booksDb'
import { appendSessionEntry } from '../storage/sessionLog'

let root: Root
let session: ReturnType<typeof useReadingSession>
let hidden = false
function mount(mode: ReadingMode, wpm: number, text = 'one two three four five six seven eight nine ten.') {
  function Reader() {
    const value = useReadingSession({ bookId: 'test', cleanedText: text, initialWordIndex: 0,
      settings: { ...DEFAULT_SETTINGS, mode, wpm }, onSettingsChange: () => {} })
    useLayoutEffect(() => { session = value })
    return null
  }
  act(() => root.render(createElement(Reader)))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  root = createRoot(document.createElement('div'))
})
afterEach(() => { act(() => root.unmount()); vi.useRealTimers() })

describe('reading clock', () => {
  for (const mode of ['rsvp', 'pacer'] as const) {
    for (const wpm of [100, 250, 700]) {
      it(`${mode} advances at ${wpm} base WPM with punctuation pauses`, () => {
        mount(mode, wpm, 'one two, three four.\n\nfive six.')
        act(() => session.play())
        let elapsed = 0
        for (let i = 0; i < session.tokens.length - 1; i++) {
          const delay = wordDelayMs(session.tokens[i], wpm)
          act(() => vi.advanceTimersByTime(delay - 1))
          expect(session.wordIndex).toBe(i)
          act(() => vi.advanceTimersByTime(1))
          elapsed += delay
          expect(session.wordIndex).toBe(i + 1)
        }
        expect(elapsed).toBeGreaterThan((session.tokens.length - 1) * 60000 / wpm)
      })
    }
  }
  it('pauses and saves when the page is hidden, and stays paused on return', async () => {
    mount('rsvp', 250)
    act(() => { session.play(); vi.advanceTimersByTime(240) })
    hidden = true
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(session.playing).toBe(false)
    const index = session.wordIndex
    act(() => vi.advanceTimersByTime(60000))
    expect(session.wordIndex).toBe(index)
    expect(savePosition).toHaveBeenCalledWith('test', index, expect.objectContaining({ contextOffset: index, chapter: 'Section 1' }))
    hidden = false
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(session.playing).toBe(false)
  })
  it('counts the final word and stops session time at book completion', () => {
    mount('pacer', 600, 'one two.')
    act(() => { session.play(); vi.advanceTimersByTime(400) })
    expect(session.playing).toBe(false)
    expect(appendSessionEntry).toHaveBeenCalledWith(expect.objectContaining({ wordsRead: 2, minutesRead: 400 / 60000 }))
    act(() => vi.advanceTimersByTime(60000))
    expect(appendSessionEntry).toHaveBeenCalledTimes(1)
  })
  it('reports save failures and can retry a saved position', async () => {
    vi.mocked(savePosition).mockRejectedValueOnce(new Error('quota'))
    mount('rsvp', 250)
    await act(async () => session.jumpTo(3))
    expect(session.saveError).toContain('could not be saved')
    await act(async () => session.retrySave())
    expect(savePosition).toHaveBeenLastCalledWith('test', 3, expect.objectContaining({ contextOffset: 3, chapter: 'Section 1' }))
    expect(session.saveError).toBe('')
  })
  it('keeps the reader open when a final position save fails', async () => {
    mount('rsvp', 250)
    vi.mocked(savePosition).mockRejectedValueOnce(new Error('quota'))
    let saved = true
    await act(async () => { saved = await session.closeBook() })
    expect(saved).toBe(false)
    expect(session.saveError).toContain('could not be saved')
    await act(async () => session.retrySave())
    await act(async () => { saved = await session.closeBook() })
    expect(saved).toBe(true)
  })
  it('requests a wake lock only while playing and releases it on pause', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const lock = { release, released: false, addEventListener: vi.fn() }
    const request = vi.fn().mockResolvedValue(lock)
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    mount('rsvp', 250)
    expect(request).not.toHaveBeenCalled()
    await act(async () => session.play())
    expect(request).toHaveBeenCalledWith('screen')
    await act(async () => session.pause())
    expect(release).toHaveBeenCalledTimes(1)
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined })
  })
  it('handles wake lock rejection without interrupting reading', async () => {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: vi.fn().mockRejectedValue(new Error('denied')) } })
    mount('rsvp', 250)
    await act(async () => session.play())
    expect(session.playing).toBe(true)
    expect(session.wakeMessage).toContain('unavailable')
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined })
  })
  it('does not intercept keyboard input or native button activation', () => {
    mount('rsvp', 250)
    const input = document.createElement('input')
    document.body.append(input)
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })))
    expect(session.playing).toBe(false)
    input.remove()
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })))
    expect(session.playing).toBe(true)
  })
})
