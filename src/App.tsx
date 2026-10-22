import { useCallback, useEffect, useState } from 'react'
import { PacerView } from './components/PacerView'
import { useReadingSession } from './hooks/useReadingSession'
import { cleanText, extractGutenbergTitle } from './lib/cleanText'
import { ChaptersScreen } from './screens/ChaptersScreen'
import { LoadScreen } from './screens/LoadScreen'
import { LogScreen } from './screens/LogScreen'
import { ReaderScreen } from './screens/ReaderScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import {
  deleteBook,
  getPosition,
  listBooks,
  newBookId,
  saveBook,
  type StoredBook,
} from './storage/booksDb'
import { loadSessionLog, type SessionEntry } from './storage/sessionLog'
import { loadSettings, saveSettings, type AppSettings } from './storage/settings'

type View = 'load' | 'reader' | 'chapters' | 'log' | 'settings'

function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.dataset.theme = dark ? 'dark' : 'light'
}

function ReaderSession({
  book,
  initialWordIndex,
  settings,
  onSettingsChange,
  onCloseBook,
  onOpenLog,
  onOpenSettings,
}: {
  book: StoredBook
  initialWordIndex: number
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  onCloseBook: () => void
  onOpenLog: () => void
  onOpenSettings: () => void
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
      fontSizePx={settings.fontSizePx}
      onOpenChapters={() => setView('chapters')}
      onOpenLog={onOpenLog}
      onOpenSettings={onOpenSettings}
      onCloseBook={onCloseBook}
      pacerSlot={
        <PacerView
          tokens={session.tokens}
          wordIndex={session.wordIndex}
          fontSizePx={settings.fontSizePx}
          onTogglePlay={session.togglePlay}
        />
      }
    />
  )
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [books, setBooks] = useState<StoredBook[]>([])
  const [activeBook, setActiveBook] = useState<StoredBook | null>(null)
  const [initialWordIndex, setInitialWordIndex] = useState(0)
  const [view, setView] = useState<View>('load')
  const [logEntries, setLogEntries] = useState<SessionEntry[]>(() => loadSessionLog())
  const [returnView, setReturnView] = useState<View>('load')

  useEffect(() => {
    applyTheme(settings.theme)
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(settings.theme)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const refreshBooks = useCallback(async () => {
    setBooks(await listBooks())
  }, [])

  useEffect(() => {
    void refreshBooks()
  }, [refreshBooks])

  const handleSettingsChange = (next: AppSettings) => {
    setSettings(next)
  }

  const openLog = () => {
    setLogEntries(loadSessionLog())
    setReturnView(activeBook ? 'reader' : 'load')
    setView('log')
  }

  const openSettings = () => {
    setReturnView(activeBook ? 'reader' : 'load')
    setView('settings')
  }

  const handleImport = async (rawText: string, fileName: string) => {
    const title = extractGutenbergTitle(rawText) ?? fileName.replace(/\.txt$/i, '')
    const cleaned = cleanText(rawText)
    if (!cleaned.trim()) {
      throw new Error('No readable text found')
    }
    const book = await saveBook({
      id: newBookId(),
      title,
      rawText,
      cleanedText: cleaned,
    })
    await refreshBooks()
    setActiveBook(book)
    setInitialWordIndex(0)
    setView('reader')
  }

  const handleOpenBook = async (book: StoredBook) => {
    const position = await getPosition(book.id)
    setActiveBook(book)
    setInitialWordIndex(position)
    setView('reader')
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
      onOpenBook={(book) => void handleOpenBook(book)}
      onDeleteBook={handleDeleteBook}
      onImportText={handleImport}
      onOpenLog={openLog}
      onOpenSettings={openSettings}
    />
  )
}
