'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { CrossIcon, MenuIcon } from '../internal/icons'

export interface SiteLink {
  label: string
  href: string
  /** Marks the page being viewed. */
  current?: boolean
}

export interface SiteHeaderProps {
  /** The lockup on the left — usually a Wordmark inside a link home. */
  brand: ReactNode
  links?: SiteLink[]
  /** Right-hand affordances: sign in, and the primary call to action. */
  actions?: ReactNode
  /** Pin to the top and lift off the page once it has scrolled. */
  sticky?: boolean
  /** Accessible name for the navigation landmark. */
  label?: string
  /** Width of the content column. */
  maxWidth?: number
  className?: string
}

/**
 * The marketing site's top bar. Distinct from `Navbar`, which is the signed-in
 * application header: this one is links out to pages rather than sections of a
 * workspace, and its right-hand side is a sign-up rather than an identity.
 *
 * It stays transparent over the hero and gains a hairline and a blur only once
 * the page moves — a permanently opaque bar puts a seam across the one screen
 * that is designed as a single image.
 *
 * Below `md` the links fold into a disclosure panel rather than a modal drawer:
 * it pushes content down, needs no focus trap, and Escape closes it.
 */
export function SiteHeader({
  brand,
  links = [],
  actions,
  sticky = true,
  label = 'Main',
  maxWidth = 1200,
  className,
}: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const panelId = useId()

  useEffect(() => {
    if (!sticky) return
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sticky])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    // Growing past the breakpoint with the panel open would leave it stranded.
    const query = window.matchMedia('(min-width: 768px)')
    const onResize = () => query.matches && setOpen(false)
    document.addEventListener('keydown', onKey)
    query.addEventListener('change', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      query.removeEventListener('change', onResize)
    }
  }, [open])

  const lifted = scrolled || open

  return (
    <header
      className={cn(
        'z-[var(--z-sticky)] w-full border-b transition-[background-color,border-color] duration-[var(--duration-slow)]',
        sticky && 'sticky top-0',
        lifted ? 'border-line bg-surface/85 backdrop-blur-md' : 'border-transparent',
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full items-center gap-6 px-5" style={{ maxWidth }}>
        <div className="flex shrink-0 items-center">{brand}</div>

        {links.length > 0 && (
          <nav aria-label={label} className="hidden md:block">
            <ul className="flex items-center gap-0.5">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    aria-current={link.current ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                      link.current
                        ? 'bg-surface-muted text-ink'
                        : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
                    )}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {actions && <div className="ml-auto hidden items-center gap-2 md:flex">{actions}</div>}

        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
          className="ml-auto inline-flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-muted md:hidden"
        >
          {open ? <CrossIcon size={18} /> : <MenuIcon size={18} />}
        </button>
      </div>

      <div id={panelId} hidden={!open} className="border-t border-line px-5 pb-5 pt-2 md:hidden">
        {links.length > 0 && (
          <nav aria-label={label}>
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    aria-current={link.current ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className="flex h-11 items-center border-b border-line text-[14px] font-semibold text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {actions && <div className="mt-4 flex flex-col gap-2 [&>*]:w-full">{actions}</div>}
      </div>
    </header>
  )
}
