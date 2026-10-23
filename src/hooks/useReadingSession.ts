import { useCallback, useEffect, useRef, useState } from 'react'
import { chapterForWordIndex, findChapters } from '../lib/chapters'
import { wordDelayMs } from '../lib/pacing'
import { backOneSentenceIndex, paragraphText, sentenceStartIndex, tokenize } from '../lib/tokenize'
import { savePosition } from '../storage/booksDb'
import { bookmarkDetails } from '../lib/bookmark'
import { appendSessionEntry } from '../storage/sessionLog'
import { clampWpm, type AppSettings } from '../storage/settings'

const PAUSE_END_MS = 5 * 60 * 1000

type Options = {
  bookId: string
  cleanedText: string
  initialWordIndex: number
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

// The parent keys this session by book ID; analysis runs only when a book opens.
export function useReadingSession({ bookId, cleanedText, initialWordIndex, settings, onSettingsChange }: Options) {
  const [{ tokens, chapters }] = useState(() => {
    const tokens = tokenize(cleanedText)
    return { tokens, chapters: findChapters(cleanedText, tokens) }
  })
  const [wordIndex, setWordIndex] = useState(() => Math.min(Math.max(0, initialWordIndex), Math.max(0, tokens.length - 1)))
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [showParagraph, setShowParagraph] = useState(false)
  const [wordsReadThisSession, setWordsReadThisSession] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [wakeMessage, setWakeMessage] = useState('')
  const playingRef = useRef(false)
  const wordIndexRef = useRef(wordIndex)
  const timerRef = useRef<number | null>(null)
  const pauseTimerRef = useRef<number | null>(null)
  const dueRef = useRef(0)
  const sessionRef = useRef<{ startedAt: string; elapsed: number; segment: number | null; words: number } | null>(null)
  const wpmRef = useRef(settings.wpm)
  const modeRef = useRef(settings.mode)
  const writesRef = useRef(Promise.resolve())
  const positionFailedRef = useRef(false)
  const logFailedRef = useRef(false)

  const persistPosition = useCallback((index: number) => {
    // Serialize writes so a slow earlier save cannot overwrite a later jump.
    writesRef.current = writesRef.current.then(async () => {
      await savePosition(bookId, index, { ...bookmarkDetails(tokens, index), chapter: chapterForWordIndex(chapters, index).title })
      positionFailedRef.current = false
      if (!logFailedRef.current) setSaveError('')
    }).catch(() => {
      positionFailedRef.current = true
      setSaveError('Your place could not be saved. Keep this page open and try saving again.')
    })
  }, [bookId, tokens, chapters])

  const stopSegment = useCallback(() => {
    const s = sessionRef.current
    if (s?.segment != null) {
      s.elapsed += performance.now() - s.segment
      s.segment = null
    }
  }, [])

  const flushSession = useCallback(() => {
    stopSegment()
    const s = sessionRef.current
    if (!s) return
    try {
      if (s.words > 0 || s.elapsed > 600) {
        appendSessionEntry({ startedAt: s.startedAt, mode: modeRef.current, wpm: wpmRef.current,
          wordsRead: s.words, minutesRead: s.elapsed / 60000 })
      }
      sessionRef.current = null
      logFailedRef.current = false
      if (!positionFailedRef.current) setSaveError('')
    } catch {
      logFailedRef.current = true
      setSaveError('Your reading log could not be saved. Keep this page open and try saving again.')
    }
  }, [stopSegment])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])
  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) window.clearTimeout(pauseTimerRef.current)
    pauseTimerRef.current = null
  }, [])

  const pause = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    clearTimer()
    stopSegment()
    persistPosition(wordIndexRef.current)
    clearPauseTimer()
    pauseTimerRef.current = window.setTimeout(flushSession, PAUSE_END_MS)
  }, [clearTimer, stopSegment, persistPosition, clearPauseTimer, flushSession])

  const scheduleNext = useCallback(function schedule(reset = true) {
    clearTimer()
    if (!playingRef.current || !tokens.length) return
    const delay = wordDelayMs(tokens[wordIndexRef.current], wpmRef.current)
    // Carry small scheduling delays forward, but never skip words or burst after a stall.
    const now = performance.now()
    dueRef.current = reset ? now + delay : Math.max(dueRef.current + delay, now + delay * 0.5)
    timerRef.current = window.setTimeout(() => {
      if (!playingRef.current) return
      const s = sessionRef.current
      if (s) { s.words += 1; setWordsReadThisSession(s.words) }
      if (wordIndexRef.current + 1 >= tokens.length) {
        playingRef.current = false
        setPlaying(false)
        setFinished(true)
        stopSegment()
        persistPosition(wordIndexRef.current)
        flushSession()
        return
      }
      wordIndexRef.current += 1
      setWordIndex(wordIndexRef.current)
      persistPosition(wordIndexRef.current)
      schedule(false)
    }, Math.max(0, dueRef.current - now))
  }, [clearTimer, tokens, persistPosition, flushSession, stopSegment])

  const play = useCallback(() => {
    if (!tokens.length || document.hidden || playingRef.current) return
    clearPauseTimer()
    if (!sessionRef.current) {
      sessionRef.current = { startedAt: new Date().toISOString(), elapsed: 0, segment: null, words: 0 }
      setWordsReadThisSession(0)
    }
    sessionRef.current.segment = performance.now()
    playingRef.current = true
    setPlaying(true)
    setFinished(false)
    setShowParagraph(false)
    setWakeMessage(navigator.wakeLock ? '' : 'Keep your screen awake manually on this browser.')
    scheduleNext()
  }, [tokens.length, clearPauseTimer, scheduleNext])

  const togglePlay = useCallback(() => { if (playingRef.current) pause(); else play() }, [pause, play])
  const jumpTo = useCallback((index: number) => {
    const next = Math.min(Math.max(0, index), Math.max(0, tokens.length - 1))
    wordIndexRef.current = next
    setWordIndex(next)
    setFinished(false)
    persistPosition(next)
    if (playingRef.current) scheduleNext()
  }, [tokens.length, persistPosition, scheduleNext])
  const backSentence = useCallback(() => jumpTo(backOneSentenceIndex(tokens, wordIndexRef.current)), [jumpTo, tokens])
  const setWpm = (wpm: number) => {
    wpmRef.current = clampWpm(wpm)
    onSettingsChange({ ...settings, wpm: wpmRef.current })
    if (playingRef.current) scheduleNext()
  }
  const setMode = (mode: AppSettings['mode']) => {
    modeRef.current = mode
    onSettingsChange({ ...settings, mode })
  }
  const closeBook = useCallback(async () => {
    pause()
    clearPauseTimer()
    flushSession()
    await writesRef.current
    return !positionFailedRef.current && !logFailedRef.current
  }, [pause, clearPauseTimer, flushSession])
  const retrySave = () => {
    setSaveError('')
    persistPosition(wordIndexRef.current)
    if (!playingRef.current) flushSession()
  }

  useEffect(() => {
    const onHidden = () => { if (document.hidden) void closeBook() }
    const onPageHide = () => { void closeBook() }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [closeBook])

  useEffect(() => {
    if (!playing) return
    let cancelled = false
    let lock: WakeLockSentinel | undefined
    if (!navigator.wakeLock) return
    void navigator.wakeLock.request('screen').then((acquired) => {
      if (cancelled) { void acquired.release(); return }
      lock = acquired
      acquired.addEventListener('release', () => {
        if (!cancelled) setWakeMessage('Screen stay-awake was released. Your phone may lock automatically.')
      })
    }).catch(() => {
      if (!cancelled) setWakeMessage('Screen stay-awake is unavailable. Your phone may lock automatically.')
    })
    return () => { cancelled = true; if (lock && !lock.released) void lock.release() }
  }, [playing])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (event.altKey || event.ctrlKey || event.metaKey || target?.closest('input,textarea,select,button,[role="button"],[contenteditable="true"]')) return
      if (event.code === 'Space') { event.preventDefault(); togglePlay() }
      else if (event.code === 'ArrowLeft') { event.preventDefault(); backSentence() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, backSentence])

  useEffect(() => () => {
    playingRef.current = false
    clearTimer()
    clearPauseTimer()
    flushSession()
  }, [clearTimer, clearPauseTimer, flushSession])

  const start = !playing ? sentenceStartIndex(tokens, wordIndex) : 0
  let end = start
  if (!playing) while (end < tokens.length && tokens[end].sentenceIndex === tokens[start]?.sentenceIndex) end += 1
  return {
    tokens, chapters, wordIndex, current: tokens[wordIndex] ?? null, playing, finished,
    showParagraph, setShowParagraph, saveError, retrySave, wakeMessage,
    stats: { wordsReadThisSession, progressPercent: tokens.length ? Math.round((wordIndex + 1) / tokens.length * 100) : 0,
      currentChapter: chapterForWordIndex(chapters, wordIndex) },
    togglePlay, pause, play, backSentence, jumpTo, setWpm, setMode, closeBook,
    sentenceTokens: !playing ? tokens.slice(start, end) : [],
    paragraph: !playing && showParagraph ? paragraphText(tokens, wordIndex) : '',
    totalWords: tokens.length, wpm: settings.wpm, mode: settings.mode, orpEnabled: settings.orpEnabled,
  }
}
