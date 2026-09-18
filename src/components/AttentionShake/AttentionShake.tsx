'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export type AttentionShakeVariant = 'shake' | 'pulse' | 'bounce'

export interface AttentionShakeHandle {
  /** Play the nudge now, optionally as a different variant than the prop. */
  play: (variant?: AttentionShakeVariant) => void
}

export interface AttentionShakeProps {
  /** The thing to draw the eye to — a form, a PIN field, a card. */
  children: ReactNode
  /**
   * Any value. Each time it changes the nudge plays; the first render never
   * plays. A submit counter or the latest error message both work.
   */
  trigger?: unknown
  /** shake says no, pulse says look here, bounce says something arrived. */
  variant?: AttentionShakeVariant
  /** Milliseconds the nudge lasts. */
  duration?: number
  /** Colour of the outline flash that replaces movement under reduced motion. Any CSS colour or token. */
  flashColor?: string
  /** Called when the nudge finishes. */
  onComplete?: () => void
  /** span for inline content such as a single field; div otherwise. */
  as?: 'div' | 'span'
  /** Merged last, so it wins. */
  className?: string
}

const KEYFRAMES: Record<AttentionShakeVariant, Keyframe[]> = {
  // Decays, so it reads as a refusal rather than a wobble.
  shake: [0, -8, 8, -6, 6, -3, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
  pulse: [{ transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(0.99)' }, { transform: 'scale(1)' }],
  bounce: [0, -10, 0, -5, 0, -2, 0].map((y) => ({ transform: `translateY(${y}px)` })),
}

/**
 * A nudge that sends the eye to something that needs another look.
 *
 * A wrong PIN or a refused submit changes nothing on screen that a person is
 * already looking at — the message appears somewhere else. A short, decaying
 * movement on the thing itself closes that gap. It is played with the Web
 * Animations API rather than a class toggle, so the same error twice in a row
 * shakes twice, and nothing has to be removed afterwards.
 *
 * Under reduced motion there is no movement at all: the outline flashes once
 * instead, which carries the same “here” without the motion. The nudge is
 * visual only, so pair it with a message a screen reader will hear — an
 * `InlineMessage` with `live`, or the field’s own error.
 */
export const AttentionShake = forwardRef<AttentionShakeHandle, AttentionShakeProps>(function AttentionShake(
  { children, trigger, variant = 'shake', duration, flashColor = 'var(--color-danger)', onComplete, as = 'div', className },
  ref,
) {
  const nodeRef = useRef<HTMLElement | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const running = useRef<Animation | null>(null)
  const previous = useRef(trigger)

  const play = useCallback(
    (which: AttentionShakeVariant = variant) => {
      const node = nodeRef.current
      if (!node || typeof node.animate !== 'function') return
      running.current?.cancel()

      if (reducedMotion) {
        // A keyframe cannot read a custom property, so the token is resolved first.
        const colour = flashColor.startsWith('var(')
          ? getComputedStyle(node).getPropertyValue(flashColor.slice(4, -1)).trim() || 'currentColor'
          : flashColor
        running.current = node.animate(
          [
            { outline: `2px solid ${colour}`, outlineOffset: '3px' },
            { outline: `2px solid ${colour}`, outlineOffset: '3px', offset: 0.6 },
            { outline: '2px solid transparent', outlineOffset: '3px' },
          ],
          { duration: duration ?? 700, easing: 'ease-out' },
        )
      } else {
        running.current = node.animate(KEYFRAMES[which], {
          duration: duration ?? (which === 'shake' ? 450 : 550),
          easing: 'ease-out',
        })
      }
      running.current.onfinish = () => onComplete?.()
    },
    [variant, reducedMotion, flashColor, duration, onComplete],
  )

  useImperativeHandle(ref, () => ({ play }), [play])

  useEffect(() => {
    // Compared rather than counted, so a double-run effect in Strict Mode does not play on mount.
    if (Object.is(previous.current, trigger)) return
    previous.current = trigger
    play()
    // Only a change of trigger plays; a new `play` identity must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  useEffect(() => () => running.current?.cancel(), [])

  const Component = as
  return (
    <Component
      ref={(node: HTMLElement | null) => {
        nodeRef.current = node
      }}
      className={cn(as === 'span' ? 'inline-block' : 'block', 'rounded-[var(--radius-field)]', className)}
    >
      {children}
    </Component>
  )
})
