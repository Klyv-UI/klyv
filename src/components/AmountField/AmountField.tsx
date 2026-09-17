'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Input } from '../Input'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Select, type SelectOption } from '../Select'

export interface CurrencyOption {
  code: string
  symbol: string
  leading?: ReactNode
}

export interface AmountFieldProps {
  /** Raw text, so a partially typed number is preserved while editing. */
  value: string
  onValueChange: (value: string) => void
  /** Currently selected currency code. */
  currency: string
  onCurrencyChange?: (code: string) => void
  currencies: CurrencyOption[]
  /** Visible label above the amount. */
  label: string
  /** Render the amount as text rather than an input — the converted side. */
  readOnly?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The Exchange Money field: a label, a large amount on a filled surface, and a
 * currency picker on the right.
 *
 * The value is a string on purpose. Parsing to a number on every keystroke
 * destroys a half-typed decimal, so the caller parses when it needs a number.
 */
export function AmountField({
  value,
  onValueChange,
  currency,
  onCurrencyChange,
  currencies,
  label,
  readOnly = false,
  disabled = false,
  className,
}: AmountFieldProps) {
  const id = useId()
  const active = currencies.find((entry) => entry.code === currency) ?? currencies[0]
  const options: SelectOption[] = currencies.map((entry) => ({
    value: entry.code,
    label: entry.code,
    leading: entry.leading,
  }))

  return (
    <Surface
      variant="field"
      padding="md"
      className={cn('flex-row items-center justify-between gap-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus', disabled && 'opacity-40', className)}
    >
      <div className="min-w-0 flex-1">
        <Text as="label" size="caption" tone="faint" htmlFor={readOnly ? undefined : id}>
          {label}
        </Text>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <Text as="span" size="amount">
            {active?.symbol}
          </Text>
          {readOnly ? (
            <Text size="amount" tabular truncate>
              {value}
            </Text>
          ) : (
            <Input
              id={id}
              variant="bare"
              inputMode="decimal"
              value={value}
              disabled={disabled}
              onChange={(event) => onValueChange(event.target.value.replace(/[^\d.,]/g, ''))}
              containerClassName="min-w-0 flex-1"
              className="tabular text-[22px] font-extrabold leading-none tracking-[-0.02em]"
            />
          )}
        </div>
      </div>
      {onCurrencyChange && (
        <Select
          options={options}
          value={currency}
          onValueChange={onCurrencyChange}
          label={`Currency for ${label.toLowerCase()}`}
          variant="pill"
          size="sm"
          disabled={disabled}
        />
      )}
    </Surface>
  )
}
