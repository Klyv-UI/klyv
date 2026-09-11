'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface StackLayer {
  id: string
  label: string
  description?: string
  /** Anything drawn on the plate — a count, a row of tags, a mini diagram. */
  detail?: ReactNode
  /** Highlight this plate, for the layer being explained. */
  accent?: boolean
}

export interface LayerStackProps {
  /** Bottom of the stack first, so the array reads like the diagram. */
  layers: StackLayer[]
  /** Accessible name for the diagram. */
  label: string
  /** Vertical gap between plates, in pixels. */
  separation?: number
  /** Extra lift the selected plate takes, in pixels. */
  lift?: number
  /** Plate width in pixels. */
  width?: number
  /** Selected layer id. Omit for uncontrolled. */
  value?: string
  onValueChange?: (id: string) => void
  /** Merged last, so it wins. */
  className?: string
}

/**
 * An exploded isometric stack — one plate per layer, the selected one lifted
 * clear of the rest.
 *
 * The isometry is two rotations on a shared parent (`rotateX` then `rotateZ`)
 * rather than a per-plate skew, so the plates stay coplanar and parallel edges
 * stay parallel. Skewing each one separately is the usual shortcut and it
 * makes the stack visibly wrong at the corners.
 *
 * Plates are buttons in a radiogroup, in bottom-to-top order: the whole
 * diagram is one tab stop, arrow keys move between layers, and every plate's
 * label and description are real text sitting on it — so the thing that
 * explains an architecture is not, itself, a picture.
 */
export function LayerStack({
  layers,
  label,
  separation = 58,
  lift = 26,
  width = 300,
  value,
  onValueChange,
  className,
}: LayerStackProps) {
  const [uncontrolled, setUncontrolled] = useState<string | null>(null)
  const selected = value ?? uncontrolled

  const select = (id: string) => {
    if (value === undefined) setUncontrolled(id)
    onValueChange?.(id)
  }

  const move = (from: number, step: number) => {
    const next = (from + step + layers.length) % layers.length
    select(layers[next].id)
  }

  // Room for every plate plus the lift, and the isometric depth of one plate.
  const height = separation * layers.length + lift + 90

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('relative grid place-items-center', className)}
      style={{ height, perspective: 1400 }}
    >
      <div
        className="relative"
        style={{
          width,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(56deg) rotateZ(-42deg)',
        }}
      >
        {layers.map((layer, index) => {
          const isSelected = layer.id === selected
          // Index 0 is the bottom plate, so later layers sit higher.
          const z = index * separation + (isSelected ? lift : 0)

          return (
            <button
              key={layer.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || (!selected && index === layers.length - 1) ? 0 : -1}
              onClick={() => select(layer.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
                  event.preventDefault()
                  move(index, 1)
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
                  event.preventDefault()
                  move(index, -1)
                }
              }}
              className={cn(
                'motion-safe-only absolute left-0 top-0 flex w-full flex-col items-start gap-1 rounded-[var(--radius-tile)] border p-4 text-left',
                'transition-[transform,box-shadow,border-color] duration-[var(--duration-slow)] ease-[cubic-bezier(0.32,0.72,0,1)]',
                isSelected
                  ? 'border-accent-strong bg-surface shadow-[var(--shadow-window)]'
                  : 'border-line bg-surface/95 shadow-[var(--shadow-float)] hover:border-line-strong',
                layer.accent && !isSelected && 'border-accent',
              )}
              style={{ transform: `translateZ(${z}px)` }}
            >
              <Text as="span" size="heading">
                {layer.label}
              </Text>
              {layer.description && (
                <Text as="span" size="caption" tone="soft" leading="normal">
                  {layer.description}
                </Text>
              )}
              {layer.detail}
            </button>
          )
        })}
      </div>
    </div>
  )
}
