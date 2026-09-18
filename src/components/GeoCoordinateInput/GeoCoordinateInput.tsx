'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { CopyButton } from '../CopyButton'
import { Field } from '../Field'
import { Input } from '../Input'
import {
  compassPoint,
  formatCoordinate,
  haversineKm,
  initialBearing,
  parseCoordinate,
  readBack,
  type GeoCoordinateInputFormat,
  type GeoCoordinateInputPoint,
} from './geo'

export interface GeoCoordinateInputReference extends GeoCoordinateInputPoint {
  /** What the point is called in the distance line — “the office”, “Heathrow”. */
  label: string
}

export interface GeoCoordinateInputProps {
  /** Visible label for the field. */
  label: string
  /** Controlled point. `null` while the text does not parse. */
  value?: GeoCoordinateInputPoint | null
  /** Starting point when uncontrolled. */
  defaultValue?: GeoCoordinateInputPoint | null
  /** Called with the parsed point on every valid edit, and `null` when the text stops parsing. */
  onValueChange?: (value: GeoCoordinateInputPoint | null) => void
  /** Measure distance and initial bearing from this point to the entered one. */
  reference?: GeoCoordinateInputReference
  /** Distance unit for the reference line. */
  unit?: 'km' | 'mi'
  /** Decimal places in the normalised decimal output. */
  precision?: number
  /** Notations offered for copying, in order. */
  formats?: GeoCoordinateInputFormat[]
  /** Guidance under the field while it is valid. */
  hint?: string
  /** Placeholder text inside the field. */
  placeholder?: string
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const FORMAT_LABEL: Record<GeoCoordinateInputFormat, string> = {
  decimal: 'Decimal',
  dms: 'DMS',
  ddm: 'Degrees, decimal minutes',
  'geo-uri': 'geo: URI',
}

const NOTATION_LABEL = { decimal: 'decimal degrees', dms: 'degrees, minutes, seconds', ddm: 'degrees and decimal minutes' }

const same = (a: GeoCoordinateInputPoint | null | undefined, b: GeoCoordinateInputPoint | null | undefined) =>
  a === b || (!!a && !!b && Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lon - b.lon) < 1e-9)

/**
 * One field for a latitude and longitude, written however the source wrote
 * it — a phone’s share sheet gives decimals, a chart gives 51°30′26″N, a GPS
 * gives N 51° 30.433′ — because retyping between notations is where a sign or
 * a minute goes missing.
 *
 * Parsing is lenient about notation and strict about meaning: a minus sign and
 * an S together, 61 minutes, or a latitude past 90 are errors with a reason,
 * not a guess. Under the field it reads the point back in words and in each
 * normalised notation, so what was understood is checkable before it is saved.
 */
export function GeoCoordinateInput({
  label,
  value,
  defaultValue = null,
  onValueChange,
  reference,
  unit = 'km',
  precision = 6,
  formats = ['decimal', 'dms', 'ddm'],
  hint = 'Decimal, 51°30′26″N 0°7′39″W, or N 51° 30.433′ W 0° 7.65′.',
  placeholder = '51.5072, -0.1276',
  disabled = false,
  className,
}: GeoCoordinateInputProps) {
  const uid = useId()
  const initial = value !== undefined ? value : defaultValue
  const [text, setText] = useState(() => (initial ? formatCoordinate(initial, 'decimal', precision) : ''))
  const [touched, setTouched] = useState(false)
  const parsed = useMemo(() => parseCoordinate(text), [text])
  const current = parsed.ok ? parsed.point : null

  // A controlled value that moves somewhere the text does not say replaces the text.
  const [seen, setSeen] = useState(value)
  if (value !== undefined && !same(value, seen)) {
    setSeen(value)
    if (!same(value, current)) setText(value ? formatCoordinate(value, 'decimal', precision) : '')
  }

  const edit = (next: string) => {
    setText(next)
    const result = parseCoordinate(next)
    const point = result.ok ? result.point : null
    if (!same(point, current)) {
      if (value !== undefined) setSeen(point)
      onValueChange?.(point)
    }
  }

  const showError = !parsed.ok && text.trim() !== '' && touched
  const distance = current && reference ? haversineKm(reference, current) : null
  const bearing = current && reference ? initialBearing(reference, current) : null
  const shownDistance = distance === null ? '' : unit === 'mi' ? distance / 1.609344 : distance

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <Field label={label} hint={hint} error={showError && !parsed.ok ? parsed.error : undefined} disabled={disabled}>
        <Input
          value={text}
          onChange={(event) => edit(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className="font-mono"
          aria-describedby={current ? `${uid}-readback` : undefined}
        />
      </Field>

      {current && parsed.ok && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3">
          <p id={`${uid}-readback`} className="text-[12px] font-medium leading-normal text-ink-soft">
            <span className="font-semibold text-ink">Read as {NOTATION_LABEL[parsed.notation]}:</span> {readBack(current)}
          </p>
          <ul aria-label="Normalised notations" className="flex flex-col gap-1">
            {formats.map((format) => {
              const out = formatCoordinate(current, format, precision)
              return (
                <li key={format} className="flex min-w-0 items-center gap-2">
                  <span className="w-[92px] shrink-0 text-[11px] font-semibold text-ink-faint">{FORMAT_LABEL[format]}</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{out}</code>
                  <CopyButton value={out} label={`Copy ${FORMAT_LABEL[format]}`} iconOnly size="sm" />
                </li>
              )
            })}
          </ul>
          {reference && distance !== null && bearing !== null && (
            <p className="border-t border-line pt-2 text-[12px] font-medium text-ink-soft">
              <span className="font-semibold tabular-nums text-ink">
                {Number(shownDistance).toLocaleString(undefined, { maximumFractionDigits: Number(shownDistance) < 10 ? 2 : 1 })} {unit}
              </span>{' '}
              from {reference.label}, initial bearing{' '}
              <span className="font-semibold tabular-nums text-ink">
                {bearing.toFixed(1)}° {compassPoint(bearing)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
