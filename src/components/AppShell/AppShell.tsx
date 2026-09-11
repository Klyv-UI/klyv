import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SkipLink } from '../SkipLink'

export interface AppShellProps {
  /** The header region — usually a Navbar. */
  header?: ReactNode
  /** The left rail or sidebar. Hidden below the lg breakpoint. */
  sidebar?: ReactNode
  /** The page content, rendered inside the main landmark. */
  children: ReactNode
  /** Bottom navigation, for narrow viewports. */
  bottomBar?: ReactNode
  /**
   * Reproduce the floating rounded window from xl up. Turn it off for a
   * conventional full-bleed application.
   */
  framed?: boolean
  /** Maximum content width. The design targets 1512px. */
  maxWidth?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The page frame: a tinted canvas, a rounded application window from xl up, a
 * header, an optional rail, and the content column.
 *
 * It renders the SkipLink as the first focusable element and gives main a real
 * id and tabIndex, so the skip actually lands somewhere — the part that is
 * usually missing when a shell is assembled by hand.
 */
export function AppShell({
  header,
  sidebar,
  children,
  bottomBar,
  framed = true,
  maxWidth = 1512,
  className,
}: AppShellProps) {
  return (
    <div className={cn('min-h-dvh bg-canvas', framed && 'xl:p-6', className)}>
      <SkipLink target="app-main" />
      <div
        style={{ maxWidth }}
        className={cn(
          'mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-app',
          framed && 'xl:min-h-[calc(100dvh-3rem)] xl:rounded-[var(--radius-window)] xl:shadow-[var(--shadow-window)]',
        )}
      >
        {header}
        <div className="flex flex-1 gap-3 px-3 pb-4 lg:gap-4 lg:px-5 lg:pb-5">
          {sidebar}
          <main id="app-main" tabIndex={-1} className="min-w-0 flex-1 focus-visible:outline-none">
            {children}
          </main>
        </div>
        {bottomBar}
      </div>
    </div>
  )
}
