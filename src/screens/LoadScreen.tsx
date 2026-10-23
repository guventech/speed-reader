import { useState } from 'react'
import type { StoredBook } from '../storage/booksDb'
import { downloadBackup, importBackup } from '../storage/backup'
import { BookStorageControls } from '../components/BookStorageControls'

export type LibraryBook = StoredBook & { wordIndex: number; progress: number; chapter: string }

type Props = {
  books: LibraryBook[]
  storageError: string
  onRefresh: () => Promise<void>
  onOpenBook: (book: StoredBook) => Promise<unknown>
  onDeleteBook: (book: StoredBook) => Promise<void>
  onImportText: (rawText: string, fileName: string, sourceUrl?: string) => Promise<void>
  onImportLink: (sourceUrl: string) => Promise<void>
  onSaveSource: (book: StoredBook, url: string) => Promise<void>
  onRemoveDownload: (book: StoredBook) => Promise<void>
  onKeepOffline: (book: StoredBook) => Promise<unknown>
  onOpenLog: () => void
  onOpenSettings: () => void
}

export function LoadScreen({
  books,
  storageError,
  onRefresh,
  onOpenBook,
  onDeleteBook,
  onImportText,
  onImportLink,
  onSaveSource,
  onRemoveDownload,
  onKeepOffline,
  onOpenLog,
  onOpenSettings,
}: Props) {
  const [paste, setPaste] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const runAction = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true)
    setError(null)
    setNotice('')
    try {
      const result = await action()
      if (success && result !== false) setNotice(success)
    } catch (err) { setError(err instanceof Error ? err.message : 'This action could not be completed. Your saved place was kept.') }
    finally { setBusy(false) }
  }
  const handleBackup = async (file?: File) => {
    if (file && !window.confirm('Restore these books and saved positions? Matching books will use the positions in the backup. Other books, settings and session logs stay as they are.')) return
    setBusy(true)
    setError(null)
    setNotice('')
    try {
      if (file) { await importBackup(file); await onRefresh(); setNotice('Books and reading positions restored.') }
      else { await downloadBackup(); setNotice('Backup created. Save the downloaded file somewhere safe.') }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not back up or restore your books.') }
    finally { setBusy(false) }
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      await onImportText(text, file.name, sourceUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open file')
    } finally {
      setBusy(false)
    }
  }

  const handlePaste = async () => {
    if (!paste.trim()) {
      setError('Paste some text first')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onImportText(paste, 'pasted-text.txt', sourceUrl)
      setPaste('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import text')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (book: StoredBook) => {
    const ok = window.confirm(`Remove “${book.title}” from this device?`)
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await onDeleteBook(book)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove book')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <header className="top-bar">
        <h1 className="brand">Speed Reader</h1>
        <div className="top-bar-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onOpenLog}>
            Log
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onOpenSettings}>
            Settings
          </button>
        </div>
      </header>

      {storageError ? <p className="error" role="alert">{storageError} <button className="btn" onClick={() => void onRefresh()}>Try again</button></p> : null}
      {books[0] ? <section className="panel continue-panel">
        <p className="eyebrow">Pick up where you left off</p>
        <h2>{books[0].title}</h2>
        <p className="muted">{books[0].chapter} · {books[0].progress}% complete</p>
        <progress className="book-progress" value={books[0].progress} max={100} aria-label="Saved book progress" />
        <p className="speed-help">{books[0].cleanedText ? 'Available offline' : 'Internet required'}</p>
        <button className="btn btn-primary" disabled={busy} onClick={() => void runAction(() => onOpenBook(books[0]))}>Continue reading</button>
      </section> : null}

      <section className="panel">
        <h2>Open a book</h2>
        <p className="muted">Choose a local .txt file, paste text, or open a direct plain-text link.</p>
        <label className="stack-label" htmlFor="import-source">Source link (optional for files and pasted text)</label>
        <input id="import-source" type="url" inputMode="url" className="select" maxLength={4096} disabled={busy}
          placeholder="https://example.org/book.txt" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} aria-describedby="source-help" />
        <p id="source-help" className="speed-help">Links must serve UTF-8 plain text and allow browser downloads. Opening a link contacts its website. Your bookmark stays on your device.</p>
        <button className="btn" disabled={busy || !sourceUrl.trim()} onClick={() => void runAction(() => onImportLink(sourceUrl))}>Open from link</button>
        <label className="file-button btn btn-primary">
          {busy ? 'Loading…' : 'Choose .txt file'}
          <input
            type="file"
            accept=".txt,text/plain"
            className="visually-hidden"
            disabled={busy}
            onChange={(e) => { const file = e.target.files?.[0] ?? null; e.target.value = ''; void handleFile(file) }}
          />
        </label>
        <label className="stack-label" htmlFor="paste-box">
          Or paste text
        </label>
        <textarea
          id="paste-box"
          className="paste-box"
          rows={6}
          value={paste}
          disabled={busy}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Paste book text here"
        />
        <div className="row-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => void handlePaste()}>
            Use pasted text
          </button>
          {paste ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setPaste('')}
            >
              Clear paste
            </button>
          ) : null}
        </div>
        {error ? <p className="error" role="alert">{error}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
        {busy ? <p className="muted" role="status">Working… please keep this page open.</p> : null}
      </section>

      {books.length > 0 ? (
        <section className="panel">
          <h2>Your books</h2>
          <ul className="book-list">
            {books.map((book) => (
              <li key={book.id} className="book-entry">
                <div className="book-row">
                <button
                  type="button"
                  className="book-item"
                  disabled={busy}
                  onClick={() => void runAction(() => onOpenBook(book))}
                >
                  <strong>{book.title}</strong><span className="book-detail">{book.chapter} · {book.progress}% complete</span>
                  <span className="book-detail">{book.cleanedText ? 'Available offline' : 'Internet required'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  aria-label={`Remove ${book.title}`}
                  onClick={() => void handleDelete(book)}
                >
                  Remove
                </button>
                </div>
                <BookStorageControls key={`${book.id}:${book.sourceUrl ?? ''}`} book={book} busy={busy}
                  onSaveSource={(url) => void runAction(() => onSaveSource(book, url), 'Source link saved.')}
                  onRemoveDownload={() => void runAction(() => onRemoveDownload(book), 'Downloaded text removed. Your link and reading position were kept; internet is needed to reopen.')}
                  onKeepOffline={() => void runAction(() => onKeepOffline(book), 'This book is now available offline.')} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="panel">
        <h2>Keep your place safe</h2>
        <p className="muted">Backups include downloaded books, source links and reading positions. Books marked “Internet required” include no full text. Settings and session logs are separate.</p>
        <div className="row-actions">
          <button className="btn" disabled={busy || !books.length} onClick={() => void handleBackup()}>Back up books &amp; progress</button>
          <label className="file-button btn">Restore backup<input className="visually-hidden" type="file" accept=".json,application/json" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleBackup(file); e.target.value = '' }} /></label>
        </div>
      </section>
    </div>
  )
}
