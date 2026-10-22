import { orpIndex } from '../lib/orp'
import type { WordToken } from '../lib/tokenize'

type Props = {
  token: WordToken | null
  orpEnabled: boolean
  fontSizePx: number
  onTogglePlay: () => void
}

export function RsvpView({ token, orpEnabled, fontSizePx, onTogglePlay }: Props) {
  if (!token) {
    return (
      <button type="button" className="rsvp-stage" onClick={onTogglePlay} aria-label="Play">
        <span className="rsvp-empty">No text</span>
      </button>
    )
  }

  const letters = [...token.text]
  const focus = orpEnabled ? Math.min(orpIndex(token.core.length), Math.max(0, token.core.length - 1)) : -1

  // Map ORP from core letters onto display characters (skip non-core leading junk)
  let coreSeen = 0
  let focusDisplayIndex = -1
  if (orpEnabled) {
    for (let i = 0; i < letters.length; i += 1) {
      if (/[\p{L}\p{N}']/u.test(letters[i])) {
        if (coreSeen === focus) {
          focusDisplayIndex = i
          break
        }
        coreSeen += 1
      }
    }
  }

  const before =
    focusDisplayIndex >= 0 ? letters.slice(0, focusDisplayIndex).join('') : ''
  const focusLetter = focusDisplayIndex >= 0 ? letters[focusDisplayIndex] : ''
  const after =
    focusDisplayIndex >= 0
      ? letters.slice(focusDisplayIndex + 1).join('')
      : token.text

  return (
    <button
      type="button"
      className="rsvp-stage"
      onClick={onTogglePlay}
      aria-label="Pause or play"
      style={{ fontSize: `${fontSizePx}px` }}
    >
      <span className="rsvp-word" aria-live="polite">
        {orpEnabled && focusDisplayIndex >= 0 ? (
          <>
            <span className="rsvp-before">{before}</span>
            <span className="rsvp-focus">{focusLetter}</span>
            <span className="rsvp-after">{after}</span>
          </>
        ) : (
          <span className="rsvp-plain">{token.text}</span>
        )}
      </span>
      <span className="rsvp-guide" aria-hidden="true" />
    </button>
  )
}
