import type { Chapter } from '../lib/chapters'

type Props = {
  chapters: Chapter[]
  currentWordIndex: number
  onJump: (wordIndex: number) => void
  onBack: () => void
}

export function ChaptersScreen({ chapters, currentWordIndex, onJump, onBack }: Props) {
  return (
    <div className="screen">
      <header className="top-bar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <h1 className="screen-title">Chapters</h1>
        <span className="top-bar-spacer" />
      </header>
      <ul className="chapter-list">
        {chapters.map((chapter) => {
          const isCurrent =
            chapter.wordIndex <= currentWordIndex &&
            (chapters.find((c) => c.wordIndex > chapter.wordIndex)?.wordIndex ??
              Number.POSITIVE_INFINITY) > currentWordIndex
          return (
            <li key={`${chapter.title}-${chapter.wordIndex}`}>
              <button
                type="button"
                className={isCurrent ? 'chapter-item chapter-item-current' : 'chapter-item'}
                onClick={() => onJump(chapter.wordIndex)}
              >
                {chapter.title}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
