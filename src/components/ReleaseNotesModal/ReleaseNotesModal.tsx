'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { Modal } from '../Modal'
import { Text } from '../Text'

export interface ReleaseNotesModalPage {
  /** The highlight, in a few words — “Filters you can save”. */
  title: string
  /** What changed and why it matters to the reader. */
  description: ReactNode
  /** An image, a video or a small illustration shown above the copy. */
  media?: ReactNode
}

export interface ReleaseNotesModalProps {
  /** The release being announced. Stored as the last version seen. */
  version: string
  /** One page per highlight. Three or four is plenty. */
  pages: ReleaseNotesModalPage[]
  /** Whether the dialog is showing. Omit to let the component decide from storage. */
  open?: boolean
  /** Called whenever the dialog closes, however it was closed. */
  onClose?: () => void
  /**
   * localStorage key for the last version seen. When set and `open` is omitted,
   * the dialog opens by itself for a version this browser has not seen.
   */
  storageKey?: string
  /** Called on close when “Don’t show release notes” was ticked. */
  onDontShowAgain?: () => void
  /** Visible title. */
  title?: string
  /** A link to the full changelog, shown on the last page. */
  changelogHref?: string
  /** Merged last, so it wins. */
  className?: string
}

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private windows and blocked storage: the notes simply show again next time.
  }
}

/**
 * “What’s new”, shown once per release and then out of the way.
 *
 * Highlights are paged rather than scrolled, so each one gets the whole dialog
 * and the step indicator says how much is left — a long scroll of changes is
 * closed unread. The last version seen is remembered in storage when a key is
 * given, and storage that throws (private mode, blocked cookies) degrades to
 * showing the notes again rather than breaking the page. Opting out is a
 * checkbox honoured on close, not a second button competing with “Next”.
 */
export function ReleaseNotesModal({
  version,
  pages,
  open: openProp,
  onClose,
  storageKey,
  onDontShowAgain,
  title = 'What’s new',
  changelogHref,
  className,
}: ReleaseNotesModalProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [muted, setMuted] = useState(false)
  const muteId = useId()
  const open = openProp ?? ownOpen

  useEffect(() => {
    if (openProp !== undefined || !storageKey) return
    if (read(`${storageKey}:muted`) !== '1' && read(storageKey) !== version) setOwnOpen(true)
  }, [openProp, storageKey, version])

  useEffect(() => {
    if (open) setPage(0)
  }, [open])

  const close = () => {
    if (storageKey) {
      write(storageKey, version)
      if (muted) write(`${storageKey}:muted`, '1')
    }
    if (muted) onDontShowAgain?.()
    setOwnOpen(false)
    onClose?.()
  }

  const count = pages.length
  const current = pages[Math.min(page, count - 1)]
  const last = page >= count - 1
  const go = (next: number) => setPage(Math.max(0, Math.min(count - 1, next)))

  const goRef = useRef(go)
  goRef.current = go
  const pageRef = useRef(page)
  pageRef.current = page

  // Arrow keys page through the highlights wherever focus sits in the dialog,
  // except on a control that uses arrows itself.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement | null)?.tagName ?? '')) return
      if (event.key === 'ArrowRight') goRef.current(pageRef.current + 1)
      else if (event.key === 'ArrowLeft') goRef.current(pageRef.current - 1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!current) return null

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={`Version ${version}`}
      className={cn('gap-4', className)}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <label htmlFor={muteId} className="flex cursor-pointer items-center gap-2">
            <Checkbox id={muteId} boxSize="sm" checked={muted} onChange={(event) => setMuted(event.target.checked)} />
            <Text as="span" size="caption" weight="semibold" tone="soft">
              Don’t show release notes
            </Text>
          </label>
          <div className="flex items-center gap-2">
            {page > 0 && (
              <Button variant="ghost" size="sm" onClick={() => go(page - 1)}>
                Previous
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? close() : go(page + 1))}>
              {last ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {current.media && (
          <div className="overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken">{current.media}</div>
        )}
        <Text as="h3" size="heading">
          {current.title}
        </Text>
        <p role="status" className="sr-only">
          {`Highlight ${page + 1} of ${count}: ${current.title}`}
        </p>
        <Text as="div" size="body" weight="medium" tone="soft" leading="normal">
          {current.description}
        </Text>
        {last && changelogHref && (
          <a href={changelogHref} className="self-start text-[12px] font-bold text-ink underline underline-offset-2 hover:text-ink-soft">
            Read the full changelog
          </a>
        )}
      </div>

      {count > 1 && (
        <nav aria-label="Highlights" className="flex items-center justify-center gap-1.5">
          {pages.map((item, index) => (
            <button
              key={item.title}
              type="button"
              aria-label={`Highlight ${index + 1} of ${count}: ${item.title}`}
              aria-current={index === page ? 'step' : undefined}
              onClick={() => go(index)}
              className={cn(
                'relative h-2 rounded-full transition-[width,background-color] motion-reduce:transition-none',
                // A larger hit area than the dot itself.
                'before:absolute before:-inset-x-1 before:-inset-y-3',
                index === page ? 'w-5 bg-accent-strong' : 'w-2 bg-line-strong hover:bg-ink-faint',
              )}
            />
          ))}
        </nav>
      )}
    </Modal>
  )
}
