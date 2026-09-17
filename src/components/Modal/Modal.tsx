'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { IconButton } from '../IconButton'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { FocusTrap } from '../FocusTrap'
import { Portal } from '../Portal'
import { Presence } from '../Presence'
import { CrossIcon } from '../internal/icons'

export type ModalSize = 'sm' | 'md' | 'lg'

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-[380px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[720px]',
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** Visible title. Becomes the accessible name. */
  title: string
  /** The dialog body. */
  children?: ReactNode
  /** Footer row, usually a pair of Buttons. */
  footer?: ReactNode
  /** Supporting line, wired to aria-describedby. */
  description?: string
  size?: ModalSize
  /** Forces a choice — Escape and the backdrop stop dismissing. */
  dismissible?: boolean
  /** Use alertdialog semantics, for a destructive confirmation. */
  role?: 'dialog' | 'alertdialog'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A centred dialog. It brings together the four things an accessible modal
 * needs and that are almost always partly missing: a Portal so it escapes
 * ancestor clipping, a FocusTrap that restores focus on close, scroll lock on
 * the page behind, and Escape plus backdrop dismissal.
 *
 * Everything else in the overlay family builds on this rather than repeating it.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  description,
  size = 'md',
  dismissible = true,
  role = 'dialog',
  className,
}: ModalProps) {
  // Scroll lock, Escape and the layer all come from the shared stack, so a
  // dialog opened from inside this one closes first and hands scrolling back
  // correctly. See lib/overlay.ts.
  const { zIndex } = useOverlayLayer({ open, onDismiss: onClose, dismissible })

  // Two dialogs on the page — a confirmation opened from an edit dialog — must
  // not share an id, or the inner one takes the outer one's title as its name.
  const titleId = useId()
  const descriptionId = useId()

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
        <Presence present={open} duration={150}>
          <button
            type="button"
            aria-label="Close dialog"
            tabIndex={-1}
            onClick={() => dismissible && onClose()}
            className="fixed inset-0 cursor-default bg-scrim"
          />
        </Presence>

        <Presence present={open} animation="scale" duration={150} className="relative w-full">
          <FocusTrap className={cn('mx-auto w-full', SIZES[size])}>
            <Surface
              role={role}
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              variant="floating"
              padding="lg"
              className={cn('max-h-[85dvh] gap-3 overflow-y-auto rounded-[var(--radius-card)]', className)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Text as="h2" id={titleId} size="subtitle">
                    {title}
                  </Text>
                  {description && (
                    <Text
                      id={descriptionId}
                      size="caption"
                      weight="medium"
                      tone="faint"
                      leading="normal"
                      className="mt-1"
                    >
                      {description}
                    </Text>
                  )}
                </div>
                {dismissible && (
                  <IconButton icon={CrossIcon} label="Close" size="sm" onClick={onClose} className="-mr-1 -mt-1" />
                )}
              </div>

              {children}

              {footer && <div className="mt-2 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
            </Surface>
          </FocusTrap>
        </Presence>
      </div>
    </Portal>
  )
}
