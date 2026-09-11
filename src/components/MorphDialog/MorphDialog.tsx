'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { FocusTrap } from '../FocusTrap'
import { Portal } from '../Portal'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import { usePrefersReducedMotion } from '../../lib/motion'
import type { IconComponent } from '../../lib/types'

/** Minimal X, so the component carries no icon-library dependency. */
const CloseGlyph: IconComponent = ({ size = 16, strokeWidth = 2.25 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export interface MorphDialogProps {
  /** The closed state — a card, a tile, a row. Clicking it opens the dialog. */
  trigger: ReactNode
  /** Dialog body. */
  children: ReactNode
  /** Dialog heading. Becomes the accessible name. */
  title: string
  /** Supporting line, wired to aria-describedby. */
  description?: string
  /** Dialog width in pixels, capped to the viewport. */
  width?: number
  /** Accessible name for the trigger, when the trigger is not self-describing. */
  triggerLabel?: string
  onOpenChange?: (open: boolean) => void
  /** Merged last, so it wins. */
  className?: string
  /** Classes for the opened panel rather than for the trigger. */
  dialogClassName?: string
}

const DURATION = 340
const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * A card that expands into a dialog from exactly where it sits, and collapses
 * back into it.
 *
 * This is a FLIP animation. The dialog is rendered at its final size and
 * position, then transformed back onto the trigger rectangle for one frame and
 * released — so the browser animates a single `transform`, never width, height,
 * top or left. Animating the box itself would relayout the dialog contents on
 * every frame of the open.
 *
 * The connection between the two is the point. A dialog that fades in from
 * nowhere makes the reader find their place again; one that grows out of the
 * thing they clicked tells them where they are and where they will be returned
 * to. Under `prefers-reduced-motion` it simply appears — the spatial cue is a
 * nicety, the dialog is not.
 *
 * Everything else is an ordinary dialog: portalled out of the layout, focus
 * trapped and restored, Escape and scrim both close, and the page behind it
 * cannot scroll while it is open.
 */
export function MorphDialog({
  trigger,
  children,
  title,
  description,
  width = 560,
  triggerLabel,
  onOpenChange,
  className,
  dialogClassName,
}: MorphDialogProps) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  /** Kept mounted through the closing animation. */
  const [mounted, setMounted] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  /** The transform that puts the panel exactly over the trigger. */
  const transformToTrigger = useCallback(() => {
    const panel = panelRef.current
    const origin = triggerRef.current?.getBoundingClientRect()
    if (!panel || !origin) return ''
    const box = panel.getBoundingClientRect()
    const scaleX = origin.width / box.width
    const scaleY = origin.height / box.height
    const dx = origin.left + origin.width / 2 - (box.left + box.width / 2)
    const dy = origin.top + origin.height / 2 - (box.top + box.height / 2)
    return `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`
  }, [])

  const hide = useCallback(() => {
    const panel = panelRef.current
    setOpen(false)
    onOpenChange?.(false)

    if (!panel || reducedMotion) {
      setMounted(false)
      return
    }
    panel.style.transition = `transform ${DURATION}ms ${EASING}, opacity ${Math.round(DURATION * 0.6)}ms linear`
    panel.style.transform = transformToTrigger()
    panel.style.opacity = '0'
    window.setTimeout(() => setMounted(false), DURATION)
  }, [onOpenChange, reducedMotion, transformToTrigger])

  // First frame after mount: pin the panel onto the trigger, then release it.
  useEffect(() => {
    if (!mounted) return
    const panel = panelRef.current
    if (!panel) return

    if (reducedMotion) {
      setOpen(true)
      return
    }

    panel.style.transition = 'none'
    panel.style.transformOrigin = 'center center'
    panel.style.transform = transformToTrigger()
    panel.style.opacity = '0.35'

    const frame = requestAnimationFrame(() => {
      panel.style.transition = `transform ${DURATION}ms ${EASING}, opacity ${Math.round(DURATION * 0.5)}ms linear`
      panel.style.transform = 'translate(0, 0) scale(1)'
      panel.style.opacity = '1'
      setOpen(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [mounted, reducedMotion, transformToTrigger])

  useEffect(() => {
    if (!mounted) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [hide, mounted])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={mounted}
        onClick={() => {
          setMounted(true)
          onOpenChange?.(true)
        }}
        className={cn(
          'block w-full rounded-[var(--radius-card)] text-left transition-opacity',
          // Hidden while the dialog stands in for it, so the two are never
          // both on screen mid-flight.
          mounted && 'opacity-0',
          className,
        )}
      >
        {trigger}
      </button>

      {mounted && (
        <Portal>
          <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close dialog"
              onClick={hide}
              className={cn(
                'absolute inset-0 bg-scrim backdrop-blur-[2px] transition-opacity duration-[var(--duration-slow)]',
                open ? 'opacity-100' : 'opacity-0',
              )}
            />
            <FocusTrap className="relative w-full" style={{ maxWidth: width }}>
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${id}-title`}
                aria-describedby={description ? `${id}-description` : undefined}
                className={cn(
                  'flex max-h-[86dvh] flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-window)]',
                  dialogClassName,
                )}
              >
                <div className="flex items-start gap-3 p-5 pb-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Text as="h2" id={`${id}-title`} size="subtitle">
                      {title}
                    </Text>
                    {description && (
                      <Text id={`${id}-description`} size="caption" tone="soft" leading="normal">
                        {description}
                      </Text>
                    )}
                  </div>
                  <IconButton icon={CloseGlyph} label="Close" size="sm" onClick={hide} />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
              </div>
            </FocusTrap>
          </div>
        </Portal>
      )}
    </>
  )
}
