import type { WordToken } from '../lib/tokenize'

type Props = {
  tokens: WordToken[]
  wordIndex: number
  fontSizePx: number
  paragraph: string
  showParagraph: boolean
  onToggleParagraph: () => void
  onSelectWord: (index: number) => void
}

export function PausedSentence({ tokens, wordIndex, fontSizePx, paragraph, showParagraph, onToggleParagraph, onSelectWord }: Props) {
  return (
    <section className="paused-panel" aria-label="Paused reading context">
      <p className="eyebrow">Paused · tap a word to set your place</p>
      <p className="paused-sentence" style={{ fontSize: `${fontSizePx}px` }}>
        {tokens.map((token) => (
          <span key={token.index}>
            <button type="button" className={token.index === wordIndex ? 'context-word word-mark' : 'context-word'}
              aria-current={token.index === wordIndex ? 'location' : undefined}
              onClick={() => onSelectWord(token.index)}>{token.text}</button>{' '}
          </span>
        ))}
      </p>
      <button type="button" className="btn btn-ghost" onClick={onToggleParagraph} aria-expanded={showParagraph}>
        {showParagraph ? 'Hide paragraph' : 'Show paragraph'}
      </button>
      {showParagraph ? <p className="paused-paragraph" style={{ fontSize: `${fontSizePx}px` }}>{paragraph}</p> : null}
    </section>
  )
}
