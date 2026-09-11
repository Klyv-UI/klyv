'use client'

import { useEffect, useMemo } from 'react'
import { cn } from '../../lib/cn'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { Select } from '../Select'

export interface ImportField {
  id: string
  /** What we call it. */
  label: string
  required?: boolean
  /** What a good value looks like. */
  hint?: string
}

export interface ImportMapperProps {
  /** The file's header row. */
  headers: string[]
  /** A few rows from the file, for the preview. Three or four is plenty. */
  rows: string[][]
  /** The fields the importer needs. */
  fields: ImportField[]
  /** field id → header, or null for unmapped. */
  value: Record<string, string | null>
  onChange: (value: Record<string, string | null>) => void
  /** Accessible name. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

const NONE = '__none__'

/** Loose similarity: exact, then contains, then shared alphanumerics. */
function score(header: string, field: ImportField): number {
  const a = header.toLowerCase().replace(/[^a-z0-9]/g, '')
  const b = field.label.toLowerCase().replace(/[^a-z0-9]/g, '')
  const c = field.id.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!a) return 0
  if (a === b || a === c) return 100
  if (a.includes(b) || b.includes(a)) return 70
  if (a.includes(c) || c.includes(a)) return 60
  const shared = [...new Set(a)].filter((letter) => b.includes(letter)).length
  return (shared / Math.max(b.length, 1)) * 30
}

/**
 * Matching the columns in someone's file to the fields the importer wants.
 *
 * It guesses first and asks second. A file with an `Amount` column and a field
 * called Amount does not need a human to connect them, and making someone do it
 * nine times before reaching the one ambiguous column is how an import gets
 * abandoned. The guess is scored, so a wrong one is still a starting point
 * rather than a claim.
 *
 * Every choice shows real values from the file underneath it. Mapping by column
 * name alone goes wrong exactly when two columns have similar names, and the
 * first three rows resolve that instantly where a header cannot.
 *
 * Two problems are surfaced as they happen rather than on submit: a required
 * field left unmapped, and one column claimed by two fields. Both are trivial
 * to fix while the file is on screen and miserable to diagnose from an error
 * after the upload.
 */
export function ImportMapper({
  headers,
  rows,
  fields,
  value,
  onChange,
  label,
  className,
}: ImportMapperProps) {
  // Guess once, for fields nobody has decided about yet.
  const guessed = useMemo(() => {
    const taken = new Set(Object.values(value).filter(Boolean) as string[])
    const next: Record<string, string | null> = {}
    for (const field of fields) {
      if (field.id in value) continue
      const best = headers
        .filter((header) => !taken.has(header))
        .map((header) => ({ header, points: score(header, field) }))
        .sort((a, b) => b.points - a.points)[0]
      if (best && best.points >= 60) {
        next[field.id] = best.header
        taken.add(best.header)
      } else {
        next[field.id] = null
      }
    }
    return next
  }, [fields, headers, value])

  useEffect(() => {
    if (Object.keys(guessed).length > 0) onChange({ ...guessed, ...value })
  }, [guessed, onChange, value])

  const assigned = Object.values(value).filter(Boolean) as string[]
  const duplicated = new Set(assigned.filter((header, index) => assigned.indexOf(header) !== index))
  const missing = fields.filter((field) => field.required && !value[field.id])

  const sample = (header: string | null) => {
    if (!header) return []
    const column = headers.indexOf(header)
    if (column === -1) return []
    return rows.slice(0, 3).map((row) => row[column] ?? '')
  }

  return (
    <Surface
      variant="card"
      padding="lg"
      role="group"
      aria-label={label}
      className={cn('gap-4', className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Text size="heading">Match your columns</Text>
        <Text size="caption" tone="faint" tabular>
          {headers.length} columns · {rows.length} rows previewed
        </Text>
      </div>

      {(missing.length > 0 || duplicated.size > 0) && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1">
          {missing.length > 0 && (
            <Text size="caption" tone="danger">
              Still needed: {missing.map((field) => field.label).join(', ')}.
            </Text>
          )}
          {duplicated.size > 0 && (
            <Text size="caption" tone="danger">
              {[...duplicated].join(', ')} {duplicated.size === 1 ? 'is' : 'are'} mapped to more than
              one field.
            </Text>
          )}
        </div>
      )}

      <ul className="flex flex-col divide-y divide-line">
        {fields.map((field) => {
          const header = value[field.id] ?? null
          const values = sample(header)
          const clash = header !== null && duplicated.has(header)

          return (
            <li key={field.id} className="flex flex-wrap items-start gap-4 py-3 first:pt-0 last:pb-0">
              <span className="flex min-w-[150px] flex-col gap-1">
                <Text as="span" size="body">
                  {field.label}
                  {field.required && (
                    <Text as="span" size="caption" tone="danger">
                      {' *'}
                    </Text>
                  )}
                </Text>
                {field.hint && (
                  <Text as="span" size="caption" tone="faint">
                    {field.hint}
                  </Text>
                )}
              </span>

              <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                <Select
                  label={`Column for ${field.label}`}
                  fullWidth
                  invalid={clash || (field.required && !header)}
                  value={header ?? NONE}
                  onValueChange={(next) =>
                    onChange({ ...value, [field.id]: next === NONE ? null : next })
                  }
                  options={[
                    { value: NONE, label: 'Not imported' },
                    ...headers.map((entry) => ({ value: entry, label: entry })),
                  ]}
                />

                {/* Names collide; values rarely do. */}
                {values.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {values.map((entry, index) => (
                      <Tag key={index} size="sm">
                        {entry === '' ? 'empty' : entry}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <Text as="span" size="caption" tone="faint">
                    Nothing from the file will go into this field.
                  </Text>
                )}

                {clash && (
                  <Text as="span" size="caption" tone="danger">
                    Also mapped to another field.
                  </Text>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Surface>
  )
}
