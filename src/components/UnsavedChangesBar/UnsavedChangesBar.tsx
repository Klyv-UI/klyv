'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { ConfirmPopover } from '../ConfirmPopover'
import { Kbd } from '../Kbd'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export type UnsavedChangesBarPosition = 'sticky' | 'fixed' | 'static'

export interface UnsavedChangesBarProps {
  /** Whether the form has changes that are not saved. The bar shows while this is true. */
  dirty: boolean
  /** Save the changes. Return a promise to show Save as pending; a rejection keeps the bar up with the message. */
  onSave: () => void | Promise<void>
  /** Throw the changes away. */
  onDiscard: () => void
  /** The sentence on the bar. */
  message?: ReactNode
  saveLabel?: string
  discardLabel?: string
  /** Ask before discarding. */
  confirmDiscard?: boolean
  /** Save on Ctrl+S / ⌘S while dirty. */
  shortcut?: boolean
  /** Warn with the browser’s own dialog when leaving the page while dirty. */
  warnOnLeave?: boolean
  /** sticky rides the bottom of its scroll container; fixed pins to the viewport; static sits in the flow. */
  position?: UnsavedChangesBarPosition
  /** Merged last, so it wins. */
  className?: string
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/**
 * The bar that rises when a form has changes nobody has saved.
 *
 * Long settings pages put Save at the very bottom, so a reader who changed a
 * field near the top has no idea the change is pending and navigates away.
 * The bar arrives the moment the form is dirty, stays in view while scrolling,
 * and leaves once it is clean — its presence is the state. Discard asks first,
 * since it is the one action here that cannot be taken back, and Ctrl+S / ⌘S
 * saves from anywhere on the page, the way every editor has taught people to
 * expect.
 *
 * Its arrival is announced through a live region that stays mounted, not by
 * moving focus: yanking the reader out of the field they are typing in to
 * tell them they are typing is worse than useless. The slide is a short
 * transition that reduced motion turns into a plain appearance, and while
 * hidden the bar is out of the tab order entirely. `warnOnLeave` adds the
 * browser’s own leave-page prompt.
 */
export function UnsavedChangesBar({
  dirty,
  onSave,
  onDiscard,
  message = 'You have unsaved changes',
  saveLabel = 'Save changes',
  discardLabel = 'Discard',
  confirmDiscard = true,
  shortcut = true,
  warnOnLeave = false,
  position = 'sticky',
  className,
}: UnsavedChangesBarProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [mac, setMac] = useState(false)
  const wasDirty = useRef(dirty)
  const barRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => setMac(isMac()), [])

  useEffect(() => {
    if (dirty && !wasDirty.current) setAnnouncement(typeof message === 'string' ? message : 'You have unsaved changes')
    if (!dirty && wasDirty.current) {
      setError(null)
      // Saving or discarding from the bar hides it with focus inside. Focus
      // goes back to where the reader was before they reached for the bar.
      const frame = requestAnimationFrame(() => {
        const active = document.activeElement
        if (active && active !== document.body && !barRef.current?.contains(active)) return
        if (returnFocus.current?.isConnected) returnFocus.current.focus()
      })
      wasDirty.current = dirty
      return () => cancelAnimationFrame(frame)
    }
    wasDirty.current = dirty
  }, [dirty, message])

  const save = async () => {
    if (pending || !dirty) return
    setPending(true)
    setError(null)
    try {
      await onSave()
      setAnnouncement('Changes saved')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Saving failed. Try again.')
    } finally {
      setPending(false)
    }
  }

  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (!shortcut || !dirty) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      void saveRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcut, dirty])

  useEffect(() => {
    if (!warnOnLeave || !dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [warnOnLeave, dirty])

  const discardButton = (
    <Button variant="ghost" size="sm" disabled={pending} onClick={confirmDiscard ? undefined : onDiscard}>
      {discardLabel}
    </Button>
  )

  return (
    <>
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {announcement}
        </span>
      </VisuallyHidden>
      <div
        ref={barRef}
        role="region"
        onFocus={(event) => {
          const from = event.relatedTarget as HTMLElement | null
          // Coming back from the discard confirmation is not "where the reader was".
          if (from && !event.currentTarget.contains(from) && !from.closest('[role="dialog"]')) returnFocus.current = from
        }}
        aria-label="Unsaved changes"
        {...(!dirty ? { inert: '' as unknown as boolean } : {})}
        className={cn(
          'z-40 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-full border border-line bg-surface py-2 pl-5 pr-2 shadow-[var(--shadow-float)]',
          'transition-[transform,opacity,visibility] duration-200 ease-out motion-reduce:transition-none',
          position === 'sticky' && 'sticky bottom-4 mx-auto w-fit max-w-full',
          position === 'fixed' && 'fixed inset-x-0 bottom-5 mx-auto w-fit max-w-[calc(100%-32px)]',
          dirty ? 'visible translate-y-0 opacity-100' : 'pointer-events-none invisible translate-y-4 opacity-0',
          className,
        )}
      >
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-warning" />
        <Text as="span" size="body" weight="semibold" className="mr-auto">
          {message}
        </Text>
        {error && (
          <Text as="span" size="caption" tone="danger" weight="semibold" role="alert">
            {error}
          </Text>
        )}
        {shortcut && (
          <span className="hidden items-center gap-1 sm:inline-flex" aria-hidden="true">
            <Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>S</Kbd>
          </span>
        )}
        <div className="flex items-center gap-1.5">
          {confirmDiscard ? (
            <ConfirmPopover
              trigger={discardButton}
              title="Discard your changes?"
              description="Everything since the last save is lost. This cannot be undone."
              confirmLabel={discardLabel}
              tone="destructive"
              placement="top"
              align="end"
              onConfirm={onDiscard}
            />
          ) : (
            discardButton
          )}
          <Button size="sm" loading={pending} onClick={() => void save()} aria-keyshortcuts={shortcut ? 'Control+S Meta+S' : undefined}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </>
  )
}
