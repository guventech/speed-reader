import { useState } from 'react'
import type { StoredBook } from '../storage/booksDb'

type Props = {
  book: StoredBook
  busy: boolean
  onSaveSource: (url: string) => void
  onRemoveDownload: () => void
  onKeepOffline: () => void
}

export function BookStorageControls({ book, busy, onSaveSource, onRemoveDownload, onKeepOffline }: Props) {
  const [url, setUrl] = useState(book.sourceUrl ?? '')
  return (
    <details className="book-storage">
      <summary>Storage &amp; source</summary>
      <p className="muted">{book.cleanedText ? 'Available offline on this device.' : 'Internet required. Only the link and bookmark are stored.'}</p>
      <form onSubmit={(event) => { event.preventDefault(); onSaveSource(url) }}>
        <label className="stack-label" htmlFor={`source-${book.id}`}>Source link{book.cleanedText ? ' (optional)' : ''}</label>
        <div className="search-row">
          <input id={`source-${book.id}`} className="select" type="url" inputMode="url" maxLength={4096}
            placeholder="https://example.org/book.txt" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} />
          <button className="btn" type="submit" disabled={busy}>Save link</button>
        </div>
      </form>
      {book.cleanedText ? <>
        <p className="speed-help">Removing the download keeps your place. The source must first reload the same text successfully.</p>
        <button className="btn" disabled={busy || !book.sourceUrl} onClick={onRemoveDownload}>Remove downloaded text, keep my place</button>
        {!book.sourceUrl ? <p className="speed-help">Add a source link to enable this option.</p> : null}
      </> : <button className="btn" disabled={busy} onClick={onKeepOffline}>Keep offline</button>}
    </details>
  )
}
