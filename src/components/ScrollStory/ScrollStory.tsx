'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Text } from '../Text'

export interface ScrollStoryStep {
  id: string
  /** Short heading for the step. */
  title: string
  /** The copy that scrolls past. */
  content: ReactNode
}

export type ScrollStorySide = 'left' | 'right'

export interface ScrollStoryProps {
  steps: ScrollStoryStep[]
  /** Draws the visual for a step. Called with the active step in the sticky layout, and once per step when stacked. */
  renderVisual: (index: number, step: ScrollStoryStep) => ReactNode
  /** Which side the sticky visual sits on. */
  visualSide?: ScrollStorySide
  /** Called when a different step becomes active. */
  onStepChange?: (index: number, step: ScrollStoryStep) => void
  /** Distance from the top of the viewport the visual sticks at — clear a fixed header here. */
  stickyTop?: number
  /** Accessible name for the whole story. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

const WIDE = '(min-width: 768px)'

function useWide() {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(WIDE)
    setWide(query.matches)
    const onChange = (event: MediaQueryListEvent) => setWide(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return wide
}

/**
 * Scrollytelling: the copy scrolls, the picture beside it stays and changes.
 *
 * Each step is watched by one IntersectionObserver with a thin band across the
 * middle of the viewport, so the step being read is the one in the middle of
 * the screen — not the one whose top edge happened to cross last. The active
 * index is handed to `renderVisual`, which keeps the visual a plain function of
 * a number and leaves the drawing to the caller.
 *
 * Swapping a picture in place while text moves past only works with room for
 * both. On a narrow screen, and whenever reduced motion is asked for, the story
 * stacks instead: every step is followed by its own visual, nothing sticks and
 * nothing changes under the reader’s eyes. The content is the same either way.
 */
export function ScrollStory({
  steps,
  renderVisual,
  visualSide = 'right',
  onStepChange,
  stickyTop = 80,
  label,
  className,
}: ScrollStoryProps) {
  const wide = useWide()
  const reducedMotion = usePrefersReducedMotion()
  const sticky = wide && !reducedMotion
  const [active, setActive] = useState(0)
  const stepRefs = useRef<(HTMLLIElement | null)[]>([])
  const changeRef = useRef(onStepChange)
  changeRef.current = onStepChange

  useEffect(() => {
    if (!sticky || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = stepRefs.current.indexOf(entry.target as HTMLLIElement)
          if (index >= 0) setActive(index)
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    for (const node of stepRefs.current) if (node) observer.observe(node)
    return () => observer.disconnect()
  }, [sticky, steps.length])

  const safeActive = Math.min(active, Math.max(0, steps.length - 1))
  const reported = useRef(0)
  useEffect(() => {
    if (reported.current === safeActive) return
    reported.current = safeActive
    const step = steps[safeActive]
    if (step) changeRef.current?.(safeActive, step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeActive])

  if (!sticky) {
    return (
      <section aria-label={label} className={cn('flex flex-col gap-10', className)}>
        <ol className="flex flex-col gap-10">
          {steps.map((step, index) => (
            <li key={step.id} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Text size="caption" weight="bold" tone="faint" tabular>
                  Step {index + 1} of {steps.length}
                </Text>
                <Text as="h3" size="subtitle">
                  {step.title}
                </Text>
                <div className="text-[13px] font-medium leading-normal text-ink-soft">{step.content}</div>
              </div>
              <div>{renderVisual(index, step)}</div>
            </li>
          ))}
        </ol>
      </section>
    )
  }

  const current = steps[safeActive]

  return (
    <section aria-label={label} className={cn('grid grid-cols-2 gap-10', className)}>
      <ol className={cn('flex flex-col', visualSide === 'left' && 'order-2')}>
        {steps.map((step, index) => (
          <li
            key={step.id}
            ref={(node) => {
              stepRefs.current[index] = node
            }}
            aria-current={index === safeActive ? 'step' : undefined}
            className="flex min-h-[70vh] items-center py-8 first:min-h-[50vh] last:min-h-[60vh]"
          >
            <div
              className={cn(
                'flex flex-col gap-2 border-l-2 pl-5 transition-[opacity,border-color] duration-300',
                index === safeActive ? 'border-accent-strong opacity-100' : 'border-line opacity-45',
              )}
            >
              <Text size="caption" weight="bold" tone="faint" tabular>
                Step {index + 1} of {steps.length}
              </Text>
              <Text as="h3" size="subtitle">
                {step.title}
              </Text>
              <div className="text-[13px] font-medium leading-normal text-ink-soft">{step.content}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className={cn(visualSide === 'left' && 'order-1')}>
        <div className="sticky flex flex-col gap-3" style={{ top: stickyTop }}>
          {current && renderVisual(safeActive, current)}
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="flex flex-1 gap-1">
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-300',
                    index <= safeActive ? 'bg-accent-strong' : 'bg-line-strong',
                  )}
                />
              ))}
            </div>
            <Text as="span" size="caption" weight="bold" tone="faint" tabular>
              {String(safeActive + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
            </Text>
          </div>
        </div>
      </div>
    </section>
  )
}
