import type { ReadingMode } from './settings'

export type SessionEntry = {
  id: string
  startedAt: string
  mode: ReadingMode
  wpm: number
  wordsRead: number
  minutesRead: number
}

const STORAGE_KEY = 'speed-reader:session-log'

export function loadSessionLog(): SessionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSessionLog(entries: SessionEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function appendSessionEntry(entry: Omit<SessionEntry, 'id'>): SessionEntry[] {
  const entries = loadSessionLog()
  const full: SessionEntry = {
    ...entry,
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  }
  entries.unshift(full)
  saveSessionLog(entries)
  return entries
}

export function sessionLogToCsv(entries: SessionEntry[]): string {
  const header = 'date_time,mode,wpm,words_read,minutes_read'
  const rows = entries.map((e) =>
    [e.startedAt, e.mode, e.wpm, e.wordsRead, e.minutesRead.toFixed(2)].join(','),
  )
  return [header, ...rows].join('\n')
}

export function downloadSessionCsv(entries: SessionEntry[]): void {
  const csv = sessionLogToCsv(entries)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'speed-reader-sessions.csv'
  a.click()
  URL.revokeObjectURL(url)
}
