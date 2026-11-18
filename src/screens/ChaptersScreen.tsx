import { PortfolioLink, ReturnLink } from '../components/ReturnLink'
import type { Chapter } from '../lib/chapters'

type Props = {
  chapters: Chapter[]
  currentWordIndex: number
  saveError: string
  onRetrySave: () => void
  onReturnToPortfolio: () => Promise<void>
  onJump: (wordIndex: number) => void
  onBack: () => void
}

export function ChaptersScreen({ chapters, currentWordIndex, saveError, onRetrySave, onReturnToPortfolio, onJump, onBack }: Props) {
  return (
    <div className="screen">
      <PortfolioLink onNavigate={onReturnToPortfolio} />
      <header className="top-bar return-bar">
        <ReturnLink href="/#reader" onNavigate={onBack}>Back to reader</ReturnLink>
        <h1 className="screen-title">Chapters</h1>
        <span className="top-bar-spacer" />
      </header>
      {saveError ? <div className="error" role="alert">{saveError} <button className="btn" onClick={onRetrySave}>Try saving again</button></div> : null}
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
