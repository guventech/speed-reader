import { useLayoutEffect, useMemo, useRef } from 'react'
import type { WordToken } from '../lib/tokenize'
import { readingChunks } from '../lib/bookNavigation'

type Props = {
  tokens: WordToken[]
  wordIndex: number
  fontSizePx: number
  playing: boolean
  onSelectWord: (index: number) => void
}

export function PacerView({ tokens, wordIndex, fontSizePx, playing, onSelectWord }: Props) {
  const activeRef = useRef<HTMLSpanElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const chunks = useMemo(() => readingChunks(tokens), [tokens])
  const chunkIndex = useMemo(() => {
    let low = 0
    let high = chunks.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (chunks[mid][0].index <= wordIndex) low = mid
      else high = mid - 1
    }
    return low
  }, [chunks, wordIndex])
  const windowStart = Math.max(0, chunkIndex - 2)

  useLayoutEffect(() => {
    const active = activeRef.current
    const scroller = scrollerRef.current
    if (!active || !scroller) return
    const container = scroller.getBoundingClientRect()
    const word = active.getBoundingClientRect()
    // Scroll at line boundaries rather than restarting an animation on every word.
    const top = container.top + container.height * 0.22
    const bottom = container.top + container.height * 0.65
    if (word.top < top || word.bottom > bottom) {
      scroller.scrollTop += word.top - top
    }
  }, [wordIndex, windowStart, fontSizePx])

  return (
    <div ref={scrollerRef} className="pacer-stage" style={{ fontSize: `${fontSizePx}px` }}
      tabIndex={0} role="region" aria-label="Book text. Pause to select a word."
      onClick={(event) => {
        if (playing) return
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-word-index]')
        if (target) onSelectWord(Number(target.dataset.wordIndex))
      }}>
      {!playing && windowStart > 0 ? <button className="btn btn-ghost" onClick={() => onSelectWord(chunks[windowStart - 1][0].index)}>Earlier text</button> : null}
      {chunks.slice(windowStart, chunkIndex + 3).map((words) => (
        <p key={words[0].index} className="pacer-paragraph">
          {words.map((token) => (
            <span key={token.index} ref={token.index === wordIndex ? activeRef : undefined}
              data-word-index={token.index}
              className={token.index === wordIndex ? 'pacer-word pacer-word-active' : 'pacer-word'}>
              {token.text}{' '}
            </span>
          ))}
        </p>
      ))}
      {!playing && chunkIndex + 3 < chunks.length ? <button className="btn btn-ghost" onClick={() => onSelectWord(chunks[chunkIndex + 3][0].index)}>Later text</button> : null}
    </div>
  )
}
