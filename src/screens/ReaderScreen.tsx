import type { ReactNode } from 'react'
import { PausedSentence } from '../components/PausedSentence'
import { RsvpView } from '../components/RsvpView'
import type { useReadingSession } from '../hooks/useReadingSession'

type Session = ReturnType<typeof useReadingSession>

type Props = {
  session: Session
  fontSizePx: number
  onOpenChapters: () => void
  onOpenLog: () => void
  onOpenSettings: () => void
  onCloseBook: () => void
  pacerSlot?: ReactNode
}

export function ReaderScreen({
  session,
  fontSizePx,
  onOpenChapters,
  onOpenLog,
  onOpenSettings,
  onCloseBook,
  pacerSlot,
}: Props) {
  const {
    current,
    playing,
    showParagraph,
    setShowParagraph,
    stats,
    togglePlay,
    backSentence,
    setWpm,
    setMode,
    mode,
    wpm,
    orpEnabled,
    sentence,
    paragraph,
    closeBook,
  } = session

  const handleClose = () => {
    closeBook()
    onCloseBook()
  }

  return (
    <div className="screen reader-screen">
      <header className="top-bar">
        <button type="button" className="btn btn-ghost" onClick={handleClose}>
          Books
        </button>
        <div className="top-bar-actions">
          <button type="button" className="btn btn-ghost" onClick={onOpenChapters}>
            Chapters
          </button>
          <button type="button" className="btn btn-ghost" onClick={onOpenLog}>
            Log
          </button>
          <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>
            Settings
          </button>
        </div>
      </header>

      <div className="status-row" aria-live="polite">
        <span>{stats.progressPercent}%</span>
        <span>{stats.currentChapter.title}</span>
        <span>{stats.wordsReadThisSession} words</span>
      </div>

      <div className="mode-toggle" role="group" aria-label="Reading mode">
        <button
          type="button"
          className={mode === 'rsvp' ? 'btn btn-active' : 'btn'}
          onClick={() => setMode('rsvp')}
        >
          RSVP
        </button>
        <button
          type="button"
          className={mode === 'pacer' ? 'btn btn-active' : 'btn'}
          onClick={() => setMode('pacer')}
        >
          Pacer
        </button>
      </div>

      {mode === 'rsvp' ? (
        <RsvpView
          token={current}
          orpEnabled={orpEnabled}
          fontSizePx={fontSizePx}
          onTogglePlay={togglePlay}
        />
      ) : (
        pacerSlot
      )}

      {!playing ? (
        <PausedSentence
          sentence={sentence}
          currentWord={current?.text ?? ''}
          paragraph={paragraph}
          showParagraph={showParagraph}
          onToggleParagraph={() => setShowParagraph(!showParagraph)}
        />
      ) : null}

      <footer className="reader-controls">
        <button type="button" className="btn btn-wide" onClick={backSentence}>
          Back sentence
        </button>
        <button type="button" className="btn btn-wide btn-primary" onClick={togglePlay}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <label className="wpm-control">
          <span>WPM {wpm}</span>
          <input
            type="range"
            min={100}
            max={700}
            step={10}
            value={wpm}
            onChange={(e) => setWpm(Number(e.target.value))}
            aria-label="Words per minute"
          />
        </label>
      </footer>
    </div>
  )
}
