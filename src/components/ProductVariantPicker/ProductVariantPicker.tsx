'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

export interface ProductVariantPickerChoice {
  /** Stored in the selection and matched against variants. */
  value: string
  /** Shown to the shopper. Defaults to `value`. */
  label?: string
  /** A CSS colour — draws the choice as a swatch instead of a chip. */
  swatch?: string
}

export interface ProductVariantPickerOption {
  /** Key in the selection and in each variant’s `options`: `size`. */
  name: string
  /** Heading of the group: `Size`. */
  label: string
  values: ProductVariantPickerChoice[]
}

export interface ProductVariantPickerVariant {
  sku: string
  /** One value per option name: `{ size: 'M', colour: 'sage' }`. */
  options: Record<string, string>
  price: number
  /** Units available. 0 is out of stock. */
  stock: number
}

export interface ProductVariantPickerProps {
  /** The option groups, in the order they are shown. */
  options: ProductVariantPickerOption[]
  /** Every SKU that exists. A combination missing from this list is not made. */
  variants: ProductVariantPickerVariant[]
  /** Controlled selection, by option name. */
  value?: Record<string, string>
  /** Starting selection when uncontrolled. */
  defaultValue?: Record<string, string>
  /** Called with the selection, and the variant once every group has a value. */
  onValueChange?: (selection: Record<string, string>, variant: ProductVariantPickerVariant | null) => void
  /** ISO 4217 code for the price. */
  currency?: string
  /** At or under this many units, the stock line says how many are left. */
  lowStock?: number
  /** Merged last, so it wins. */
  className?: string
}

type Availability = { ok: true } | { ok: false; reason: string; kind: 'unmade' | 'stock' }

const matches = (variant: ProductVariantPickerVariant, selection: Record<string, string>) => Object.entries(selection).every(([key, value]) => variant.options[key] === value)

/**
 * Size, colour and material chosen one group at a time, checked against the
 * SKUs that actually exist — for any product sold in combinations where not
 * every combination is made, or in stock.
 *
 * An option that cannot make an available SKU with what is already chosen is
 * disabled, and says why, because the two reasons ask different things of the
 * shopper: “Not made in Sage” means change the colour; “Out of stock” means
 * this one is gone. Each group is a radio group — one tab stop, arrows move and
 * choose — and the matching variant, its price and its stock are announced as
 * soon as the selection is complete.
 */
export function ProductVariantPicker({
  options,
  variants,
  value,
  defaultValue = {},
  onValueChange,
  currency = 'GBP',
  lowStock = 5,
  className,
}: ProductVariantPickerProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const selection = value ?? uncontrolled
  const [announcement, setAnnouncement] = useState('')
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const labelOf = (name: string, v: string) => options.find((o) => o.name === name)?.values.find((c) => c.value === v)?.label ?? v
  const variantFor = (next: Record<string, string>) => (options.every((o) => next[o.name]) ? (variants.find((variant) => matches(variant, next)) ?? null) : null)
  const price = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n)

  const availability = (name: string, choice: string): Availability => {
    const candidate = { ...selection, [name]: choice }
    const found = variants.filter((variant) => matches(variant, candidate))
    if (found.some((variant) => variant.stock > 0)) return { ok: true }
    const others = Object.keys(selection).filter((key) => key !== name && selection[key])
    if (found.length > 0) {
      const where = others.map((key) => labelOf(key, selection[key])).join(', ')
      return { ok: false, kind: 'stock', reason: where ? `Out of stock in ${where}` : 'Out of stock' }
    }
    // Which earlier choice rules it out? Name the one whose removal would make it exist.
    const blocker = others.find((key) => {
      const rest = { ...candidate }
      delete rest[key]
      return variants.some((variant) => matches(variant, rest))
    })
    return { ok: false, kind: 'unmade', reason: blocker ? `Not made in ${labelOf(blocker, selection[blocker])}` : 'Not made' }
  }

  const choose = (name: string, choice: string) => {
    const next = { ...selection, [name]: choice }
    if (value === undefined) setUncontrolled(next)
    const variant = variantFor(next)
    onValueChange?.(next, variant)
    const summary = options.map((o) => next[o.name] && labelOf(o.name, next[o.name])).filter(Boolean).join(', ')
    setAnnouncement(variant ? `${summary}: ${price(variant.price)}, ${variant.stock <= lowStock ? `only ${variant.stock} left` : 'in stock'}.` : `${summary} chosen.`)
  }

  const clear = () => {
    if (value === undefined) setUncontrolled({})
    onValueChange?.({}, null)
    setAnnouncement('Selection cleared.')
  }

  const onKeyDown = (option: ProductVariantPickerOption, open: string[]) => (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    // Move from the focused option, which is the selected one unless nothing is selected yet.
    const at = open.indexOf((event.target as HTMLElement).dataset.value ?? selection[option.name])
    let target: string | undefined
    if (step) target = open[(Math.max(at, step > 0 ? -1 : 0) + step + open.length) % open.length]
    else if (event.key === 'Home') target = open[0]
    else if (event.key === 'End') target = open[open.length - 1]
    if (target === undefined) return
    event.preventDefault()
    choose(option.name, target)
    refs.current[`${option.name}:${target}`]?.focus()
  }

  const variant = variantFor(selection)
  const missing = options.filter((o) => !selection[o.name])

  return (
    <div className={cn('flex w-full flex-col gap-5', className)}>
      {options.map((option) => {
        const states = option.values.map((choice) => ({ choice, state: availability(option.name, choice.value) }))
        const open = states.filter((s) => s.state.ok).map((s) => s.choice.value)
        const tabStop = open.includes(selection[option.name]) ? selection[option.name] : (open[0] ?? option.values[0]?.value)
        const blocked = states.filter((s) => !s.state.ok)
        const headingId = `${uid}-${option.name}`
        return (
          <div key={option.name} className="flex flex-col gap-2">
            <div id={headingId} className="flex items-baseline gap-1.5 text-[13px] font-bold text-ink">
              {option.label}
              {selection[option.name] && <span className="font-medium text-ink-soft">{labelOf(option.name, selection[option.name])}</span>}
            </div>
            <div role="radiogroup" aria-labelledby={headingId} onKeyDown={onKeyDown(option, open)} className="flex flex-wrap gap-2">
              {states.map(({ choice, state }) => {
                const checked = selection[option.name] === choice.value
                const label = choice.label ?? choice.value
                const reasonId = `${headingId}-${choice.value}-why`
                return (
                  <button
                    key={choice.value}
                    ref={(node) => {
                      refs.current[`${option.name}:${choice.value}`] = node
                    }}
                    type="button"
                    data-value={choice.value}
                    role="radio"
                    aria-checked={checked}
                    aria-label={choice.swatch ? label : undefined}
                    aria-disabled={!state.ok || undefined}
                    aria-describedby={state.ok ? undefined : reasonId}
                    tabIndex={choice.value === tabStop ? 0 : -1}
                    title={state.ok ? label : `${label} — ${state.reason}`}
                    onClick={() => state.ok && choose(option.name, choice.value)}
                    className={cn(
                      'relative flex items-center justify-center overflow-hidden border text-[13px] font-semibold transition-colors',
                      choice.swatch ? 'size-9 rounded-full p-0.5' : 'h-9 min-w-11 rounded-[var(--radius-10)] px-3',
                      checked ? 'border-ink ring-1 ring-ink' : 'border-line-strong hover:border-ink-faint',
                      !choice.swatch && (checked ? 'bg-surface-muted text-ink' : 'bg-surface text-ink-soft'),
                      !state.ok && 'cursor-not-allowed opacity-50 hover:border-line-strong',
                      !state.ok && state.kind === 'stock' && 'border-dashed',
                    )}
                  >
                    {choice.swatch ? <span aria-hidden="true" style={{ background: choice.swatch }} className="size-full rounded-full" /> : <span className={cn(!state.ok && state.kind === 'stock' && 'line-through')}>{label}</span>}
                    {!state.ok && state.kind === 'unmade' && (
                      <svg aria-hidden="true" viewBox="0 0 10 10" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full text-ink-faint">
                        <line x1="0" y1="10" x2="10" y2="0" stroke="currentColor" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
                      </svg>
                    )}
                    {!state.ok && (
                      <span id={reasonId} className="sr-only">
                        {state.reason}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {blocked.length > 0 && (
              <p className="text-[12px] font-medium text-ink-faint">
                {blocked.map(({ choice, state }) => `${choice.label ?? choice.value}: ${(state as { reason: string }).reason.replace(/^./, (c) => c.toLowerCase())}`).join(' · ')}
              </p>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-tile)] border border-line bg-surface-sunken px-4 py-3">
        {variant ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[18px] font-extrabold tabular-nums text-ink">{price(variant.price)}</span>
            <span className="text-[12px] font-medium text-ink-faint">
              <span className={cn('font-semibold', variant.stock <= lowStock ? 'text-danger' : 'text-success')}>{variant.stock <= lowStock ? `Only ${variant.stock} left` : 'In stock'}</span> · SKU <span className="font-mono">{variant.sku}</span>
            </span>
          </div>
        ) : (
          <span className="text-[13px] font-medium text-ink-soft">
            {missing.length > 0 ? `Choose ${missing.map((o) => o.label.toLowerCase()).join(' and ')} to see the price.` : 'That combination is not available.'}
          </span>
        )}
        {Object.keys(selection).length > 0 && (
          <button type="button" onClick={clear} className="text-[12px] font-semibold text-ink-soft underline underline-offset-2 hover:text-ink">
            Clear selection
          </button>
        )}
      </div>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
