'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { FocusTrap } from '../FocusTrap'
import { IconButton } from '../IconButton'
import { ChevronLeftIcon, ChevronRightIcon, CrossIcon } from '../internal/icons'
import { Portal } from '../Portal'
import { Presence } from '../Presence'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface LightboxImage {
  src: string
  /** What the image shows. Required: it is the whole content of the dialog. */
  alt: string
  caption?: string
}

export interface LightboxProps {
  /** Every image the viewer moves between, in order. */
  images: LightboxImage[]
  /** The open image, or null when the viewer is closed. */
  index: number | null
  /** Called with the next image, or null to close. */
  onIndexChange: (index: number | null) => void
  /** Accessible name for the dialog. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/** Pixels a finger has to travel before a swipe counts. */
const SWIPE = 48

/**
 * Full-screen images, one at a time, with the rest a key press away.
 *
 * It is built the way Modal is — a Portal, a FocusTrap that hands focus back to
 * the thumbnail that opened it, scroll lock on the page behind, Escape and the
 * backdrop to close — so it behaves like every other overlay in the library.
 * The arrow keys, Home and End move between images, a swipe does the same on
 * touch, and the position ("3 of 8") is announced as it changes. Controls sit
 * on themed surfaces rather than on the scrim, so they read in either theme.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  label = 'Image viewer',
  className,
}: LightboxProps) {
  const touchStart = useRef<number | null>(null)
  const open = index !== null && images.length > 0

  const go = (next: number) => onIndexChange((next + images.length) % images.length)

  // Scroll lock, Escape and the layer come from the shared stack.
  const { zIndex, isTop } = useOverlayLayer({ open, onDismiss: () => onIndexChange(null) })

  useEffect(() => {
    // The arrows belong to whatever is in front: with a dialog open over the
    // lightbox, ArrowRight moves that dialog's caret, not the photo behind it.
    if (!open || !isTop) return

    const onKeyDown = (event: KeyboardEvent) => {
      const at = index as number
      if (event.key === 'ArrowRight') go(at + 1)
      else if (event.key === 'ArrowLeft') go(at - 1)
      else if (event.key === 'Home') onIndexChange(0)
      else if (event.key === 'End') onIndexChange(images.length - 1)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // `go` is derived from these; re-subscribing on them keeps it current.
  }, [open, isTop, index, images.length, onIndexChange])

  if (index === null || images.length === 0) return null

  const at = Math.min(index, images.length - 1)
  const current = images[at]
  const several = images.length > 1

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn('fixed inset-0', className)}
        style={{ zIndex }}
      >
        <Presence present duration={150}>
          <div aria-hidden="true" className="fixed inset-0 bg-scrim" onClick={() => onIndexChange(null)} />
        </Presence>

        <FocusTrap className="relative flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 p-4">
            <Surface variant="floating" padding="none" className="rounded-full px-3 py-1.5">
              <Text as="span" size="caption" weight="bold" tabular>
                {at + 1} / {images.length}
              </Text>
            </Surface>
            <IconButton icon={CrossIcon} label="Close" tone="white" onClick={() => onIndexChange(null)} />
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center gap-3 px-4"
            onTouchStart={(event) => {
              touchStart.current = event.touches[0].clientX
            }}
            onTouchEnd={(event) => {
              const start = touchStart.current
              touchStart.current = null
              if (start === null || !several) return
              const distance = event.changedTouches[0].clientX - start
              if (Math.abs(distance) > SWIPE) go(at + (distance < 0 ? 1 : -1))
            }}
          >
            {several && (
              <IconButton
                icon={ChevronLeftIcon}
                label="Previous image"
                tone="white"
                onClick={() => go(at - 1)}
                className="shrink-0"
              />
            )}

            <Presence
              key={current.src}
              present
              animation="scale"
              duration={150}
              className="flex min-h-0 min-w-0 flex-1 items-center justify-center"
            >
              <img
                src={current.src}
                alt={current.alt}
                className="max-h-[76dvh] max-w-full rounded-[var(--radius-card)] object-contain shadow-[var(--shadow-window)]"
              />
            </Presence>

            {several && (
              <IconButton
                icon={ChevronRightIcon}
                label="Next image"
                tone="white"
                onClick={() => go(at + 1)}
                className="shrink-0"
              />
            )}
          </div>

          <div className="flex min-h-16 justify-center p-4">
            {current.caption && (
              <Surface variant="floating" padding="sm" className="max-w-[60ch]">
                <Text size="caption" weight="medium" leading="normal">
                  {current.caption}
                </Text>
              </Surface>
            )}
          </div>

          <VisuallyHidden>
            <span role="status" aria-live="polite">
              {`Image ${at + 1} of ${images.length}${current.caption ? `: ${current.caption}` : ''}`}
            </span>
          </VisuallyHidden>
        </FocusTrap>
      </div>
    </Portal>
  )
}
