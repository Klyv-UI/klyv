'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { Text } from '../Text'
import { Popover } from '../Popover'

export interface ColorPickerProps {
  /** Hex colour, including the leading hash. */
  value: string
  onValueChange: (value: string) => void
  /** Accessible name. */
  label: string
  /** Named colours offered as swatches. Defaults to the design system palette. */
  swatches?: { value: string; label: string }[]
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Overrides the generated id. Useful when a label lives elsewhere. */
  id?: string
  /** Merged last, so it wins. */
  className?: string
}

const TOKEN_SWATCHES = [
  { value: '#c8f24e', label: 'Accent' },
  { value: '#b9e93a', label: 'Accent strong' },
  { value: '#e6fbb0', label: 'Accent soft' },
  { value: '#3f9b4a', label: 'Success' },
  { value: '#f5a524', label: 'Warning' },
  { value: '#e5484d', label: 'Danger' },
  { value: '#17191c', label: 'Ink' },
  { value: '#74797d', label: 'Ink soft' },
  { value: '#9ca1a5', label: 'Ink faint' },
  { value: '#e3e5e3', label: 'Line strong' },
  { value: '#f4f5f5', label: 'Surface muted' },
  { value: '#ffffff', label: 'Surface' },
]

/**
 * Colour selection from the design system palette, with a native picker and a
 * hex field for anything outside it.
 *
 * Swatches come first deliberately: in a product built on tokens, most colour
 * choices should be a token, and an unconstrained wheel invites values that do
 * not belong to the system. Every swatch is named, so colour is never the only
 * way to tell them apart.
 */
export function ColorPicker({
  value,
  onValueChange,
  label,
  swatches = TOKEN_SWATCHES,
  disabled = false,
  id,
  className,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const current = swatches.find((swatch) => swatch.value.toLowerCase() === value.toLowerCase())

  return (
    <Popover
      open={open}
      onOpenChange={(next) => !disabled && setOpen(next)}
      placement="bottom"
      align="start"
      label={label}
      className="w-[236px] p-3"
      trigger={
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}: ${current?.label ?? value}`}
          className={cn(
            'inline-flex h-10 items-center gap-2.5 rounded-full border border-line bg-surface pl-1.5 pr-3.5',
            'text-[13px] font-bold text-ink transition-colors hover:border-line-strong',
            'disabled:pointer-events-none disabled:opacity-40',
            className,
          )}
        >
          <span
            aria-hidden="true"
            className="size-7 shrink-0 rounded-full border border-line"
            style={{ background: value }}
          />
          <span className="tabular">{current?.label ?? value.toUpperCase()}</span>
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <Text size="caption" weight="bold" tone="faint" className="mb-1.5 uppercase tracking-wider">
            Palette
          </Text>
          <div role="group" aria-label="Palette" className="grid grid-cols-6 gap-1.5">
            {swatches.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                title={swatch.label}
                aria-label={swatch.label}
                aria-pressed={swatch.value.toLowerCase() === value.toLowerCase()}
                onClick={() => onValueChange(swatch.value)}
                className={cn(
                  'size-7 rounded-full border transition-transform hover:scale-110',
                  swatch.value.toLowerCase() === value.toLowerCase()
                    ? 'border-ink ring-2 ring-accent-strong ring-offset-1'
                    : 'border-line',
                )}
                style={{ background: swatch.value }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-line pt-3">
          <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-[var(--radius-glyph)] border border-line">
            <span className="sr-only">Pick any colour</span>
            <input
              type="color"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              className="absolute -inset-2 size-[calc(100%+16px)] cursor-pointer border-0 p-0"
            />
          </label>
          <Input
            inputSize="sm"
            aria-label={`${label} hex value`}
            value={value.toUpperCase()}
            onChange={(event) => {
              const next = event.target.value
              if (/^#[0-9a-fA-F]{0,6}$/.test(next)) onValueChange(next)
            }}
            containerClassName="min-w-0 flex-1"
            className="tabular font-mono"
          />
        </div>
      </div>
    </Popover>
  )
}
