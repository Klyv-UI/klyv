'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { FocusTrap } from '../FocusTrap'
import { IconButton } from '../IconButton'
import { Portal } from '../Portal'
import { Presence } from '../Presence'
import { Text } from '../Text'
import { CrossIcon } from '../internal/icons'

export type FullscreenDialogMode = 'responsive' | 'always'

export interface FullscreenDialogProps {
  open: boolean
  /** Called when the dialog should close — after the discard question, if there are unsaved changes. */
  onClose: () => void
  /** Visible title in the header. Becomes the accessible name. */
  title: string
  /** The scrollable body. */
  children?: ReactNode
  /** Label on the header's primary action — "Save", "Send". Omit for no action. */
  actionLabel?: string
  /** Runs the primary action. */
  onAction?: () => void
  /** Blocks the primary action, e.g. while the form is invalid. */
  actionDisabled?: boolean
  /** Shows the primary action as working. */
  actionLoading?: boolean
  /** responsive fills the screen below 640px and is a tall centred sheet above; always fills it everywhere. */
  mode?: FullscreenDialogMode
  /** There are unsaved changes. Closing asks before throwing them away. */
  dirty?: boolean
  /** Title of the discard question. */
  discardTitle?: string
  /** Body of the discard question. */
  discardDescription?: string
  /** Label on the button that throws the changes away. */
  discardLabel?: string
  /** Optional footer, pinned under the body. */
  footer?: ReactNode
  /** Merged onto the dialog panel. */
  className?: string
}

/**
 * A dialog for a whole task on a phone — compose, edit a record, fill a form.
 *
 * A centred Modal on a small screen leaves a sliver of page around a box that
 * scrolls inside itself, with the keyboard covering half of it. This fills the
 * screen instead, puts close and the primary action in the header where the
 * thumb and the eye expect them, and lets only the body scroll. On a wide
 * screen the same content is a tall sheet, so a desktop form is not stretched
 * across the monitor.
 *
 * It keeps everything Modal gets from the shared overlay stack: focus trap and
 * return, scroll lock, Escape. Closing with unsaved changes asks first — a
 * full-screen form is where people put the most work, and one stray Escape
 * should not cost them all of it.
 */
export function FullscreenDialog({
  open,
  onClose,
  title,
  children,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionLoading = false,
  mode = 'responsive',
  dirty = false,
  discardTitle = 'Discard changes?',
  discardDescription = 'You have changes that have not been saved. They will be lost.',
  discardLabel = 'Discard',
  footer,
  className,
}: FullscreenDialogProps) {
  const [confirming, setConfirming] = useState(false)
  const titleId = useId()

  const requestClose = () => {
    if (dirty) setConfirming(true)
    else onClose()
  }

  const { zIndex } = useOverlayLayer({ open, onDismiss: requestClose })

  useEffect(() => {
    if (!open) setConfirming(false)
  }, [open])

  if (!open) return null

  const always = mode === 'always'

  return (
    <Portal>
      <div className={cn('fixed inset-0 flex items-stretch justify-center', !always && 'sm:items-center sm:p-6')} style={{ zIndex }}>
        {!always && (
          <Presence present={open} duration={150}>
            <button
              type="button"
              aria-label="Close dialog"
              tabIndex={-1}
              onClick={requestClose}
              className="fixed inset-0 hidden cursor-default bg-scrim sm:block"
            />
          </Presence>
        )}

        {/* Stands down while the discard question is up, so the two traps do not fight over Tab. */}
        <FocusTrap
          active={!confirming}
          className={cn('relative flex h-full w-full', !always && 'sm:h-[min(88dvh,760px)] sm:max-w-[640px]')}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'flex h-full w-full flex-col overflow-hidden bg-surface text-ink',
              !always && 'sm:rounded-[var(--radius-card)] sm:shadow-[var(--shadow-float)]',
              className,
            )}
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-line px-2 py-2 sm:px-3">
              <IconButton icon={CrossIcon} label="Close" size="sm" onClick={requestClose} />
              <Text as="h2" id={titleId} size="heading" className="min-w-0 flex-1 truncate leading-tight">
                {title}
              </Text>
              {actionLabel && (
                <Button size="sm" onClick={onAction} disabled={actionDisabled} loading={actionLoading}>
                  {actionLabel}
                </Button>
              )}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>

            {footer && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
                {footer}
              </div>
            )}
          </div>
        </FocusTrap>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          onClose()
        }}
        title={discardTitle}
        description={discardDescription}
        confirmLabel={discardLabel}
        cancelLabel="Keep editing"
        destructive
      />
    </Portal>
  )
}
