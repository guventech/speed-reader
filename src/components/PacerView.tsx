import { useEffect, useRef } from 'react'
import type { WordToken } from '../lib/tokenize'

type Props = {
  tokens: WordToken[]
  wordIndex: number
  fontSizePx: number
  onTogglePlay: () => void
}

export function PacerView({ tokens, wordIndex, fontSizePx, onTogglePlay }: Props) {
  const activeRef = useRef<HTMLSpanElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const active = activeRef.current
    const scroller = scrollerRef.current
    if (!active || !scroller) return
    const scrollerRect = scroller.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    const targetTop = scroller.scrollTop + (activeRect.top - scrollerRect.top) - scrollerRect.height * 0.25
    scroller.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  }, [wordIndex])

  // Group tokens into paragraphs for display
  const paragraphs: WordToken[][] = []
  let current: WordToken[] = []
  let para = tokens[0]?.paragraphIndex ?? 0
  for (const token of tokens) {
    if (token.paragraphIndex !== para) {
      paragraphs.push(current)
      current = []
      para = token.paragraphIndex
    }
    current.push(token)
  }
  if (current.length) paragraphs.push(current)

  return (
    <div
      ref={scrollerRef}
      className="pacer-stage"
      style={{ fontSize: `${fontSizePx}px` }}
      onClick={onTogglePlay}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTogglePlay()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Pause or play pacer"
    >
      {paragraphs.map((words, pIndex) => (
        <p key={pIndex} className="pacer-paragraph">
          {words.map((token) => {
            const isActive = token.index === wordIndex
            return (
              <span
                key={token.index}
                ref={isActive ? activeRef : undefined}
                className={isActive ? 'pacer-word pacer-word-active' : 'pacer-word'}
              >
                {token.text}{' '}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}
