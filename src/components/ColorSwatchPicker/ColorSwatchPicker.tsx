'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { readableInk } from '../../lib/contrast'
import { CheckIcon, PlusIcon } from '../internal/icons'

export interface ColorSwatchPickerSwatch {
  /** A hex colour. Anything CSS accepts will paint, but only hex gets contrast-aware ink. */
  value: string
  /** What the colour is called — announced, and shown under the swatches. */
  name: string
  disabled?: boolean
}

export type ColorSwatchPickerSize = 'sm' | 'md'

export interface ColorSwatchPickerProps {
  /** The palette, in order. */
  swatches: ColorSwatchPickerSwatch[]
  /** Controlled colour value. */
  value?: string
  /** Starting colour when uncontrolled. */
  defaultValue?: string
  /** Called with the colour, and the swatch it came from — undefined for a custom colour. */
  onValueChange?: (value: string, swatch?: ColorSwatchPickerSwatch) => void
  /** Accessible name for the radio group. */
  label: string
  /** Offer a native colour input after the palette. */
  allowCustom?: boolean
  /** Name for the custom colour control. */
  customLabel?: string
  /** Show the chosen colour’s name under the swatches. */
  showName?: boolean
  /** Swatches per row. Up and Down move by a row. Omit to wrap freely and step by one. */
  columns?: number
  /** 24px or 32px swatches. */
  size?: ColorSwatchPickerSize
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const SIZES: Record<ColorSwatchPickerSize, string> = { sm: 'size-6', md: 'size-8' }
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const inkFor = (colour: string) => (HEX.test(colour) ? readableInk(colour) : undefined)
const same = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase())

/**
 * One colour from a named palette — a label colour, a calendar colour, a team
 * avatar.
 *
 * A free colour picker is the wrong control when the product only wants eight
 * colours that work in both themes. This is a radio group: one tab stop, arrow
 * keys move and choose, and every swatch is announced by its name, because
 * “Moss” can be heard and a hex code cannot. The tick on the chosen swatch
 * takes black or white ink from the swatch’s own contrast, so it stays visible
 * on a pale yellow and a deep navy alike.
 *
 * The palette arrives as data. The component holds no colours of its own.
 */
export function ColorSwatchPicker({
  swatches,
  value,
  defaultValue,
  onValueChange,
  label,
  allowCustom = false,
  customLabel = 'Custom colour',
  showName = true,
  columns,
  size = 'md',
  disabled = false,
  className,
}: ColorSwatchPickerProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const current = value ?? uncontrolled
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = swatches.findIndex((swatch) => same(swatch.value, current))
  const custom = current !== undefined && selectedIndex === -1
  const firstEnabled = swatches.findIndex((swatch) => !swatch.disabled)
  const tabStop = selectedIndex >= 0 ? selectedIndex : firstEnabled

  const choose = (next: string, swatch?: ColorSwatchPickerSwatch) => {
    if (disabled || swatch?.disabled) return
    if (value === undefined) setUncontrolled(next)
    if (!same(next, current)) onValueChange?.(next, swatch)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const row = columns ?? 1
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: row,
      ArrowLeft: -1,
      ArrowUp: -row,
    }
    let target: number | undefined
    if (event.key in steps) {
      const step = steps[event.key]
      target = index
      // Skip disabled swatches, wrapping round like native radios.
      for (let tries = 0; tries < swatches.length; tries += 1) {
        target = (target + step + swatches.length) % swatches.length
        if (!swatches[target].disabled) break
      }
    } else if (event.key === 'Home') target = firstEnabled
    else if (event.key === 'End') target = swatches.length - 1 - [...swatches].reverse().findIndex((swatch) => !swatch.disabled)
    if (target === undefined || target < 0) return
    event.preventDefault()
    choose(swatches[target].value, swatches[target])
    refs.current[target]?.focus()
  }

  // The native input only takes six-digit hex, and switching it between controlled and not warns — so it
  // always gets one: the custom colour, else the first swatch that is hex.
  const hexOf = (colour?: string) => (colour && HEX.test(colour) ? (colour.length === 4 ? colour.replace(/([0-9a-f])/gi, '$1$1') : colour).toLowerCase() : undefined)
  const pickerValue = (custom && hexOf(current)) || hexOf(swatches.find((swatch) => HEX.test(swatch.value))?.value)

  const name = custom ? `${customLabel} ${current}` : swatches[selectedIndex]?.name

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-40', className)}>
      <div
        role="radiogroup"
        aria-label={label}
        aria-disabled={disabled || undefined}
        className={cn('gap-2', columns ? 'grid w-max' : 'flex flex-wrap items-center')}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, max-content)` } : undefined}
      >
        {swatches.map((swatch, index) => {
          const checked = index === selectedIndex
          return (
            <button
              key={`${swatch.value}-${swatch.name}`}
              ref={(node) => {
                refs.current[index] = node
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={swatch.name}
              title={swatch.name}
              disabled={disabled || swatch.disabled}
              tabIndex={index === tabStop ? 0 : -1}
              onClick={() => choose(swatch.value, swatch)}
              onKeyDown={(event) => onKeyDown(event, index)}
              style={{ background: swatch.value, color: inkFor(swatch.value) }}
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-ink)_14%,transparent)] transition-transform',
                'hover:scale-110 motion-reduce:hover:scale-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100',
                checked && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
                SIZES[size],
              )}
            >
              {checked && <CheckIcon size={size === 'sm' ? 12 : 15} strokeWidth={2.75} />}
            </button>
          )
        })}
      </div>

      {allowCustom && (
        <label
          className={cn(
            'relative inline-flex w-max cursor-pointer items-center gap-2 rounded-full text-[12px] font-semibold text-ink-soft',
            'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus has-[input:focus-visible]:outline-solid',
          )}
        >
          <span
            aria-hidden="true"
            style={custom ? { background: current, color: inkFor(current!) } : undefined}
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full',
              custom ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'border border-dashed border-line-strong text-ink-faint',
              SIZES[size],
            )}
          >
            {custom ? <CheckIcon size={size === 'sm' ? 12 : 15} strokeWidth={2.75} /> : <PlusIcon size={14} />}
          </span>
          {customLabel}
          <input
            type="color"
            disabled={disabled}
            aria-describedby={showName ? `${uid}-name` : undefined}
            value={pickerValue}
            onChange={(event) => choose(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      )}

      {showName && (
        <p id={`${uid}-name`} aria-live="polite" className="text-[12px] font-medium text-ink-faint">
          {name ?? 'None chosen'}
        </p>
      )}
    </div>
  )
}
