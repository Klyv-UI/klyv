'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Textarea } from '../Textarea'
import { VisuallyHidden } from '../VisuallyHidden'
import { CrossIcon } from '../internal/icons'

export interface ImageAnnotatorPin {
  id: string
  /** Horizontal position, as a percentage of the image width. */
  x: number
  /** Vertical position, as a percentage of the image height. */
  y: number
  note: string
}

export interface ImageAnnotatorProps {
  src: string
  /** Describes the image itself. */
  alt: string
  /** Controlled pins. */
  value?: ImageAnnotatorPin[]
  /** Starting pins when uncontrolled. */
  defaultValue?: ImageAnnotatorPin[]
  /** Called with every pin after one is added, moved, edited or deleted. */
  onValueChange?: (pins: ImageAnnotatorPin[]) => void
  /** Show pins and notes without letting them change. */
  readOnly?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10

/**
 * Numbered pins on a screenshot or a photo, each with a note beside it — for
 * design review, bug reports, site inspections.
 *
 * Positions are stored as percentages, so a pin stays on the button it points
 * at whatever size the image is drawn at, and the same data renders on a phone
 * and on a wall screen.
 *
 * Placing a pin does not need a mouse. With the image focused, arrows move a
 * crosshair (Shift for bigger steps) and Enter drops a pin there; a focused pin
 * moves with the arrows and Delete removes it. The notes are ordinary text
 * fields in a list, numbered to match, and selecting either side highlights the
 * other.
 */
export function ImageAnnotator({
  src,
  alt,
  value,
  defaultValue = [],
  onValueChange,
  readOnly = false,
  className,
}: ImageAnnotatorProps) {
  const [own, setOwn] = useState(defaultValue)
  const pins = value ?? own
  const [selected, setSelected] = useState<string | null>(null)
  const [cross, setCross] = useState({ x: 50, y: 50 })
  const [surfaceFocused, setSurfaceFocused] = useState(false)
  const [message, setMessage] = useState('')
  const surface = useRef<HTMLDivElement>(null)
  const notes = useRef(new Map<string, HTMLTextAreaElement | null>())
  const items = useRef(new Map<string, HTMLLIElement | null>())
  const pendingFocus = useRef<string | null>(null)
  const counter = useRef(0)
  const hintId = useId()

  const commit = (next: ImageAnnotatorPin[]) => {
    if (value === undefined) setOwn(next)
    onValueChange?.(next)
  }

  useEffect(() => {
    if (!pendingFocus.current) return
    notes.current.get(pendingFocus.current)?.focus()
    pendingFocus.current = null
  }, [pins])

  useEffect(() => {
    if (selected) items.current.get(selected)?.scrollIntoView?.({ block: 'nearest' })
  }, [selected])

  const add = (x: number, y: number) => {
    counter.current += 1
    const pin = { id: `pin-${Date.now().toString(36)}-${counter.current}`, x: clamp(x), y: clamp(y), note: '' }
    pendingFocus.current = pin.id
    setSelected(pin.id)
    commit([...pins, pin])
    setMessage(`Pin ${pins.length + 1} added. Write its note.`)
  }

  const remove = (id: string) => {
    const index = pins.findIndex((pin) => pin.id === id)
    commit(pins.filter((pin) => pin.id !== id))
    if (selected === id) setSelected(null)
    setMessage(`Pin ${index + 1} deleted.`)
    surface.current?.focus()
  }

  const update = (id: string, patch: Partial<ImageAnnotatorPin>) =>
    commit(pins.map((pin) => (pin.id === id ? { ...pin, ...patch } : pin)))

  const arrows = (event: KeyboardEvent, from: { x: number; y: number }) => {
    const step = event.shiftKey ? 10 : 1
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (!move) return null
    event.preventDefault()
    return { x: clamp(from.x + move[0]), y: clamp(from.y + move[1]) }
  }

  const onSurfaceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || event.target !== event.currentTarget) return
    const next = arrows(event, cross)
    if (next) return setCross(next)
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      add(cross.x, cross.y)
    }
  }

  const onSurfaceClick = (event: MouseEvent<HTMLDivElement>) => {
    if (readOnly || (event.target as HTMLElement).closest('button')) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    add(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100)
  }

  return (
    <div className={cn('grid w-full gap-4 md:grid-cols-[minmax(0,1fr)_260px]', className)}>
      <div
        ref={surface}
        role="application"
        aria-label={readOnly ? `${alt}, annotated` : `Annotate: ${alt}`}
        aria-describedby={readOnly ? undefined : hintId}
        tabIndex={0}
        onKeyDown={onSurfaceKeyDown}
        onClick={onSurfaceClick}
        onFocus={(event) => event.target === event.currentTarget && setSurfaceFocused(true)}
        onBlur={() => setSurfaceFocused(false)}
        className={cn(
          'relative self-start overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken',
          'focus-visible:outline-2 focus-visible:outline-offset-2',
          !readOnly && 'cursor-crosshair',
        )}
      >
        <img src={src} alt={alt} draggable={false} className="block h-auto w-full select-none" />

        {surfaceFocused && !readOnly && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="absolute inset-y-0 w-px bg-ink/60" style={{ left: `${cross.x}%` }} />
            <span className="absolute inset-x-0 h-px bg-ink/60" style={{ top: `${cross.y}%` }} />
            <span
              className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface/60"
              style={{ left: `${cross.x}%`, top: `${cross.y}%` }}
            />
          </span>
        )}

        {pins.map((pin, index) => {
          const isSelected = pin.id === selected
          return (
            <button
              key={pin.id}
              type="button"
              aria-label={`Pin ${index + 1}${pin.note ? `: ${pin.note}` : ''}`}
              aria-pressed={isSelected}
              onClick={() => setSelected(isSelected ? null : pin.id)}
              onKeyDown={(event) => {
                if (readOnly) return
                const next = arrows(event, pin)
                if (next) return update(pin.id, next)
                if (event.key === 'Delete' || event.key === 'Backspace') {
                  event.preventDefault()
                  remove(pin.id)
                }
              }}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              className={cn(
                'absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[12px] font-extrabold shadow-[var(--shadow-float)] transition-transform motion-reduce:transition-none',
                isSelected ? 'z-[var(--z-raised)] scale-110 border-accent-ink bg-accent text-accent-ink' : 'border-surface bg-ink text-ink-inverse',
              )}
            >
              {index + 1}
            </button>
          )
        })}
        {!readOnly && (
          <VisuallyHidden>
            <span id={hintId}>Click to add a pin, or use the arrow keys to move the crosshair and press Enter. Focus a pin and use the arrow keys to move it, or Delete to remove it.</span>
          </VisuallyHidden>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <span className="text-[13px] font-bold text-ink">Notes</span>
          <span className="text-[12px] font-medium tabular-nums text-ink-faint">{pins.length}</span>
        </div>
        {pins.length === 0 ? (
          <p className="rounded-[var(--radius-tile)] border border-dashed border-line-strong px-3 py-6 text-center text-[12px] font-medium text-ink-faint">
            {readOnly ? 'No notes on this image.' : 'Click the image to leave the first note.'}
          </p>
        ) : (
          <ol aria-label="Notes" className="flex flex-col gap-1.5">
            {pins.map((pin, index) => {
              const isSelected = pin.id === selected
              return (
                <li
                  key={pin.id}
                  ref={(node) => {
                    items.current.set(pin.id, node)
                  }}
                  className={cn(
                    'flex items-start gap-2 rounded-[var(--radius-tile)] border p-2 transition-colors',
                    isSelected ? 'border-accent-strong bg-accent-soft' : 'border-line bg-surface',
                  )}
                >
                  <button
                    type="button"
                    aria-label={`Select pin ${index + 1}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelected(isSelected ? null : pin.id)}
                    className={cn(
                      'mt-1 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold',
                      isSelected ? 'bg-accent text-accent-ink' : 'bg-ink text-ink-inverse',
                    )}
                  >
                    {index + 1}
                  </button>
                  {readOnly ? (
                    <p className="min-w-0 flex-1 py-1 text-[13px] font-medium text-ink">{pin.note || 'No note'}</p>
                  ) : (
                    <Textarea
                      ref={(node) => {
                        notes.current.set(pin.id, node)
                      }}
                      aria-label={`Note for pin ${index + 1}`}
                      rows={2}
                      resize="none"
                      value={pin.note}
                      placeholder="What should change here?"
                      onFocus={() => setSelected(pin.id)}
                      onChange={(event) => update(pin.id, { note: event.target.value })}
                      className="min-h-0 flex-1 rounded-[10px] px-2.5 py-1.5"
                    />
                  )}
                  {!readOnly && (
                    <IconButton icon={CrossIcon} label={`Delete pin ${index + 1}`} size="xs" tone="bare" onClick={() => remove(pin.id)} />
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {message}
        </span>
      </VisuallyHidden>
    </div>
  )
}
