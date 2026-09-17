'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Combobox } from '../Combobox'
import { Field } from '../Field'
import { Select, type SelectOption } from '../Select'
import { Surface } from '../Surface'
import { Text } from '../Text'

export type LocaleSettingsDateFormat = 'auto' | 'dmy' | 'mdy' | 'ymd'
export type LocaleSettingsNumberFormat = 'auto' | 'comma-dot' | 'dot-comma' | 'space-comma'
export type LocaleSettingsWeekStart = 'monday' | 'sunday' | 'saturday'

export interface LocaleSettingsValue {
  /** BCP 47 language subtag — `en`, `de`. */
  language: string
  /** ISO region code — `GB`, `US`. */
  region: string
  /** IANA time zone — `Europe/London`. */
  timeZone: string
  dateFormat: LocaleSettingsDateFormat
  numberFormat: LocaleSettingsNumberFormat
  weekStart: LocaleSettingsWeekStart
}

export interface LocaleSettingsProps {
  /** The saved settings. Edits are a draft against this until saved. */
  value: LocaleSettingsValue
  /** Called with the draft. A promise shows the saving state. */
  onSave: (value: LocaleSettingsValue) => void | Promise<void>
  /** Languages the product is translated into. */
  languages: SelectOption[]
  /** Regions offered. */
  regions: SelectOption[]
  /** IANA zones. Defaults to every zone the browser knows. */
  timeZones?: string[]
  /** Currency used in the preview line. */
  currency?: string
  /** Merged last, so it wins. */
  className?: string
}

const DATE_FORMATS: SelectOption<LocaleSettingsDateFormat>[] = [
  { value: 'auto', label: 'Match region' },
  { value: 'dmy', label: 'DD/MM/YYYY' },
  { value: 'mdy', label: 'MM/DD/YYYY' },
  { value: 'ymd', label: 'YYYY-MM-DD' },
]

const NUMBER_FORMATS: SelectOption<LocaleSettingsNumberFormat>[] = [
  { value: 'auto', label: 'Match region' },
  { value: 'comma-dot', label: '1,234.56' },
  { value: 'dot-comma', label: '1.234,56' },
  { value: 'space-comma', label: '1 234,56' },
]

const WEEK_STARTS: SelectOption<LocaleSettingsWeekStart>[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'saturday', label: 'Saturday' },
]

const SEPARATORS: Record<Exclude<LocaleSettingsNumberFormat, 'auto'>, [string, string]> = {
  'comma-dot': [',', '.'],
  'dot-comma': ['.', ','],
  'space-comma': ['\u202f', ','],
}

const FALLBACK_ZONES = ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney']

function allZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  try {
    return intl.supportedValuesOf?.('timeZone') ?? FALLBACK_ZONES
  } catch {
    return FALLBACK_ZONES
  }
}

function safeLocale(tag: string) {
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? 'en-US'
  } catch {
    return 'en-US'
  }
}

/** Formats the sample moment and figures exactly as the settings would. */
function preview(settings: LocaleSettingsValue, currency: string, sample: Date) {
  const locale = safeLocale(`${settings.language}-${settings.region}`)
  let date: string
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: settings.timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(sample)
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
    const [d, m, y] = [pick('day'), pick('month'), pick('year')]
    date =
      settings.dateFormat === 'dmy' ? `${d}/${m}/${y}` : settings.dateFormat === 'mdy' ? `${m}/${d}/${y}` : settings.dateFormat === 'ymd' ? `${y}-${m}-${d}` : new Intl.DateTimeFormat(locale, { timeZone: settings.timeZone, dateStyle: 'medium' }).format(sample)
  } catch {
    date = sample.toISOString().slice(0, 10)
  }
  let time = ''
  try {
    time = new Intl.DateTimeFormat(locale, { timeZone: settings.timeZone, timeStyle: 'short' }).format(sample)
  } catch {
    time = ''
  }

  const withSeparators = (text: string) => {
    if (settings.numberFormat === 'auto') return text
    const [group, decimal] = SEPARATORS[settings.numberFormat]
    // Rewritten from en-US output, whose separators are known: commas group, the dot is decimal.
    const [whole, fraction] = text.split('.')
    return fraction === undefined ? whole.replace(/,/g, group) : `${whole.replace(/,/g, group)}${decimal}${fraction}`
  }
  const numberLocale = settings.numberFormat === 'auto' ? locale : 'en-US'
  const number = withSeparators(new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(1234567.89))
  let money: string
  try {
    money = withSeparators(new Intl.NumberFormat(numberLocale, { style: 'currency', currency }).format(1234.5))
  } catch {
    money = withSeparators(new Intl.NumberFormat(numberLocale, { minimumFractionDigits: 2 }).format(1234.5))
  }
  return { date, time, number, money }
}

/**
 * Language, region, time zone and the formats that follow from them, with a
 * line that shows the result before it is saved.
 *
 * People do not think in “en-GB” and “dd/MM/yyyy” — they recognise their own
 * date when they see it. So the preview renders today, a large number and a
 * price through Intl with the draft settings, and every change shows up there
 * at once. Formats default to “Match region”, so choosing a region is usually
 * the only decision; the overrides exist for the German working in a US
 * company. The time zone list is searchable because there are over four
 * hundred of them. Changes are a draft until saved, as other settings are.
 */
export function LocaleSettings({ value, onSave, languages, regions, timeZones, currency = 'USD', className }: LocaleSettingsProps) {
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [sample, setSample] = useState<Date | null>(null)
  const savedKey = JSON.stringify(value)

  useEffect(() => setDraft(value), [savedKey])
  // The sample moment is taken after mount, so server and client render alike.
  useEffect(() => setSample(new Date()), [])

  const zoneOptions = useMemo(
    () =>
      (timeZones ?? allZones()).map((zone) => ({
        value: zone,
        label: zone.replace(/_/g, ' '),
      })),
    [timeZones],
  )

  const dirty = JSON.stringify(draft) !== savedKey
  const set = <K extends keyof LocaleSettingsValue>(key: K, next: LocaleSettingsValue[K]) => setDraft((current) => ({ ...current, [key]: next }))
  const shown = sample ? preview(draft, currency, sample) : null

  return (
    <Surface variant="card" className={cn('flex flex-col', className)}>
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <Field label="Language">
          <Select label="Language" options={languages} value={draft.language} onValueChange={(next) => set('language', next)} fullWidth />
        </Field>
        <Field label="Region">
          <Select label="Region" options={regions} value={draft.region} onValueChange={(next) => set('region', next)} fullWidth />
        </Field>
        <Field label="Time zone" hint="Type to search, e.g. “Berlin”." className="sm:col-span-2">
          <Combobox
            label="Time zone"
            options={zoneOptions}
            value={draft.timeZone}
            onValueChange={(next) => next && set('timeZone', next)}
            placeholder="Search time zones"
            emptyMessage="No time zone matches"
          />
        </Field>
        <Field label="Date format">
          <Select label="Date format" options={DATE_FORMATS} value={draft.dateFormat} onValueChange={(next) => set('dateFormat', next)} fullWidth />
        </Field>
        <Field label="Number format">
          <Select label="Number format" options={NUMBER_FORMATS} value={draft.numberFormat} onValueChange={(next) => set('numberFormat', next)} fullWidth />
        </Field>
        <Field label="First day of the week">
          <Select label="First day of the week" options={WEEK_STARTS} value={draft.weekStart} onValueChange={(next) => set('weekStart', next)} fullWidth />
        </Field>
      </div>

      <div className="mx-5 flex flex-col gap-1.5 rounded-[var(--radius-tile)] bg-surface-sunken p-4">
        <Text as="h3" size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          Preview
        </Text>
        <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-ink tabular" aria-live="polite">
          {shown ? (
            <>
              <span>{shown.time ? `${shown.date}, ${shown.time}` : shown.date}</span>
              <span>{shown.number}</span>
              <span>{shown.money}</span>
              <span className="text-ink-soft">{`Weeks start on ${WEEK_STARTS.find((day) => day.value === draft.weekStart)?.label}`}</span>
            </>
          ) : (
            <span className="text-ink-faint">…</span>
          )}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 p-5">
        {dirty && (
          <Text as="span" size="caption" tone="faint" role="status">
            Unsaved changes
          </Text>
        )}
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(value)}>
          Discard
        </Button>
        <Button
          disabled={!dirty}
          loading={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave(draft)
            } finally {
              setSaving(false)
            }
          }}
        >
          Save changes
        </Button>
      </div>
    </Surface>
  )
}
