import { useState, type ReactNode } from 'react'
import { PausedSentence } from '../components/PausedSentence'
import { RsvpView } from '../components/RsvpView'
import type { useReadingSession } from '../hooks/useReadingSession'
import { searchBook } from '../lib/bookNavigation'

type Session = ReturnType<typeof useReadingSession>
type Props = {
  session: Session
  title: string
  settingsError?: string
  sourceNotice?: string
  rsvpFontSizePx: number
  contextFontSizePx: number
  onOpenChapters: () => void
  onOpenLog: () => void
  onOpenSettings: () => void
  onCloseBook: () => void
  pacerSlot?: ReactNode
}

export function ReaderScreen({ session, title, settingsError, sourceNotice, rsvpFontSizePx, contextFontSizePx, onOpenChapters, onOpenLog, onOpenSettings, onCloseBook, pacerSlot }: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ReturnType<typeof searchBook> | null>(null)
  const { current, playing, stats, mode, wpm } = session
  const leaveReader = async (action: () => void) => {
    if (await session.closeBook()) action()
  }

  return (
    <div className="screen reader-screen">
      <header className="top-bar">
        <button type="button" className="btn btn-ghost" onClick={() => leaveReader(onCloseBook)}>Books</button>
        <div className="top-bar-actions">
          <button type="button" className="btn btn-ghost" onClick={() => { session.pause(); onOpenChapters() }}>Chapters</button>
          <button type="button" className="btn btn-ghost" onClick={() => leaveReader(onOpenSettings)}>Settings</button>
        </div>
      </header>
      <div className="book-heading">
        <p className="eyebrow">Your reading space</p>
        <h1 className="reader-title">{title}</h1>
        <div className="status-row"><span>{stats.currentChapter.title}</span><span>{stats.progressPercent}% complete</span></div>
        <progress className="book-progress" value={session.finished ? 100 : stats.progressPercent} max={100} aria-label="Book progress" />
      </div>
      {session.saveError ? <div className="error" role="alert">{session.saveError} <button className="btn" onClick={session.retrySave}>Try saving again</button></div> : null}
      {settingsError ? <p className="error" role="alert">{settingsError}</p> : null}
      {sourceNotice ? <p className="muted" role="status">{sourceNotice}</p> : null}
      <div className="reading-toolbar">
        <div className="mode-toggle" role="group" aria-label="Reading mode">
          {(['rsvp', 'pacer'] as const).map((value) => <button key={value} type="button" className={mode === value ? 'btn btn-active' : 'btn'} aria-pressed={mode === value} onClick={() => session.setMode(value)}>{value === 'rsvp' ? 'RSVP' : 'Pacer'}</button>)}
        </div>
        <button className="btn btn-ghost" aria-expanded={searchOpen} onClick={() => { session.pause(); setSearchOpen(!searchOpen) }}>Find text</button>
      </div>
      {searchOpen ? <section className="panel search-panel" aria-label="Find in book">
        <form onSubmit={(e) => { e.preventDefault(); setResults(searchBook(session.tokens, query)) }}>
          <label htmlFor="book-search">Find a word or phrase</label>
          <div className="search-row"><input id="book-search" type="search" className="select" value={query} onChange={(e) => { setQuery(e.target.value); setResults(null) }} minLength={2} required maxLength={200} /><button className="btn" type="submit">Find</button></div>
        </form>
        {results ? <><p className="muted" role="status">{results.length ? `${results.length === 30 ? 'First 30' : results.length} matches · choose one to jump` : 'No matches found.'}</p>
          <ul className="search-results">{results.map((result) => <li key={result.wordIndex}><button className="chapter-item" onClick={() => { session.pause(); session.jumpTo(result.wordIndex); setSearchOpen(false) }}>{result.excerpt}</button></li>)}</ul></> : null}
      </section> : null}
      {session.finished ? <p className="completion" role="status">Book complete. Well read.</p> : null}
      {mode === 'rsvp' ? <RsvpView token={current} orpEnabled={session.orpEnabled} fontSizePx={rsvpFontSizePx} onTogglePlay={session.togglePlay} /> : pacerSlot}
      {!playing ? <PausedSentence tokens={session.sentenceTokens} wordIndex={session.wordIndex} fontSizePx={contextFontSizePx} paragraph={session.paragraph} showParagraph={session.showParagraph} onToggleParagraph={() => session.setShowParagraph(!session.showParagraph)} onSelectWord={session.jumpTo} /> : null}
      <footer className="reader-controls">
        <div className="playback-row">
          <button type="button" className="btn btn-wide" onClick={session.backSentence}>Back sentence</button>
          <button type="button" className="btn btn-wide btn-primary" onClick={session.togglePlay} aria-pressed={playing}>{playing ? 'Pause' : 'Play'}</button>
        </div>
        <label className="wpm-control"><span>Base speed <strong>{wpm} WPM</strong></span><input type="range" min={100} max={700} step={10} value={wpm} onChange={(e) => session.setWpm(Number(e.target.value))} aria-label="Base words per minute" aria-describedby="speed-help" /></label>
        <p id="speed-help" className="speed-help">Pauses for punctuation and longer words lower the average speed.</p>
        <div className="reader-meta"><span>{stats.wordsReadThisSession.toLocaleString()} words this session</span><button className="btn btn-ghost" onClick={() => leaveReader(onOpenLog)}>Session log</button></div>
        {playing && session.wakeMessage ? <p className="speed-help" role="status">{session.wakeMessage}</p> : null}
      </footer>
    </div>
  )
}
