'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button, type ButtonSize, type ButtonVariant } from '../Button'
import { CheckIcon, CopyIcon } from '../internal/icons'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { VisuallyHidden } from '../VisuallyHidden'

export type ShareMenuChannel = 'native' | 'copy' | 'email' | 'x' | 'linkedin' | 'facebook'

export interface ShareMenuProps {
  /** The address being shared. */
  url: string
  /** Page title — the email subject and the post text. */
  title: string
  /** Extra line passed to the native share sheet. */
  text?: string
  /** Use the device share sheet where the browser has one. */
  preferNative?: boolean
  /** Which networks to list, in order. */
  channels?: Exclude<ShareMenuChannel, 'native' | 'copy'>[]
  /** The trigger’s label. */
  label?: ReactNode
  /** Trigger button variant. */
  variant?: ButtonVariant
  /** Trigger button size. */
  size?: ButtonSize
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Called after each share action, with how it was shared. */
  onShare?: (channel: ShareMenuChannel) => void
  /** Merged onto the trigger button. */
  className?: string
}

const glyph = (path: ReactNode) => (
  <svg viewBox="0 0 16 16" width={15} height={15} fill="currentColor" aria-hidden="true">
    {path}
  </svg>
)

const ShareIcon = () => (
  <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 10V2M5 4.5L8 1.5l3 3M3.5 7.5v6h9v-6" />
  </svg>
)

const NETWORKS = {
  email: {
    label: 'Email',
    icon: (
      <svg viewBox="0 0 16 16" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden="true">
        <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5" />
        <path d="M2 4l6 4.75L14 4" />
      </svg>
    ),
    href: (url: string, title: string) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
  x: {
    label: 'X',
    icon: glyph(<path d="M12.2 1.5h2.2L9.6 7l5.6 7.5h-4.4L7.4 10l-4 4.5H1.2l5.1-5.8L.9 1.5h4.5l3.1 4.1 3.7-4.1zm-.8 11.7h1.2L4.7 2.7H3.4z" />),
    href: (url: string, title: string) => `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  linkedin: {
    label: 'LinkedIn',
    icon: glyph(<path d="M1.5 5.5h3v9h-3zM3 1.25a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2zM6.25 5.5h2.9v1.25c.4-.75 1.4-1.5 2.85-1.5 3 0 3.5 1.9 3.5 4.4v4.85h-3v-4.3c0-1 0-2.35-1.45-2.35s-1.8 1.1-1.8 2.25v4.4h-3z" />),
    href: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  facebook: {
    label: 'Facebook',
    icon: glyph(<path d="M9.2 15V8.6h2.15l.33-2.5H9.2V4.5c0-.72.2-1.2 1.24-1.2h1.32V1.07A17 17 0 009.83 1C7.9 1 6.6 2.17 6.6 4.33v1.77H4.45v2.5H6.6V15z" />),
    href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
}

const ITEM =
  'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink focus-visible:bg-surface-muted'

/**
 * One Share button that does the right thing on each device.
 *
 * On phones and in browsers with a system share sheet it hands off to
 * `navigator.share`, which already knows the reader’s apps and contacts —
 * a hand-built list can only guess. Elsewhere it opens a menu: copy link, which
 * stays open to confirm the copy in words, then email and the networks as real
 * links built from the url and title, so they open in a new tab, can be
 * middle-clicked, and work with scripts blocked. Brand marks are drawn in the
 * text colour, so the menu reads as one list rather than four logos.
 */
export function ShareMenu({
  url,
  title,
  text,
  preferNative = true,
  channels = ['email', 'x', 'linkedin', 'facebook'],
  label = 'Share',
  variant = 'outline',
  size = 'sm',
  placement = 'bottom',
  align = 'start',
  onShare,
  className,
}: ShareMenuProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const listRef = useRef<HTMLDivElement>(null)
  const reset = useRef(0)
  useEffect(() => () => window.clearTimeout(reset.current), [])

  const onOpenChange = async (next: boolean) => {
    if (next && preferNative && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title, text })
        onShare?.('native')
      } catch {
        // Dismissing the sheet rejects; that is the reader changing their mind.
      }
      return
    }
    setOpen(next)
  }

  const copy = async () => {
    window.clearTimeout(reset.current)
    try {
      await navigator.clipboard.writeText(url)
      setCopied('copied')
      onShare?.('copy')
    } catch {
      setCopied('failed')
    }
    reset.current = window.setTimeout(() => setCopied('idle'), 1800)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const at = nodes.indexOf(document.activeElement as HTMLElement)
    const moves: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: nodes.length - 1 }
    if (!(event.key in moves) || nodes.length === 0) return
    event.preventDefault()
    nodes[(moves[event.key] + nodes.length) % nodes.length]?.focus()
  }

  const copyText = copied === 'copied' ? 'Link copied' : copied === 'failed' ? 'Copy failed' : 'Copy link'

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      placement={placement}
      align={align}
      label="Share options"
      initialFocus='[role="menuitem"]'
      className="min-w-[200px] p-1"
      trigger={
        <Button variant={variant} size={size} aria-haspopup="menu" aria-expanded={open} className={className}>
          <ShareIcon />
          {label}
        </Button>
      }
    >
      <div ref={listRef} role="menu" aria-label="Share" onKeyDown={onKeyDown} className="flex flex-col">
        <button type="button" role="menuitem" tabIndex={-1} onClick={copy} className={cn(ITEM, copied === 'copied' && 'text-ink')}>
          {copied === 'copied' ? <CheckIcon size={15} /> : <CopyIcon size={15} strokeWidth={2} />}
          {copyText}
        </button>
        {channels.map((channel) => {
          const network = NETWORKS[channel]
          return (
            <a
              key={channel}
              role="menuitem"
              tabIndex={-1}
              href={network.href(url, title)}
              target={channel === 'email' ? undefined : '_blank'}
              rel="noopener noreferrer"
              onClick={() => {
                onShare?.(channel)
                setOpen(false)
              }}
              className={ITEM}
            >
              {network.icon}
              {channel === 'email' ? 'Email' : `Share on ${network.label}`}
            </a>
          )
        })}
      </div>
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {copied === 'idle' ? '' : copyText}
        </span>
      </VisuallyHidden>
    </Popover>
  )
}
