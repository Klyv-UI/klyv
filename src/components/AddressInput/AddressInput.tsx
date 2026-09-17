'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Field } from '../Field'
import { Input } from '../Input'
import { ChevronDownIcon } from '../internal/icons'

export interface AddressInputValue {
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  /** ISO 3166-1 alpha-2 code. */
  country: string
}

export interface AddressInputCountry {
  /** ISO 3166-1 alpha-2 code. */
  code: string
  name: string
  /** What the region is called here. Omit to hide the region field entirely. */
  regionLabel?: string
  /** What the postal code is called here. */
  postalLabel?: string
  /** Hint under the postal code — its shape, so a reader can check their own. */
  postalHint?: string
}

export interface AddressInputSuggestion {
  id: string
  /** The line shown in the list — usually the street address. */
  label: string
  /** Second line — town and postcode. */
  description?: string
  /** What choosing it fills in. */
  address: Partial<AddressInputValue>
}

export interface AddressInputProps {
  /** Controlled value. */
  value?: AddressInputValue
  /** Starting value when uncontrolled. Missing parts start empty. */
  defaultValue?: Partial<AddressInputValue>
  /** Called with the whole address after every edit. */
  onValueChange?: (value: AddressInputValue) => void
  /** Legend for the group — "Shipping address". */
  label: string
  /** The countries offered, in order. Defaults to a short list with local labels. */
  countries?: AddressInputCountry[]
  /** Country used when the value names none. */
  defaultCountry?: string
  /**
   * Called as the first line is typed, from three characters. Return suggestions from your
   * address provider; picking one fills the fields. Omit for plain fields.
   */
  onSuggest?: (query: string, country: string) => AddressInputSuggestion[] | Promise<AddressInputSuggestion[]>
  /** Prefix for the `name` of each input, so the address submits with a form: `shipping` gives `shipping-city`. */
  name?: string
  /** Marks the address, the city and the postal code as required. */
  required?: boolean
  /** Blocks interaction and dims the fields. */
  disabled?: boolean
  /** Hide the legend visually, keeping it for assistive tech. */
  hideLabel?: boolean
  /** Merged last, so it wins. */
  className?: string
}

export const ADDRESS_INPUT_COUNTRIES: AddressInputCountry[] = [
  { code: 'US', name: 'United States', regionLabel: 'State', postalLabel: 'ZIP code', postalHint: '5 digits, e.g. 94103' },
  { code: 'GB', name: 'United Kingdom', regionLabel: 'County (optional)', postalLabel: 'Postcode', postalHint: 'e.g. SW1A 1AA' },
  { code: 'CA', name: 'Canada', regionLabel: 'Province', postalLabel: 'Postal code', postalHint: 'e.g. K1A 0B1' },
  { code: 'AU', name: 'Australia', regionLabel: 'State or territory', postalLabel: 'Postcode', postalHint: '4 digits' },
  { code: 'IE', name: 'Ireland', regionLabel: 'County', postalLabel: 'Eircode', postalHint: 'e.g. D02 X285' },
  { code: 'IN', name: 'India', regionLabel: 'State', postalLabel: 'PIN code', postalHint: '6 digits' },
  { code: 'DE', name: 'Germany', postalLabel: 'Postleitzahl', postalHint: '5 digits' },
  { code: 'FR', name: 'France', postalLabel: 'Code postal', postalHint: '5 digits' },
]

const EMPTY: AddressInputValue = { line1: '', line2: '', city: '', region: '', postalCode: '', country: '' }

/**
 * A postal address as its parts, labelled the way the reader's own country
 * labels them.
 *
 * A single "Address" textarea cannot be validated, geocoded or autofilled, and
 * a form that asks an Irish reader for a "ZIP code" and a "State" tells them it
 * was not built for them. Each input carries the `autocomplete` token browsers
 * fill from — `address-line1`, `address-level2`, `postal-code` — so most people
 * never type it at all, and changing the country relabels the region and postal
 * fields, or drops the region where there is none.
 *
 * Suggestions are a slot rather than a dependency: pass `onSuggest` and the
 * first line becomes a combobox fed by whichever provider you already pay for.
 */
export function AddressInput({
  value,
  defaultValue,
  onValueChange,
  label,
  countries = ADDRESS_INPUT_COUNTRIES,
  defaultCountry = 'US',
  onSuggest,
  name,
  required = false,
  disabled = false,
  hideLabel = false,
  className,
}: AddressInputProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState<AddressInputValue>({ ...EMPTY, country: defaultCountry, ...defaultValue })
  const address = value ?? uncontrolled
  const country = countries.find((entry) => entry.code === address.country) ?? countries.find((entry) => entry.code === defaultCountry) ?? countries[0]

  const [suggestions, setSuggestions] = useState<AddressInputSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [announcement, setAnnouncement] = useState('')
  const request = useRef(0)

  const update = (patch: Partial<AddressInputValue>) => {
    const next = { ...address, country: country?.code ?? '', ...patch }
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  const query = address.line1
  useEffect(() => {
    if (!onSuggest || !open || query.trim().length < 3) {
      setSuggestions([])
      return
    }
    const ticket = ++request.current
    const timer = window.setTimeout(async () => {
      const results = await onSuggest(query.trim(), country?.code ?? '')
      if (ticket !== request.current) return
      setSuggestions(results)
      setActive(-1)
      setAnnouncement(results.length ? `${results.length} suggestions. Use the arrow keys to choose one.` : 'No suggestions')
    }, 200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, country?.code])

  const choose = (suggestion: AddressInputSuggestion) => {
    update({ ...suggestion.address })
    setOpen(false)
    setSuggestions([])
    setAnnouncement(`Filled in ${suggestion.label}`)
  }

  const listId = `${uid}-suggestions`
  const expanded = open && suggestions.length > 0
  const onLineKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!expanded) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      choose(suggestions[active])
    } else if (event.key === 'Escape') {
      // Claimed here so an enclosing dialog stays open.
      event.preventDefault()
      setOpen(false)
    }
  }

  const fieldName = (part: string) => (name ? `${name}-${part}` : undefined)
  const section = name ? `section-${name} ` : ''

  return (
    <fieldset disabled={disabled} className={cn('flex min-w-0 flex-col gap-3', disabled && 'opacity-60', className)}>
      <legend className={cn('mb-3 text-[13px] font-bold text-ink', hideLabel && 'sr-only')}>{label}</legend>

      {/* The chevron sits beside Field, not inside it: Field labels its one child. */}
      <div className="relative">
        <Field label="Country or region">
          <select
            name={fieldName('country')}
            autoComplete={`${section}country`}
            value={country?.code}
            onChange={(event) => update({ country: event.target.value, region: '' })}
            className="h-10 w-full cursor-pointer appearance-none rounded-full border border-line bg-surface pl-4 pr-10 text-[13px] font-medium text-ink focus:border-line-strong disabled:cursor-not-allowed"
          >
            {countries.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.name}
              </option>
            ))}
          </select>
        </Field>
        <ChevronDownIcon size={14} className="pointer-events-none absolute bottom-[13px] right-4 text-ink-faint" />
      </div>

      <div className="relative">
        <Field label="Address" required={required}>
          <Input
            name={fieldName('line1')}
            autoComplete={`${section}address-line1`}
            value={address.line1}
            onChange={(event) => {
              update({ line1: event.target.value })
              setOpen(true)
            }}
            onKeyDown={onLineKeyDown}
            onBlur={() => setOpen(false)}
            {...(onSuggest
              ? {
                  role: 'combobox',
                  'aria-autocomplete': 'list' as const,
                  'aria-expanded': expanded,
                  'aria-controls': listId,
                  'aria-activedescendant': expanded && active >= 0 ? `${listId}-${active}` : undefined,
                }
              : null)}
          />
        </Field>
        {onSuggest && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Address suggestions"
            hidden={!expanded}
            className="absolute inset-x-0 top-full z-10 mt-1.5 flex flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface p-1 shadow-[var(--shadow-float)]"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // Chosen on pointer-down, before the input's blur closes the list.
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(suggestion)
                }}
                onMouseEnter={() => setActive(index)}
                className={cn('flex cursor-pointer flex-col rounded-[10px] px-3 py-2', index === active && 'bg-surface-muted')}
              >
                <span className="text-[13px] font-semibold text-ink">{suggestion.label}</span>
                {suggestion.description && <span className="text-[12px] font-medium text-ink-faint">{suggestion.description}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label="Apartment, suite or floor (optional)">
        <Input name={fieldName('line2')} autoComplete={`${section}address-line2`} value={address.line2} onChange={(event) => update({ line2: event.target.value })} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <Field label="Town or city" required={required} className={country?.regionLabel ? 'sm:col-span-2' : 'sm:col-span-3'}>
          <Input name={fieldName('city')} autoComplete={`${section}address-level2`} value={address.city} onChange={(event) => update({ city: event.target.value })} />
        </Field>
        {country?.regionLabel && (
          <Field label={country.regionLabel} required={required && !/optional/i.test(country.regionLabel)} className="sm:col-span-2">
            <Input name={fieldName('region')} autoComplete={`${section}address-level1`} value={address.region} onChange={(event) => update({ region: event.target.value })} />
          </Field>
        )}
        <Field
          label={country?.postalLabel ?? 'Postal code'}
          hint={country?.postalHint}
          required={required}
          className={country?.regionLabel ? 'sm:col-span-2' : 'sm:col-span-3'}
        >
          <Input
            name={fieldName('postal-code')}
            autoComplete={`${section}postal-code`}
            autoCapitalize="characters"
            value={address.postalCode}
            onChange={(event) => update({ postalCode: event.target.value })}
          />
        </Field>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </fieldset>
  )
}
