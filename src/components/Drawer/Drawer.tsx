'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import { FocusTrap } from '../FocusTrap'
import { Portal } from '../Portal'
import { CrossIcon } from '../internal/icons'

export type DrawerSide = 'left' | 'right' | 'bottom'

const PANELS: Record<DrawerSide, string> = {
  left: 'inset-y-0 left-0 h-full w-[290px] max-w-[85vw]',
  right: 'inset-y-0 right-0 h-full w-[380px] max-w-[85vw]',
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-[var(--radius-window)]',
}

const CLOSED: Record<DrawerSide, string> = {
  left: '-translate-x-full',
  right: 'translate-x-full',
  bottom: 'translate-y-full',
}

export interface DrawerProps {
  /** Whether the dialog is showing. */
  open: boolean
  /** Called on cancel, on Escape, and on a backdrop click. */
  onClose: () => void
  /** Visible title. Becomes the accessible name. */
  title: string
  /** The panel body. */
  children?: ReactNode
  footer?: ReactNode
  side?: DrawerSide
  /** Hide the header entirely; supply your own inside children. */
  bare?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A panel anchored to an edge — the mobile navigation, a filter sheet, a detail
 * view. It shares Modal's machinery (Portal, FocusTrap, scroll lock, Escape and
 * backdrop dismissal) and differs only in where it comes from.
 *
 * The panel slides rather than fades, because the direction is what tells the
 * reader where it came from and where dismissing will send it.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'left',
  bare = false,
  className,
}: DrawerProps) {
  // Scroll lock, Escape and the layer come from the shared stack, as Modal's do.
  const { zIndex } = useOverlayLayer({ open, onDismiss: onClose })

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0" style={{ zIndex }}>
        <button
          type="button"
          aria-label="Close panel"
          tabIndex={-1}
          onClick={onClose}
          className="absolute inset-0 cursor-default bg-scrim"
        />
        <FocusTrap className={cn('absolute', PANELS[side])}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'flex h-full flex-col gap-4 bg-surface p-5 shadow-[var(--shadow-window)]',
              'transition-transform duration-[var(--duration-slow)] ease-out',
              open ? 'translate-x-0 translate-y-0' : CLOSED[side],
              side === 'bottom' && 'rounded-t-[var(--radius-window)]',
              className,
            )}
          >
            {!bare && (
              <div className="flex shrink-0 items-center justify-between gap-3">
                <Text as="h2" size="heading" truncate>
                  {title}
                </Text>
                <IconButton icon={CrossIcon} label="Close" size="sm" onClick={onClose} />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="shrink-0 border-t border-line pt-4">{footer}</div>}
          </div>
        </FocusTrap>
      </div>
    </Portal>
  )
}
