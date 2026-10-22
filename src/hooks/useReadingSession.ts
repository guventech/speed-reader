import { useCallback, useEffect, useRef, useState } from 'react'
import { chapterForWordIndex, findChapters, type Chapter } from '../lib/chapters'
import { wordDelayMs } from '../lib/pacing'
import {
  backOneSentenceIndex,
  paragraphText,
  sentenceText,
  tokenize,
  type WordToken,
} from '../lib/tokenize'
import { savePosition } from '../storage/booksDb'
import { appendSessionEntry } from '../storage/sessionLog'
import {
  clampWpm,
  type AppSettings,
  type ReadingMode,
} from '../storage/settings'

const PAUSE_END_MS = 5 * 60 * 1000

export type SessionStats = {
  wordsReadThisSession: number
  progressPercent: number
  currentChapter: Chapter
}

type Options = {
  bookId: string
  cleanedText: string
  initialWordIndex: number
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

export function useReadingSession({
  bookId,
  cleanedText,
  initialWordIndex,
  settings,
  onSettingsChange,
}: Options) {
  const tokens = useRef<WordToken[]>(tokenize(cleanedText)).current
  const chapters = useRef<Chapter[]>(findChapters(cleanedText, tokens)).current

  const [wordIndex, setWordIndex] = useState(() =>
    Math.min(Math.max(0, initialWordIndex), Math.max(0, tokens.length - 1)),
  )
  const [playing, setPlaying] = useState(false)
  const [showParagraph, setShowParagraph] = useState(false)
  const [wordsReadThisSession, setWordsReadThisSession] = useState(0)

  const playingRef = useRef(false)
  const wordIndexRef = useRef(wordIndex)
  const timerRef = useRef<number | null>(null)
  const pauseTimerRef = useRef<number | null>(null)
  const sessionStartedAtRef = useRef<string | null>(null)
  const playAccumMsRef = useRef(0)
  const playSegmentStartRef = useRef<number | null>(null)
  const wordsReadRef = useRef(0)
  const sessionOpenRef = useRef(false)
  const wpmRef = useRef(settings.wpm)
  const modeRef = useRef(settings.mode)

  useEffect(() => {
    wordIndexRef.current = wordIndex
  }, [wordIndex])

  useEffect(() => {
    wpmRef.current = settings.wpm
    modeRef.current = settings.mode
  }, [settings.wpm, settings.mode])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = null
    }
  }, [])

  const persistPosition = useCallback(
    (index: number) => {
      void savePosition(bookId, index)
    },
    [bookId],
  )

  const flushSession = useCallback(() => {
    if (!sessionOpenRef.current || !sessionStartedAtRef.current) return
    if (playSegmentStartRef.current !== null) {
      playAccumMsRef.current += Date.now() - playSegmentStartRef.current
      playSegmentStartRef.current = null
    }
    const minutesRead = playAccumMsRef.current / 60000
    if (wordsReadRef.current > 0 || minutesRead > 0.01) {
      appendSessionEntry({
        startedAt: sessionStartedAtRef.current,
        mode: modeRef.current,
        wpm: wpmRef.current,
        wordsRead: wordsReadRef.current,
        minutesRead,
      })
    }
    sessionOpenRef.current = false
    sessionStartedAtRef.current = null
    playAccumMsRef.current = 0
    wordsReadRef.current = 0
    setWordsReadThisSession(0)
  }, [])

  const ensureSessionStarted = useCallback(() => {
    if (!sessionOpenRef.current) {
      sessionOpenRef.current = true
      sessionStartedAtRef.current = new Date().toISOString()
      playAccumMsRef.current = 0
      wordsReadRef.current = 0
      setWordsReadThisSession(0)
    }
  }, [])

  const scheduleNext = useCallback(() => {
    clearTimer()
    if (!playingRef.current) return
    const index = wordIndexRef.current
    if (index >= tokens.length) {
      playingRef.current = false
      setPlaying(false)
      return
    }
    const delay = wordDelayMs(tokens[index], wpmRef.current)
    timerRef.current = window.setTimeout(() => {
      const next = wordIndexRef.current + 1
      if (next >= tokens.length) {
        playingRef.current = false
        setPlaying(false)
        persistPosition(tokens.length - 1)
        return
      }
      wordIndexRef.current = next
      setWordIndex(next)
      wordsReadRef.current += 1
      setWordsReadThisSession(wordsReadRef.current)
      persistPosition(next)
      scheduleNext()
    }, delay)
  }, [clearTimer, persistPosition, tokens])

  const play = useCallback(() => {
    if (tokens.length === 0) return
    clearPauseTimer()
    ensureSessionStarted()
    if (playSegmentStartRef.current === null) {
      playSegmentStartRef.current = Date.now()
    }
    playingRef.current = true
    setPlaying(true)
    setShowParagraph(false)
    scheduleNext()
  }, [clearPauseTimer, ensureSessionStarted, scheduleNext, tokens.length])

  const pause = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    clearTimer()
    if (playSegmentStartRef.current !== null) {
      playAccumMsRef.current += Date.now() - playSegmentStartRef.current
      playSegmentStartRef.current = null
    }
    clearPauseTimer()
    pauseTimerRef.current = window.setTimeout(() => {
      flushSession()
    }, PAUSE_END_MS)
  }, [clearPauseTimer, clearTimer, flushSession])

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause()
    else play()
  }, [pause, play])

  const backSentence = useCallback(() => {
    const next = backOneSentenceIndex(tokens, wordIndexRef.current)
    wordIndexRef.current = next
    setWordIndex(next)
    persistPosition(next)
    if (playingRef.current) {
      scheduleNext()
    }
  }, [persistPosition, scheduleNext, tokens])

  const jumpTo = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(0, index), Math.max(0, tokens.length - 1))
      wordIndexRef.current = next
      setWordIndex(next)
      persistPosition(next)
      if (playingRef.current) scheduleNext()
    },
    [persistPosition, scheduleNext, tokens.length],
  )

  const setWpm = useCallback(
    (wpm: number) => {
      const next = clampWpm(wpm)
      wpmRef.current = next
      onSettingsChange({ ...settings, wpm: next })
      if (playingRef.current) scheduleNext()
    },
    [onSettingsChange, scheduleNext, settings],
  )

  const setMode = useCallback(
    (mode: ReadingMode) => {
      modeRef.current = mode
      onSettingsChange({ ...settings, mode })
    },
    [onSettingsChange, settings],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlay()
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault()
        backSentence()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [backSentence, togglePlay])

  useEffect(() => {
    return () => {
      clearTimer()
      clearPauseTimer()
      flushSession()
    }
  }, [clearPauseTimer, clearTimer, flushSession])

  const current = tokens[wordIndex] ?? null
  const stats: SessionStats = {
    wordsReadThisSession,
    progressPercent:
      tokens.length === 0 ? 0 : Math.round(((wordIndex + 1) / tokens.length) * 100),
    currentChapter: chapterForWordIndex(chapters, wordIndex),
  }

  return {
    tokens,
    chapters,
    wordIndex,
    current,
    playing,
    showParagraph,
    setShowParagraph,
    stats,
    togglePlay,
    pause,
    play,
    backSentence,
    jumpTo,
    setWpm,
    setMode,
    closeBook: flushSession,
    sentence: sentenceText(tokens, wordIndex),
    paragraph: paragraphText(tokens, wordIndex),
    totalWords: tokens.length,
    wpm: settings.wpm,
    mode: settings.mode,
    orpEnabled: settings.orpEnabled,
  }
}
