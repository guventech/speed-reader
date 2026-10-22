type Props = {
  sentence: string
  currentWord: string
  paragraph: string
  showParagraph: boolean
  onToggleParagraph: () => void
}

export function PausedSentence({
  sentence,
  currentWord,
  paragraph,
  showParagraph,
  onToggleParagraph,
}: Props) {
  const words = sentence.split(/\s+/)
  let marked = false

  return (
    <div className="paused-panel">
      <p className="paused-sentence">
        {words.map((word, i) => {
          const isCurrent = !marked && word === currentWord
          if (isCurrent) marked = true
          return (
            <span key={`${word}-${i}`} className={isCurrent ? 'word-mark' : undefined}>
              {word}{' '}
            </span>
          )
        })}
      </p>
      <button type="button" className="btn" onClick={onToggleParagraph}>
        {showParagraph ? 'Hide paragraph' : 'Show paragraph'}
      </button>
      {showParagraph ? <p className="paused-paragraph">{paragraph}</p> : null}
    </div>
  )
}
