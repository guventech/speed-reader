import { useLayoutEffect, useRef } from 'react'
import { orpIndex } from '../lib/orp'
import type { WordToken } from '../lib/tokenize'

type Props = {
  token: WordToken | null
  orpEnabled: boolean
  fontSizePx: number
  onTogglePlay: () => void
}

export function RsvpView({ token, orpEnabled, fontSizePx, onTogglePlay }: Props) {
  const stageRef = useRef<HTMLButtonElement | null>(null)
  const wordRef = useRef<HTMLSpanElement | null>(null)
  useLayoutEffect(() => {
    const fit = () => {
      const stage = stageRef.current
      const word = wordRef.current
      if (!stage || !word) return
      word.style.transform = ''
      const available = Math.max(1, stage.clientWidth - 40)
      const before = word.querySelector<HTMLElement>('.rsvp-before')
      const after = word.querySelector<HTMLElement>('.rsvp-after')
      const focus = word.querySelector<HTMLElement>('.rsvp-focus')
      const width = focus ? 2 * Math.max(before?.scrollWidth ?? 0, after?.scrollWidth ?? 0) + focus.scrollWidth : word.scrollWidth
      word.style.transform = `scale(${Math.min(1, available / Math.max(1, width))})`
    }
    fit()
    const observer = new ResizeObserver(fit)
    if (stageRef.current) observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [token?.text, orpEnabled, fontSizePx])
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
      ref={stageRef}
      type="button"
      className="rsvp-stage"
      onClick={onTogglePlay}
      aria-label="Pause or play"
      style={{ fontSize: `${fontSizePx}px` }}
    >
      <span ref={wordRef} className="rsvp-word">
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
    </button>
  )
}
