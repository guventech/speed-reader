import { useCallback, useEffect, useState } from 'react'
import { PacerView } from './components/PacerView'
import { useReadingSession } from './hooks/useReadingSession'
import { chapterForWordIndex, findChapters } from './lib/chapters'
import { tokenize } from './lib/tokenize'
import { ChaptersScreen } from './screens/ChaptersScreen'
import { LoadScreen, type LibraryBook } from './screens/LoadScreen'
import { LogScreen } from './screens/LogScreen'
import { ReaderScreen } from './screens/ReaderScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import {
  deleteBook,
  getBookmark,
  listBooks,
  type StoredBook,
} from './storage/booksDb'
import { attachSource, importBook, importLinkedBook, prepareBook, removeDownloadedText, savePreparedBook } from './storage/bookLibrary'
import { loadSessionLog, type SessionEntry } from './storage/sessionLog'
import { loadSettings, saveSettings, type AppSettings } from './storage/settings'

type View = 'load' | 'reader' | 'chapters' | 'log' | 'settings'

function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1012' : '#f7f5f1')
}

function ReaderSession({
  book,
  initialWordIndex,
  settings,
  settingsError,
  sourceNotice,
  onSettingsChange,
  onCloseBook,
  onOpenLog,
  onOpenSettings,
}: {
  book: StoredBook
  initialWordIndex: number
  settings: AppSettings
  settingsError: string
  sourceNotice: string
  onSettingsChange: (s: AppSettings) => void
  onCloseBook: () => void
  onOpenLog: (wordIndex: number) => void
  onOpenSettings: (wordIndex: number) => void
}) {
  const [view, setView] = useState<View>('reader')
  const session = useReadingSession({
    bookId: book.id,
    cleanedText: book.cleanedText,
    initialWordIndex,
    settings,
    onSettingsChange,
  })

  if (view === 'chapters') {
    return (
      <ChaptersScreen
        chapters={session.chapters}
        currentWordIndex={session.wordIndex}
        onBack={() => setView('reader')}
        onJump={(wordIndex) => {
          session.jumpTo(wordIndex)
          setView('reader')
        }}
      />
    )
  }

  return (
    <ReaderScreen
      session={session}
      title={book.title}
      settingsError={settingsError}
      sourceNotice={sourceNotice}
      rsvpFontSizePx={settings.rsvpFontSizePx}
      contextFontSizePx={settings.contextFontSizePx}
      onOpenChapters={() => setView('chapters')}
      onOpenLog={() => onOpenLog(session.wordIndex)}
      onOpenSettings={() => onOpenSettings(session.wordIndex)}
      onCloseBook={onCloseBook}
      pacerSlot={
        <PacerView
          tokens={session.tokens}
          wordIndex={session.wordIndex}
          fontSizePx={settings.fontSizePx}
          playing={session.playing}
          onSelectWord={session.jumpTo}
        />
      }
    />
  )
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [storageError, setStorageError] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [sourceNotice, setSourceNotice] = useState('')
  const [activeBook, setActiveBook] = useState<StoredBook | null>(null)
  const [initialWordIndex, setInitialWordIndex] = useState(0)
  const [view, setView] = useState<View>('load')
  const [logEntries, setLogEntries] = useState<SessionEntry[]>(() => loadSessionLog())
  const [returnView, setReturnView] = useState<View>('load')

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(settings.theme)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const refreshBooks = useCallback(async () => {
    try {
      const stored = await listBooks()
      setBooks(await Promise.all(stored.map(async (book) => {
        const saved = await getBookmark(book.id)
        const tokens = book.cleanedText ? tokenize(book.cleanedText) : []
        const count = tokens.length || book.wordCount || 0
        const chapters = tokens.length ? findChapters(book.cleanedText, tokens) : []
        return { ...book, wordIndex: saved.wordIndex, progress: count && saved.wordIndex > 0 ? Math.round((saved.wordIndex + 1) / count * 100) : 0,
          chapter: chapters.length ? chapterForWordIndex(chapters, saved.wordIndex).title : saved.chapter ?? 'Saved place' }
      })))
      setStorageError('')
    } catch { setStorageError('Your library could not be opened. Try again before importing another copy.') }
  }, [])

  useEffect(() => {
    void refreshBooks()
  }, [refreshBooks])

  const handleSettingsChange = (next: AppSettings) => {
    setSettings(next)
    try {
      saveSettings(next)
      setSettingsError('')
    } catch { setSettingsError('Settings could not be saved. Free some device storage, then adjust the setting again to retry.') }
  }

  const openLog = (wordIndex?: number) => {
    if (wordIndex !== undefined) setInitialWordIndex(wordIndex)
    setLogEntries(loadSessionLog())
    setReturnView(activeBook ? 'reader' : 'load')
    setView('log')
  }

  const openSettings = (wordIndex?: number) => {
    if (wordIndex !== undefined) setInitialWordIndex(wordIndex)
    setReturnView(activeBook ? 'reader' : 'load')
    setView('settings')
  }

  const activateBook = async (book: StoredBook) => {
    const saved = await getBookmark(book.id)
    await refreshBooks()
    setActiveBook(book)
    setInitialWordIndex(saved.wordIndex)
    setSourceNotice('')
    setView('reader')
  }

  const handleImport = async (rawText: string, fileName: string, source?: string) => {
    await activateBook(await importBook(rawText, fileName, source))
  }
  const handleImportLink = async (url: string) => {
    await activateBook(await importLinkedBook(url))
  }
  const handleOpenBook = async (book: StoredBook, keepOffline = false) => {
    const prepared = await prepareBook(book, keepOffline)
    if (prepared.needsRestart && !window.confirm('The source text has changed and your saved passage could not be found uniquely. Start this edition at the beginning? Your previous bookmark will be replaced. Cancel keeps it.')) return false
    await savePreparedBook(prepared)
    if (keepOffline) await refreshBooks()
    else {
      setActiveBook(prepared.activeBook)
      setInitialWordIndex(prepared.position.wordIndex)
      setSourceNotice(prepared.changed ? prepared.needsRestart ? 'The source changed. This edition was opened at the beginning.' : 'The source changed. Your saved place was found in the updated text.' : '')
      setView('reader')
    }
  }

  const handleCloseBook = () => {
    setActiveBook(null)
    setView('load')
    setLogEntries(loadSessionLog())
    void refreshBooks()
  }

  const handleDeleteBook = async (book: StoredBook) => {
    await deleteBook(book.id)
    if (activeBook?.id === book.id) {
      setActiveBook(null)
      setView('load')
    }
    await refreshBooks()
  }

  if (view === 'log') {
    return (
      <LogScreen
        entries={logEntries}
        onBack={() => setView(returnView === 'reader' && activeBook ? 'reader' : 'load')}
      />
    )
  }

  if (view === 'settings') {
    return (
      <SettingsScreen
        settings={settings}
        error={settingsError}
        onChange={handleSettingsChange}
        onBack={() => setView(returnView === 'reader' && activeBook ? 'reader' : 'load')}
      />
    )
  }

  if (view === 'reader' && activeBook) {
    return (
      <ReaderSession
        key={activeBook.id}
        book={activeBook}
        initialWordIndex={initialWordIndex}
        settings={settings}
        settingsError={settingsError}
        sourceNotice={sourceNotice}
        onSettingsChange={handleSettingsChange}
        onCloseBook={handleCloseBook}
        onOpenLog={openLog}
        onOpenSettings={openSettings}
      />
    )
  }

  return (
    <LoadScreen
      books={books}
      storageError={storageError}
      onRefresh={refreshBooks}
      onOpenBook={handleOpenBook}
      onImportLink={handleImportLink}
      onSaveSource={async (book, url) => { await attachSource(book, url); await refreshBooks() }}
      onRemoveDownload={async (book) => { await removeDownloadedText(book); await refreshBooks() }}
      onKeepOffline={(book) => handleOpenBook(book, true)}
      onDeleteBook={handleDeleteBook}
      onImportText={handleImport}
      onOpenLog={() => openLog()}
      onOpenSettings={() => openSettings()}
    />
  )
}
