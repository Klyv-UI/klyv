import type { ReactNode } from 'react'

export interface VisuallyHiddenProps {
  children: ReactNode
}

/**
 * Keeps text in the accessibility tree while removing it visually — the
 * mechanism behind `Avatar`'s full name and every icon-only control's label.
 */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return <span className="sr-only">{children}</span>
}
