// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings'

beforeEach(() => localStorage.clear())
describe('reader text sizes', () => {
  it('defaults to a 32px RSVP word and 20px context and pacer text', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings()).toMatchObject({ rsvpFontSizePx: 32, contextFontSizePx: 20, fontSizePx: 20 })
  })
  it('keeps the old pacer preference while adding independent RSVP and context defaults', () => {
    localStorage.setItem('speed-reader:settings', JSON.stringify({ fontSizePx: 26, wpm: 350 }))
    expect(loadSettings()).toMatchObject({ fontSizePx: 26, rsvpFontSizePx: 32, contextFontSizePx: 20, wpm: 350 })
  })
  it('persists each text size independently', () => {
    saveSettings({ ...DEFAULT_SETTINGS, rsvpFontSizePx: 48, contextFontSizePx: 24, fontSizePx: 22 })
    expect(loadSettings()).toMatchObject({ rsvpFontSizePx: 48, contextFontSizePx: 24, fontSizePx: 22 })
  })
  it('clamps oversized values and falls back for invalid sizes', () => {
    localStorage.setItem('speed-reader:settings', JSON.stringify({ rsvpFontSizePx: 100, contextFontSizePx: -1, fontSizePx: 'invalid' }))
    expect(loadSettings()).toMatchObject({ rsvpFontSizePx: 64, contextFontSizePx: 14, fontSizePx: 20 })
  })
})
