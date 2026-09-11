'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface FlipBookProps {
  /** One node per page. Rendered two at a time, as a spread. */
  pages: ReactNode[]
  /** Accessible name. */
  label: string
  /** Current spread — 0 is pages one and two. Omit for uncontrolled. */
  spread?: number
  onSpreadChange?: (spread: number) => void
  /** Width of one page. The book is twice this. */
  width?: number
  /** Page height in pixels. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A book whose pages turn.
 *
 * A leaf has two faces and they are not the same page: the front of leaf two
 * is page three, its back is page four, and the back has to be mirrored so its
 * content reads correctly once it has swung over. `rotateY(180deg)` on the back
 * face is what does that, and forgetting it is why hand-rolled page turns show
 * mirror-writing halfway through.
 *
 * Every leaf is rendered at once and rotated to 0 or −180 degrees, so a turn is
 * one transform on one element and turning several quickly does not queue. The
 * z-index has to come from the leaf's distance to the current spread, or the
 * leaf being turned passes *behind* the ones it should be covering.
 *
 * The pages are real content in DOM order, so the whole book is readable
 * top to bottom by anything that ignores the transforms — which is what a
 * screen reader does.
 */
export function FlipBook({
  pages,
  label,
  spread,
  onSpreadChange,
  width = 300,
  height = 380,
  className,
}: FlipBookProps) {
  const [uncontrolled, setUncontrolled] = useState(0)
  // Two pages per leaf, and an odd count still needs its own leaf.
  const leaves = Math.ceil(pages.length / 2)
  const current = Math.min(leaves, Math.max(0, spread ?? uncontrolled))

  const go = (next: number) => {
    const clamped = Math.min(leaves, Math.max(0, next))
    if (spread === undefined) setUncontrolled(clamped)
    onSpreadChange?.(clamped)
  }

  const face = (index: number, back: boolean) => (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden bg-surface p-5',
        back ? 'rounded-l-[var(--radius-tile)]' : 'rounded-r-[var(--radius-tile)]',
      )}
      style={{
        backfaceVisibility: 'hidden',
        // The back has to be mirrored, or its content reads backwards.
        transform: back ? 'rotateY(180deg)' : undefined,
        boxShadow: back
          ? 'inset 8px 0 14px -10px rgba(20,27,15,0.4)'
          : 'inset -8px 0 14px -10px rgba(20,27,15,0.4)',
      }}
    >
      {pages[index] ?? (
        <Text size="caption" tone="faint">
          —
        </Text>
      )}
    </div>
  )

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div
        role="group"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            go(current + 1)
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            go(current - 1)
          }
        }}
        className="relative rounded-[var(--radius-card)] bg-app p-4 outline-offset-4"
        style={{ width: width * 2 + 32, height: height + 32, perspective: 1800 }}
      >
        {/* The spine side, always visible under the leaves. */}
        <div
          aria-hidden="true"
          className="absolute left-4 top-4 overflow-hidden rounded-l-[var(--radius-tile)] bg-surface-muted"
          style={{ width, height }}
        />

        <div
          className="absolute left-1/2 top-4"
          style={{ width, height, transformStyle: 'preserve-3d' }}
        >
          {Array.from({ length: leaves }, (_, leaf) => {
            const turned = leaf < current
            return (
              <div
                key={leaf}
                className="motion-safe-only absolute inset-0 origin-left"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: `rotateY(${turned ? -180 : 0}deg)`,
                  transition: 'transform 700ms cubic-bezier(0.4, 0.1, 0.2, 1)',
                  // Distance to the current spread, or a turning leaf slips
                  // behind the ones it should cover.
                  zIndex: turned ? leaf : leaves - leaf,
                }}
              >
                {face(leaf * 2 + 1, false)}
                {face(leaf * 2 + 2, true)}
              </div>
            )
          })}
        </div>

        {/* Page one never turns; it is the inside of the front cover. */}
        <div
          aria-hidden="true"
          className="absolute left-4 top-4 overflow-hidden rounded-l-[var(--radius-tile)] bg-surface p-5"
          style={{ width, height, boxShadow: 'inset 8px 0 14px -10px rgba(20,27,15,0.4)' }}
        >
          {pages[0]}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-surface-muted disabled:opacity-40"
        >
          Back
        </button>
        <Text as="span" size="caption" tone="faint" tabular>
          {current === 0 ? 'Cover' : `Pages ${current * 2} – ${current * 2 + 1}`}
        </Text>
        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={current >= leaves}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-surface-muted disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <VisuallyHidden>
        <ol>
          {pages.map((page, index) => (
            <li key={index}>{page}</li>
          ))}
        </ol>
      </VisuallyHidden>
    </div>
  )
}
