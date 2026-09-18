'use client'

import { useEffect, useId, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Portal } from '../Portal'
import { Skeleton } from '../Skeleton'
import { Text } from '../Text'
import { usePopoverPosition, type PopoverAlign, type PopoverPlacement } from '../Popover/usePopoverPosition'

export interface LinkPreviewData {
  title: string
  description?: string
  /** Preview image — an og:image. Decorative; the title carries the meaning. */
  image?: string
  /** Site name shown beside the domain tile — "GitHub". Defaults to the domain. */
  siteName?: string
}

export type LinkPreviewProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> & {
  /** Where the link goes. It is always a normal link: click, middle-click and copy all work. */
  href: string
  /** Link text. */
  children: ReactNode
  /** The preview, when it is already known. */
  data?: LinkPreviewData
  /** Fetches the preview on first hover or focus. Results are cached per href for the session. */
  load?: (href: string) => Promise<LinkPreviewData>
  /** Milliseconds of hover or focus before the card opens. */
  openDelay?: number
  /** Grace period before closing, so the pointer can travel onto the card. */
  closeDelay?: number
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Merged onto the card. */
  cardClassName?: string
}

const cache = new Map<string, Promise<LinkPreviewData>>()

function domainOf(href: string) {
  try {
    return new URL(href, 'https://example.invalid').hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}

type LinkPreviewState = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; data: LinkPreviewData }

/**
 * A card that previews where a link goes, shown after a short hover or focus.
 *
 * The link stays a link. Previews built as buttons that open a card lose
 * middle-click, copy-link and the status bar, and the card becomes a thing
 * keyboard users have to escape from. Here the card holds no controls, is tied
 * to the link with aria-describedby, and closes on Escape, blur or pointer
 * leave — it never takes focus, so it can never trap it.
 *
 * It waits before opening, because a pointer crossing a paragraph of links
 * should not strobe cards, and it stays open while the pointer is over it, so
 * the image and description can actually be read. Data comes as a prop or from
 * a loader called once per href.
 */
export function LinkPreview({
  href,
  children,
  data,
  load,
  openDelay = 500,
  closeDelay = 200,
  placement = 'bottom',
  align = 'start',
  className,
  cardClassName,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...rest
}: LinkPreviewProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<LinkPreviewState>(data ? { status: 'ready', data } : { status: 'idle' })
  const anchorRef = useRef<HTMLAnchorElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const cardId = useId()
  const domain = domainOf(href)

  const position = usePopoverPosition(
    anchorRef as React.RefObject<HTMLElement>,
    cardRef as React.RefObject<HTMLElement>,
    open,
    placement,
    align,
    8,
  )

  useEffect(() => {
    if (data) setState({ status: 'ready', data })
  }, [data])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open || data || !load || state.status === 'ready' || state.status === 'loading') return
    let live = true
    setState({ status: 'loading' })
    let pending = cache.get(href)
    if (!pending) {
      pending = load(href)
      cache.set(href, pending)
      pending.catch(() => cache.delete(href))
    }
    pending.then(
      (result) => live && setState({ status: 'ready', data: result }),
      () => live && setState({ status: 'error' }),
    )
    return () => {
      live = false
    }
    // Keyed on the href alone: a new loader function each render must not refetch.
  }, [open, href])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  const schedule = (next: boolean) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(next), next ? openDelay : closeDelay)
  }

  const hasPreview = Boolean(data || load)
  const ready = state.status === 'ready' ? state.data : null

  return (
    <>
      <a
        ref={anchorRef}
        href={href}
        aria-describedby={open && ready ? cardId : undefined}
        onPointerEnter={(event) => {
          if (hasPreview && event.pointerType !== 'touch') schedule(true)
          onPointerEnter?.(event)
        }}
        onPointerLeave={(event) => {
          if (hasPreview) schedule(false)
          onPointerLeave?.(event)
        }}
        onFocus={(event) => {
          if (hasPreview) schedule(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          window.clearTimeout(timer.current)
          setOpen(false)
          onBlur?.(event)
        }}
        className={cn(
          'rounded-[var(--radius-4)] font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          className,
        )}
        {...rest}
      >
        {children}
      </a>
      {open && (
        <Portal>
          <div
            ref={cardRef}
            id={cardId}
            role="tooltip"
            onPointerEnter={() => window.clearTimeout(timer.current)}
            onPointerLeave={() => schedule(false)}
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              zIndex: 'var(--z-tooltip)' as unknown as number,
            }}
            className={cn(
              'w-[300px] overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface shadow-[var(--shadow-float)] transition-opacity duration-100',
              position ? 'opacity-100' : 'opacity-0',
              cardClassName,
            )}
          >
            {ready?.image && (
              <img src={ready.image} alt="" className="aspect-[1.91/1] w-full border-b border-line object-cover" />
            )}
            <div className="flex flex-col gap-1.5 p-3.5">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex size-4 items-center justify-center rounded-[var(--radius-4)] bg-surface-muted text-[9px] font-extrabold uppercase text-ink-soft"
                >
                  {domain.charAt(0)}
                </span>
                <Text as="span" size="caption" tone="faint" className="truncate">
                  {ready?.siteName ? `${ready.siteName} · ${domain}` : domain}
                </Text>
              </span>
              {ready ? (
                <>
                  <Text as="span" size="body" leading="tight" className="line-clamp-2">
                    {ready.title}
                  </Text>
                  {ready.description && (
                    <Text as="span" size="label" tone="soft" leading="normal" className="line-clamp-3">
                      {ready.description}
                    </Text>
                  )}
                </>
              ) : state.status === 'error' ? (
                <Text as="span" size="label" tone="soft">
                  No preview available for this link.
                </Text>
              ) : (
                <span aria-hidden="true" className="flex flex-col gap-2 pt-1">
                  <Skeleton width="80%" height={12} />
                  <Skeleton lines={2} />
                </span>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
