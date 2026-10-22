import { useState } from 'react'
import type { StoredBook } from '../storage/booksDb'

type Props = {
  books: StoredBook[]
  onOpenBook: (book: StoredBook) => void
  onImportText: (rawText: string, fileName: string) => Promise<void>
  onOpenLog: () => void
  onOpenSettings: () => void
}

export function LoadScreen({
  books,
  onOpenBook,
  onImportText,
  onOpenLog,
  onOpenSettings,
}: Props) {
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      await onImportText(text, file.name)
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
      await onImportText(paste, 'pasted-text.txt')
      setPaste('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import text')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <header className="top-bar">
        <h1 className="brand">Speed Reader</h1>
        <div className="top-bar-actions">
          <button type="button" className="btn btn-ghost" onClick={onOpenLog}>
            Log
          </button>
          <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>
            Settings
          </button>
        </div>
      </header>

      <section className="panel">
        <h2>Open a book</h2>
        <p className="muted">Local Project Gutenberg .txt file, or paste text.</p>
        <label className="file-button btn btn-primary">
          {busy ? 'Loading…' : 'Choose .txt file'}
          <input
            type="file"
            accept=".txt,text/plain"
            hidden
            disabled={busy}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
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
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Paste book text here"
        />
        <button type="button" className="btn" disabled={busy} onClick={() => void handlePaste()}>
          Use pasted text
        </button>
        {error ? <p className="error">{error}</p> : null}
      </section>

      {books.length > 0 ? (
        <section className="panel">
          <h2>Your books</h2>
          <ul className="book-list">
            {books.map((book) => (
              <li key={book.id}>
                <button type="button" className="book-item" onClick={() => onOpenBook(book)}>
                  {book.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
