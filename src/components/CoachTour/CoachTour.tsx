'use client'

import { useEffect, useState } from 'react'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { Button } from '../Button'
import { Text } from '../Text'
import { FocusTrap } from '../FocusTrap'
import { Portal } from '../Portal'
import type { ReactNode } from 'react'

export interface TourStep {
  id: string
  /** CSS selector for the element to highlight. */
  target: string
  title: string
  description: ReactNode
  /** Preferred side of the target. Flips when it will not fit. */
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export interface CoachTourProps {
  steps: TourStep[]
  /** Whether the tour is running. */
  open: boolean
  /** Called when the tour is dismissed. */
  onClose: () => void
  /** Fired after the last step is confirmed. */
  onComplete?: () => void
  /** Accessible name for the tour dialog. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 8

/**
 * A guided product tour: the page dims, one element stays lit, and a card
 * explains it.
 *
 * Feature introduction is a real problem with a lot of bad solutions — a modal
 * that describes the interface instead of pointing at it, or a tooltip chain
 * that scrolls the target off screen. This scrolls each target into view, cuts
 * a literal hole in the scrim over it, and anchors the card to the lit element.
 *
 * The card is focus-trapped and the tour is dismissible at every step, because
 * a tour a user cannot leave is worse than no tour. Escape closes it, arrows
 * move between steps, and progress is announced.
 */
export function CoachTour({
  steps,
  open,
  onClose,
  onComplete,
  label = 'Product tour',
  className,
}: CoachTourProps) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const step = steps[index]
  const last = index === steps.length - 1

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  useIsomorphicLayoutEffect(() => {
    if (!open || !step) return

    // Brought into view once per step. It used to happen inside `measure`,
    // which runs on every scroll — including the smooth scroll it had just
    // started — so anyone scrolling a nested container was dragged back.
    document.querySelector(step.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const measure = () => {
      const element = document.querySelector(step.target)
      if (!element) {
        setRect(null)
        return
      }
      const box = element.getBoundingClientRect()
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height })
    }

    measure()
    const timer = setTimeout(measure, 320)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step])

  // Scroll lock, Escape and the layer come from the shared stack.
  const { zIndex, isTop } = useOverlayLayer({ open, onDismiss: onClose })

  useEffect(() => {
    // Arrows step the tour only while nothing is open in front of it.
    if (!open || !isTop) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(steps.length - 1, value + 1))
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1))
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, isTop, steps.length])

  if (!open || !step) return null

  const placement = step.placement ?? 'bottom'
  const cardWidth = 300

  // Read during render, so it has to survive a server render: a tour opened on
  // first load (`open={!user.seenTour}`) used to throw `window is not defined`.
  const viewport =
    typeof window === 'undefined' ? { width: 0, height: 0 } : { width: window.innerWidth, height: window.innerHeight }

  const cardPosition = (() => {
    if (!rect) {
      return { top: viewport.height / 2 - 80, left: viewport.width / 2 - cardWidth / 2 }
    }
    const below = rect.top + rect.height + PAD + 12
    const above = rect.top - PAD - 12
    const fitsBelow = below + 180 < viewport.height
    const top = placement === 'top' && above > 180 ? above - 180 : fitsBelow ? below : Math.max(16, above - 180)
    const left = Math.min(
      Math.max(16, rect.left + rect.width / 2 - cardWidth / 2),
      viewport.width - cardWidth - 16,
    )
    return { top, left }
  })()

  return (
    <Portal>
      <div className={cn('fixed inset-0', className)} style={{ zIndex }}>
        {/* Scrim with a hole cut over the target, drawn as four panes so the
            lit element stays fully interactive underneath. */}
        {rect ? (
          <>
            <Pane style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PAD) }} />
            <Pane style={{ top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0 }} />
            <Pane
              style={{
                top: rect.top - PAD,
                left: 0,
                width: Math.max(0, rect.left - PAD),
                height: rect.height + PAD * 2,
              }}
            />
            <Pane
              style={{
                top: rect.top - PAD,
                left: rect.left + rect.width + PAD,
                right: 0,
                height: rect.height + PAD * 2,
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute rounded-[var(--radius-tile)] ring-2 ring-accent-strong transition-all duration-[var(--duration-slow)]"
              style={{
                top: rect.top - PAD,
                left: rect.left - PAD,
                width: rect.width + PAD * 2,
                height: rect.height + PAD * 2,
              }}
            />
          </>
        ) : (
          <Pane style={{ inset: 0 }} />
        )}

        <FocusTrap
          className="absolute transition-all duration-[var(--duration-slow)]"
          style={{ top: cardPosition.top, left: cardPosition.left, width: cardWidth }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-window)]"
          >
            <div className="flex items-center justify-between gap-3">
              <Text size="caption" weight="bold" tone="faint" role="status" aria-live="polite">
                Step {index + 1} of {steps.length}
              </Text>
              <div className="flex gap-1" aria-hidden="true">
                {steps.map((entry, entryIndex) => (
                  <span
                    key={entry.id}
                    className={cn(
                      'h-1 rounded-full transition-all',
                      entryIndex === index ? 'w-4 bg-accent-strong' : 'w-1 bg-line-strong',
                    )}
                  />
                ))}
              </div>
            </div>

            <div>
              <Text size="heading">{step.title}</Text>
              <Text size="caption" weight="medium" tone="soft" leading="normal" className="mt-1">
                {step.description}
              </Text>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Skip
              </Button>
              <div className="flex gap-2">
                {index > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setIndex(index - 1)}>
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    if (last) {
                      onComplete?.()
                      onClose()
                    } else {
                      setIndex(index + 1)
                    }
                  }}
                >
                  {last ? 'Done' : 'Next'}
                </Button>
              </div>
            </div>
          </div>
        </FocusTrap>
      </div>
    </Portal>
  )
}

function Pane({ style }: { style: React.CSSProperties }) {
  return <span aria-hidden="true" className="absolute bg-scrim transition-all duration-[var(--duration-slow)]" style={style} />
}
