'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'

export interface CursorAuraProps {
  /** Region the aura lives in. Omit and it follows the whole document. */
  scopeRef?: React.RefObject<HTMLElement | null>
  /** Resting diameter in pixels. */
  size?: number
  /** Selector for elements the aura snaps to and wraps. */
  target?: string
  /** How quickly it catches up, 0 to 1. Lower is heavier. */
  ease?: number
  /** Any CSS colour for the glow. */
  color?: string
  /** Read `data-aura` off the hovered target and show it inside the aura. */
  labels?: boolean
  /** Invert what is underneath instead of tinting it. */
  invert?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A blob that follows the pointer, and swallows whatever it hovers.
 *
 * It lags. The aura eases towards the pointer a fraction of the distance each
 * frame, so it arrives a moment late and overshoots nothing — which is what
 * gives it mass. A cursor that tracks the pointer exactly is just a second
 * cursor, and the whole appeal here is that this one feels like an object.
 *
 * Over a target it stops being a blob and becomes that element's rectangle:
 * position, size and radius all animate to match, so it reads as the aura
 * *wrapping* the button rather than sitting on top of it. The pointer is
 * hidden while it does, because two cursors is one too many.
 *
 * Nothing here touches React state. Position, size and radius are written
 * straight to the node inside one frame loop — sixty renders a second to move
 * a decoration would be the most expensive possible way to do this.
 */
export function CursorAura({
  scopeRef,
  size = 26,
  target = 'a, button, [data-aura]',
  ease = 0.16,
  color = 'var(--color-accent-strong)',
  labels = true,
  invert = false,
  className,
}: CursorAuraProps) {
  const auraRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const aura = auraRef.current
    if (!aura) return
    const scope: HTMLElement | Document = scopeRef?.current ?? document

    // Where it is, versus where it wants to be.
    const at = { x: -200, y: -200, w: size, h: size, r: size / 2 }
    const to = { ...at }
    let frame = 0
    let visible = false
    let hovering: HTMLElement | null = null

    const onMove = (event: PointerEvent) => {
      visible = true
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>(target) ?? null

      if (element) {
        // Become the element's rectangle rather than sitting on top of it.
        const box = element.getBoundingClientRect()
        to.x = box.left + box.width / 2
        to.y = box.top + box.height / 2
        to.w = box.width + 10
        to.h = box.height + 10
        to.r = Math.max(8, Number.parseFloat(getComputedStyle(element).borderRadius) || 10) + 5
      } else {
        to.x = event.clientX
        to.y = event.clientY
        to.w = size
        to.h = size
        to.r = size / 2
      }

      if (element !== hovering) {
        hovering = element
        if (labels && labelRef.current) {
          const text = element?.dataset.aura ?? ''
          labelRef.current.textContent = text
          labelRef.current.style.opacity = text ? '1' : '0'
        }
        // Two cursors is one too many.
        document.body.style.cursor = element ? 'none' : ''
      }
    }

    const onLeave = () => {
      visible = false
      document.body.style.cursor = ''
    }

    const step = () => {
      at.x += (to.x - at.x) * ease
      at.y += (to.y - at.y) * ease
      at.w += (to.w - at.w) * ease
      at.h += (to.h - at.h) * ease
      at.r += (to.r - at.r) * ease

      aura.style.transform = `translate(${at.x - at.w / 2}px, ${at.y - at.h / 2}px)`
      aura.style.width = `${at.w}px`
      aura.style.height = `${at.h}px`
      aura.style.borderRadius = `${at.r}px`
      aura.style.opacity = visible ? '1' : '0'

      frame = requestAnimationFrame(step)
    }

    scope.addEventListener('pointermove', onMove as EventListener)
    scope.addEventListener('pointerleave', onLeave as EventListener)
    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      scope.removeEventListener('pointermove', onMove as EventListener)
      scope.removeEventListener('pointerleave', onLeave as EventListener)
      document.body.style.cursor = ''
    }
  }, [ease, labels, scopeRef, size, target])

  return (
    <div
      ref={auraRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed left-0 top-0 z-[var(--z-overlay)] grid place-items-center',
        'transition-opacity duration-[var(--duration-slow)]',
        invert ? 'mix-blend-difference' : 'mix-blend-multiply',
        className,
      )}
      style={{ background: invert ? '#ffffff' : color, opacity: 0 }}
    >
      {labels && (
        <span
          ref={labelRef}
          className="whitespace-nowrap px-2 text-[10px] font-bold uppercase tracking-wider text-ink opacity-0 transition-opacity duration-[var(--duration-fast)]"
        />
      )}
    </div>
  )
}
