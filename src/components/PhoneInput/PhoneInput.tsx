'use client'

import { forwardRef, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { cn } from '../../lib/cn'
import { ChevronDownIcon } from '../internal/icons'

export interface PhoneInputCountry {
  /** ISO 3166-1 alpha-2 code, e.g. `GB`. Also draws the flag. */
  code: string
  /** Country name, read out by the dial-code select. */
  name: string
  /** Dial code without the plus, e.g. `44`. */
  dial: string
  /** National number mask; each `#` is one digit. Longer numbers run on unformatted. */
  format?: string
}

export type PhoneInputSize = 'sm' | 'md'

/** A small default set. Pass `countries` to replace it with your own markets. */
export const PHONE_INPUT_COUNTRIES: PhoneInputCountry[] = [
  { code: 'US', name: 'United States', dial: '1', format: '(###) ###-####' },
  { code: 'CA', name: 'Canada', dial: '1', format: '(###) ###-####' },
  { code: 'GB', name: 'United Kingdom', dial: '44', format: '#### ######' },
  { code: 'IE', name: 'Ireland', dial: '353', format: '## ### ####' },
  { code: 'AU', name: 'Australia', dial: '61', format: '### ### ###' },
  { code: 'NZ', name: 'New Zealand', dial: '64', format: '## ### ####' },
  { code: 'IN', name: 'India', dial: '91', format: '#####-#####' },
  { code: 'DE', name: 'Germany', dial: '49', format: '#### #######' },
  { code: 'FR', name: 'France', dial: '33', format: '# ## ## ## ##' },
  { code: 'ES', name: 'Spain', dial: '34', format: '### ## ## ##' },
  { code: 'IT', name: 'Italy', dial: '39', format: '### ### ####' },
  { code: 'NL', name: 'Netherlands', dial: '31', format: '# ########' },
  { code: 'SE', name: 'Sweden', dial: '46', format: '##-### ## ##' },
  { code: 'CH', name: 'Switzerland', dial: '41', format: '## ### ## ##' },
  { code: 'BR', name: 'Brazil', dial: '55', format: '(##) #####-####' },
  { code: 'MX', name: 'Mexico', dial: '52', format: '## #### ####' },
  { code: 'JP', name: 'Japan', dial: '81', format: '##-####-####' },
  { code: 'SG', name: 'Singapore', dial: '65', format: '#### ####' },
  { code: 'ZA', name: 'South Africa', dial: '27', format: '## ### ####' },
  { code: 'AE', name: 'United Arab Emirates', dial: '971', format: '## ### ####' },
]

const SIZES: Record<PhoneInputSize, string> = { sm: 'h-9 text-[12px]', md: 'h-10 text-[13px]' }

/** Regional-indicator pair for an ISO code — the flag, without shipping images. */
const flag = (code: string) =>
  String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

const digitsOf = (text: string) => text.replace(/\D/g, '')

function format(digits: string, mask?: string): string {
  if (!mask) return digits
  let out = ''
  let used = 0
  for (const char of mask) {
    if (used === digits.length) break
    if (char === '#') out += digits[used++]
    else out += char
  }
  return out + digits.slice(used)
}

/** Longest dial code that prefixes the number, preferring the country already chosen. */
function split(value: string, countries: PhoneInputCountry[], current?: PhoneInputCountry) {
  const digits = digitsOf(value)
  if (current && digits.startsWith(current.dial)) return { country: current, national: digits.slice(current.dial.length) }
  const match = [...countries].sort((a, b) => b.dial.length - a.dial.length).find((c) => digits.startsWith(c.dial))
  return match ? { country: match, national: digits.slice(match.dial.length) } : { country: current, national: digits }
}

export interface PhoneInputProps {
  /** Controlled number in E.164 form, e.g. `+442071838750`. Empty string when blank. */
  value?: string
  /** Starting number when uncontrolled. */
  defaultValue?: string
  /** Called with the E.164 string on every edit, and when the country changes. */
  onValueChange?: (value: string, country: PhoneInputCountry) => void
  /** Countries offered in the dial-code select. Defaults to `PHONE_INPUT_COUNTRIES`. */
  countries?: PhoneInputCountry[]
  /** ISO code selected when the value does not name a country. */
  defaultCountry?: string
  /** Accessible name for the number field. Field supplies a visible one through `id`. */
  label?: string
  /** Placeholder for the national number. Defaults to the country's mask. */
  placeholder?: string
  /** Control height: 36px or 40px. */
  size?: PhoneInputSize
  /** Marks the number invalid and reddens the border. Pair with a message. */
  invalid?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Forwarded to the number input. */
  required?: boolean
  /** Put on the number input, so a Field label points at it. */
  id?: string
  /** Forwarded to the number input. Field sets it to its hint or error. */
  'aria-describedby'?: string
  /** Form field name for the E.164 value, submitted through a hidden input. */
  name?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A phone number as a dial code plus a national number, stored as one E.164
 * string. The two halves are separate controls because they are separate
 * questions — which country, which number — but they share one border, so the
 * form reads them as one answer.
 *
 * The dial code is a native select: it is the one list every platform already
 * makes searchable and touch-friendly. The number formats as you type and keeps
 * the caret beside the digit you just typed, not at the end.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  {
    value,
    defaultValue = '',
    onValueChange,
    countries = PHONE_INPUT_COUNTRIES,
    defaultCountry = 'US',
    label = 'Phone number',
    placeholder,
    size = 'md',
    invalid = false,
    disabled = false,
    required,
    id,
    'aria-describedby': describedBy,
    name,
    className,
  },
  ref,
) {
  const fallback = countries.find((c) => c.code === defaultCountry) ?? countries[0]
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const current = value ?? uncontrolled
  const [chosen, setChosen] = useState<PhoneInputCountry>(() => split(current, countries, fallback).country ?? fallback)
  const { country = fallback, national } = split(current, countries, chosen)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const caret = useRef<number | null>(null)

  const commit = (nextCountry: PhoneInputCountry, digits: string) => {
    const next = digits ? `+${nextCountry.dial}${digits}` : ''
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next, nextCountry)
  }

  const onNumber = (event: ChangeEvent<HTMLInputElement>) => {
    const { value: raw, selectionStart } = event.target
    // E.164 caps a number at 15 digits, dial code included.
    const digits = digitsOf(raw).slice(0, 15 - country.dial.length)
    // Remember how many digits sat before the caret; the layout effect puts it
    // back after the same digit once the mask has added its punctuation.
    caret.current = digitsOf(raw.slice(0, selectionStart ?? raw.length)).length
    commit(country, digits)
  }

  const shown = format(national, country.format)

  useLayoutEffect(() => {
    const input = inputRef.current
    const before = caret.current
    if (!input || before === null || document.activeElement !== input) return
    caret.current = null
    let position = 0
    for (let seen = 0; position < shown.length && seen < before; position += 1) {
      if (/\d/.test(shown[position])) seen += 1
    }
    input.setSelectionRange(position, position)
  })

  return (
    <div
      className={cn(
        'flex w-full items-stretch overflow-hidden rounded-full border bg-surface transition-colors',
        'focus-within:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        invalid ? 'border-danger focus-within:border-danger' : 'border-line',
        disabled && 'opacity-40',
        SIZES[size],
        className,
      )}
    >
      <span className="relative flex shrink-0 items-center gap-1.5 border-r border-line pl-3.5 pr-2 font-semibold text-ink">
        {/* The visible part sizes the control; the native select sits over it,
            transparent, so its options can carry full country names without
            the closed control growing to fit the longest one. */}
        <span aria-hidden="true">{flag(country.code)}</span>
        <span aria-hidden="true" className="tabular-nums">+{country.dial}</span>
        <ChevronDownIcon size={14} className="text-ink-faint" />
        <select
          aria-label="Country dial code"
          value={country.code}
          disabled={disabled}
          onChange={(event) => {
            const next = countries.find((c) => c.code === event.target.value) ?? fallback
            setChosen(next)
            commit(next, national)
          }}
          className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 outline-none disabled:cursor-not-allowed"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {`${flag(c.code)} ${c.name} +${c.dial}`}
            </option>
          ))}
        </select>
      </span>
      <input
        ref={(node) => {
          inputRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={id ? undefined : label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        required={required}
        disabled={disabled}
        value={shown}
        placeholder={placeholder ?? country.format?.replace(/#/g, '0')}
        onChange={onNumber}
        className="min-w-0 flex-1 bg-transparent px-3.5 font-medium tabular-nums text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
      />
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  )
})
