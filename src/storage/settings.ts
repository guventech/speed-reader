export type ReadingMode = 'rsvp' | 'pacer'

export type ThemePreference = 'system' | 'light' | 'dark'

export type AppSettings = {
  wpm: number
  mode: ReadingMode
  orpEnabled: boolean
  theme: ThemePreference
  fontSizePx: number
  rsvpFontSizePx: number
  contextFontSizePx: number
}

const STORAGE_KEY = 'speed-reader:settings'

export const DEFAULT_SETTINGS: AppSettings = {
  wpm: 250,
  mode: 'rsvp',
  orpEnabled: true,
  theme: 'system',
  fontSizePx: 20,
  rsvpFontSizePx: 32,
  contextFontSizePx: 20,
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      wpm: clampWpm(parsed.wpm ?? DEFAULT_SETTINGS.wpm),
      fontSizePx: clampFont(parsed.fontSizePx ?? DEFAULT_SETTINGS.fontSizePx),
      rsvpFontSizePx: clampFont(parsed.rsvpFontSizePx ?? DEFAULT_SETTINGS.rsvpFontSizePx, 64, DEFAULT_SETTINGS.rsvpFontSizePx),
      contextFontSizePx: clampFont(parsed.contextFontSizePx ?? DEFAULT_SETTINGS.contextFontSizePx),
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clampWpm(wpm: number): number {
  const stepped = Math.round(wpm / 10) * 10
  return Math.min(700, Math.max(100, stepped))
}

function clampFont(size: number, max = 32, fallback = 20): number {
  return Number.isFinite(size) ? Math.min(max, Math.max(14, Math.round(size))) : fallback
}
