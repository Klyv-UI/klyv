'use client'

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

export type CreditCardInputBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown'

export interface CreditCardInputValue {
  /** Card number, digits only. */
  number: string
  /** Expiry as `MMYY` digits. */
  expiry: string
  /** Security code, digits only. */
  cvc: string
}

export interface CreditCardInputStatus {
  brand: CreditCardInputBrand
  /** Right length for the brand and passes the Luhn check. */
  numberValid: boolean
  /** A real month, not in the past. */
  expiryValid: boolean
  /** Three digits, or four for Amex. */
  cvcValid: boolean
  /** All three are valid. */
  complete: boolean
}

const BRANDS: { brand: CreditCardInputBrand; test: RegExp; label: string }[] = [
  { brand: 'amex', test: /^3[47]/, label: 'Amex' },
  { brand: 'visa', test: /^4/, label: 'Visa' },
  { brand: 'mastercard', test: /^(5[1-5]|2[2-7])/, label: 'Mastercard' },
  { brand: 'discover', test: /^(6011|65|64[4-9])/, label: 'Discover' },
]

const EMPTY: CreditCardInputValue = { number: '', expiry: '', cvc: '' }

/** Identify the network from the leading digits. */
export function creditCardInputBrand(number: string): CreditCardInputBrand {
  return BRANDS.find((entry) => entry.test.test(number))?.brand ?? 'unknown'
}

/** The Luhn checksum every card number carries in its last digit. */
export function creditCardInputLuhn(number: string): boolean {
  let sum = 0
  for (let i = 0; i < number.length; i += 1) {
    let digit = Number(number[number.length - 1 - i])
    if (i % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2
    sum += digit
  }
  return number.length > 0 && sum % 10 === 0
}

const lengthFor = (brand: CreditCardInputBrand) => (brand === 'amex' ? 15 : 16)
const groupsFor = (brand: CreditCardInputBrand) => (brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4])
const digits = (text: string) => text.replace(/\D/g, '')

function groupNumber(number: string, brand: CreditCardInputBrand) {
  const parts: string[] = []
  let start = 0
  for (const size of groupsFor(brand)) {
    if (start >= number.length) break
    parts.push(number.slice(start, start + size))
    start += size
  }
  return parts.join(' ')
}

function status(value: CreditCardInputValue, now: Date): CreditCardInputStatus {
  const brand = creditCardInputBrand(value.number)
  const numberValid = value.number.length === lengthFor(brand) && creditCardInputLuhn(value.number)
  const month = Number(value.expiry.slice(0, 2))
  const year = 2000 + Number(value.expiry.slice(2))
  const expiryValid =
    value.expiry.length === 4 && month >= 1 && month <= 12 &&
    (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1))
  const cvcValid = value.cvc.length === (brand === 'amex' ? 4 : 3)
  return { brand, numberValid, expiryValid, cvcValid, complete: numberValid && expiryValid && cvcValid }
}

export interface CreditCardInputProps {
  /** Controlled number, expiry and CVC, as digits. */
  value?: CreditCardInputValue
  /** Starting value when uncontrolled. */
  defaultValue?: CreditCardInputValue
  /** Called on every edit with the digits and what they add up to. */
  onValueChange?: (value: CreditCardInputValue, status: CreditCardInputStatus) => void
  /** Accessible name for the group. */
  label?: string
  /** Marks the whole control invalid, on top of its own per-field checks. */
  invalid?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Forwarded to all three inputs. */
  required?: boolean
  /** Put on the card-number input, so a Field label points at it. */
  id?: string
  /** Forwarded to each input. Field sets it to its hint or error. */
  'aria-describedby'?: string
  /** Reference date for the expiry check. Defaults to now. */
  now?: Date
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Card number, expiry and security code as one control, because that is how
 * people read them off the card: in one go, left to right.
 *
 * Each part is still its own input with its own `cc-*` autocomplete token, so
 * browser and password-manager autofill land in the right place. Completing a
 * part moves on to the next and Backspace in an empty part moves back — the
 * typing never has to stop for the mouse. A number is only flagged once it is
 * long enough to judge, so nobody is told they are wrong halfway through.
 */
export function CreditCardInput({
  value,
  defaultValue = EMPTY,
  onValueChange,
  label = 'Card details',
  invalid = false,
  disabled = false,
  required,
  id,
  'aria-describedby': describedBy,
  now,
  className,
}: CreditCardInputProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const current = value ?? uncontrolled
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const state = status(current, now ?? new Date())
  const brandLabel = BRANDS.find((entry) => entry.brand === state.brand)?.label

  const update = (patch: Partial<CreditCardInputValue>) => {
    const next = { ...current, ...patch }
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next, status(next, now ?? new Date()))
    return next
  }

  const onNumber = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = digits(event.target.value)
    const next = update({ number: raw.slice(0, lengthFor(creditCardInputBrand(raw))) })
    if (status(next, now ?? new Date()).numberValid) refs[1].current?.focus()
  }

  const onExpiry = (event: ChangeEvent<HTMLInputElement>) => {
    let raw = digits(event.target.value)
    // A leading 2–9 can only be a single-digit month.
    if (/^[2-9]$/.test(raw)) raw = `0${raw}`
    const next = update({ expiry: raw.slice(0, 4) })
    if (next.expiry.length === 4) refs[2].current?.focus()
  }

  const onCvc = (event: ChangeEvent<HTMLInputElement>) => {
    update({ cvc: digits(event.target.value).slice(0, state.brand === 'amex' ? 4 : 3) })
  }

  const back = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    if (event.key !== 'Backspace' || input.selectionStart !== 0 || input.selectionEnd !== 0) return
    const previous = refs[index - 1]?.current
    if (!previous) return
    event.preventDefault()
    previous.focus()
    const end = previous.value.length
    previous.setSelectionRange(end, end)
  }

  const shownExpiry = current.expiry.length > 2 ? `${current.expiry.slice(0, 2)} / ${current.expiry.slice(2)}` : current.expiry
  const flag = {
    number: current.number.length >= lengthFor(state.brand) && !state.numberValid,
    expiry: current.expiry.length === 4 && !state.expiryValid,
  }
  const field = 'min-w-0 bg-transparent font-medium tabular-nums text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed'
  const shared = { disabled, required, inputMode: 'numeric' as const, 'aria-describedby': describedBy }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex h-10 w-full items-center gap-3 rounded-full border bg-surface px-4 text-[13px] transition-colors',
        'focus-within:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        invalid || flag.number || flag.expiry ? 'border-danger focus-within:border-danger' : 'border-line',
        disabled && 'opacity-40',
        className,
      )}
    >
      <CardGlyph brand={state.brand} />
      <input
        ref={refs[0]}
        id={id}
        aria-label="Card number"
        autoComplete="cc-number"
        placeholder="1234 1234 1234 1234"
        value={groupNumber(current.number, state.brand)}
        onChange={onNumber}
        aria-invalid={invalid || flag.number || undefined}
        className={cn(field, 'flex-1')}
        {...shared}
      />
      <input
        ref={refs[1]}
        aria-label="Expiry date, month and year"
        autoComplete="cc-exp"
        placeholder="MM / YY"
        value={shownExpiry}
        onChange={onExpiry}
        onKeyDown={back(1)}
        aria-invalid={invalid || flag.expiry || undefined}
        className={cn(field, 'w-[7ch] shrink-0')}
        {...shared}
      />
      <input
        ref={refs[2]}
        aria-label="Security code"
        autoComplete="cc-csc"
        placeholder={state.brand === 'amex' ? 'CVC (4)' : 'CVC'}
        value={current.cvc}
        onChange={onCvc}
        onKeyDown={back(2)}
        aria-invalid={invalid || undefined}
        className={cn(field, 'w-[6ch] shrink-0')}
        {...shared}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {brandLabel ? `${brandLabel} card` : ''}
      </span>
    </div>
  )
}

/** A card outline with the network's short name; neutral until one is recognised. */
function CardGlyph({ brand }: { brand: CreditCardInputBrand }) {
  const short = { visa: 'VISA', mastercard: 'MC', amex: 'AMEX', discover: 'DISC', unknown: '' }[brand]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-5 w-8 shrink-0 items-center justify-center rounded-[var(--radius-4)] border text-[8px] font-extrabold tracking-wide transition-colors',
        brand === 'unknown' ? 'border-line-strong text-ink-faint' : 'border-accent-strong bg-accent text-accent-ink',
      )}
    >
      {short || <span className="mt-1 h-0.5 w-full bg-line-strong" />}
    </span>
  )
}
