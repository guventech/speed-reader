// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { useReadingSession } from './useReadingSession'
import { PacerView } from '../components/PacerView'
import { RsvpView } from '../components/RsvpView'
import { DEFAULT_SETTINGS } from '../storage/settings'

vi.mock('../storage/booksDb', () => ({ savePosition: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../storage/sessionLog', () => ({ appendSessionEntry: vi.fn() }))

// Real timers and real React component updates, rather than a simulated clock.
// This measures scheduling/rendering in jsdom, not Safari's layout/paint cost.
describe('elapsed speed with a 100,000-word book', () => {
  for (const mode of ['rsvp', 'pacer'] as const) {
    for (const wpm of [100, 250, 700]) {
      it(`${mode} keeps ${wpm} base WPM under bounded rendering`, async () => {
        vi.useRealTimers()
        vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
        Object.defineProperty(document, 'hidden', { configurable: true, value: false })
        Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
        let session: ReturnType<typeof useReadingSession>
        const samples: number[] = []
        let complete: () => void
        const done = new Promise<void>((resolve) => { complete = resolve })
        const host = document.createElement('div')
        document.body.append(host)
        const root = createRoot(host)
        function Reader() {
          const value = useReadingSession({ bookId: 'speed', cleanedText: 'the reader follows this book with clear words '.repeat(12500),
            initialWordIndex: 0, settings: { ...DEFAULT_SETTINGS, wpm, mode }, onSettingsChange: () => {} })
          useLayoutEffect(() => {
            session = value
            if (value.playing) {
              samples[value.wordIndex] = performance.now()
              if (value.wordIndex === 10) complete()
            }
          })
          return mode === 'pacer'
            ? createElement(PacerView, { tokens: value.tokens, wordIndex: value.wordIndex, fontSizePx: 20, playing: value.playing, onSelectWord: value.jumpTo })
            : createElement(RsvpView, { token: value.current, orpEnabled: true, fontSizePx: 20, onTogglePlay: value.togglePlay })
        }
        try {
          act(() => root.render(createElement(Reader)))
          act(() => session.play())
          Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false })
          await done
          const elapsed = samples[10] - samples[0]
          const measured = 10 * 60000 / elapsed
          console.info(`${mode} base=${wpm} measured=${measured.toFixed(1)} WPM over ${elapsed.toFixed(0)}ms`)
          expect(measured).toBeGreaterThan(wpm * 0.8)
          expect(measured).toBeLessThan(wpm * 1.1)
          if (mode === 'pacer') expect(host.querySelectorAll('[data-word-index]').length).toBeLessThanOrEqual(900)
        } finally {
          Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
          await act(async () => root.unmount())
          host.remove()
          vi.unstubAllGlobals()
        }
      }, 12000)
    }
  }
})
