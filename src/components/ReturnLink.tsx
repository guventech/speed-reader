import type { MouseEvent, ReactNode } from 'react'

export const portfolioUrl = 'https://www.bircans.com/guven#tools'

export function ReturnLink({ href, children, onNavigate }: {
  href: string
  children: ReactNode
  onNavigate?: () => void | Promise<void>
}) {
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    void onNavigate()
  }
  return <a className="return-link" href={href} onClick={navigate}><span aria-hidden="true">←</span>{children}</a>
}

export function PortfolioLink({ onNavigate }: { onNavigate?: () => void | Promise<void> }) {
  return <ReturnLink href={portfolioUrl} onNavigate={onNavigate}>Tools I built</ReturnLink>
}
