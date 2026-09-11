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
  /**
   * Render inside a host page rather than as the page — a docs preview, a
   * marketing embed, a Storybook canvas. The content region becomes a plain
   * region instead of a second `main` landmark, and the skip link is left to
   * the host, which already has one. Layout is unchanged.
   */
  embedded?: boolean
}

/**
 * The page frame: a tinted canvas, a rounded application window from xl up, a
 * header, an optional rail, and the content column.
 *
 * It renders the SkipLink as the first focusable element and gives main a real
 * id and tabIndex, so the skip actually lands somewhere — the part that is
 * usually missing when a shell is assembled by hand.
 *
 * A page has exactly one main landmark. When the shell is shown inside another
 * page, `embedded` hands both the landmark and the skip link back to the host
 * rather than duplicating them.
 */
export function AppShell({
  header,
  sidebar,
  children,
  bottomBar,
  framed = true,
  maxWidth = 1512,
  className,
  embedded = false,
}: AppShellProps) {
  const Content = embedded ? 'div' : 'main'

  return (
    <div className={cn('min-h-dvh bg-canvas', framed && 'xl:p-6', className)}>
      {!embedded && <SkipLink target="app-main" />}
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
          <Content
            id={embedded ? undefined : 'app-main'}
            tabIndex={embedded ? undefined : -1}
            className="min-w-0 flex-1 focus-visible:outline-none"
          >
            {children}
          </Content>
        </div>
        {bottomBar}
      </div>
    </div>
  )
}
