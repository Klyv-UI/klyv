'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'

export interface LikertScaleStatement {
  id: string
  /** The statement being rated, such as “Onboarding was quick”. */
  label: string
  /** Must be answered before the survey is complete. */
  required?: boolean
}

export interface LikertScaleOption {
  value: string
  /** Heading of the column, and the radio’s name. */
  label: string
}

export interface LikertScaleProps {
  /** Rows: one radio group each. */
  statements: LikertScaleStatement[]
  /** Columns, from one end of the scale to the other. Defaults to five-point agreement. */
  options?: LikertScaleOption[]
  /** Controlled answers, keyed by statement id. */
  value?: Record<string, string>
  /** Starting answers when uncontrolled. */
  defaultValue?: Record<string, string>
  /** Called with every answer after one changes. */
  onValueChange?: (value: Record<string, string>) => void
  /** Names the whole matrix, such as the survey question. */
  label: string
  /** Show the answered count and bar. */
  showProgress?: boolean
  /** Mark unanswered required statements as errors — set it after a submit attempt. */
  showErrors?: boolean
  /** Form field name prefix; each row submits as `${name}[statementId]`. */
  name?: string
  /** Blocks interaction and dims the matrix. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const AGREEMENT: LikertScaleOption[] = [
  { value: '1', label: 'Strongly disagree' },
  { value: '2', label: 'Disagree' },
  { value: '3', label: 'Neutral' },
  { value: '4', label: 'Agree' },
  { value: '5', label: 'Strongly agree' },
]

/**
 * A survey matrix: statements down the side, one agreement scale across the top.
 *
 * Each row is a radiogroup of native radios, named by its statement, and every
 * radio carries its own option label rather than relying on a column header —
 * a screen reader moving through a row with arrows hears “Agree, 4 of 5”, not
 * “radio button, 4 of 5”. The header row is visual only.
 *
 * A grid of five columns is unreadable on a phone, so the layout follows the
 * width of its container, not the viewport: below about 36rem each statement
 * becomes its own card with the options stacked and labelled in place. It is
 * one set of elements in both layouts, so answers and focus survive a resize.
 */
export function LikertScale({
  statements,
  options = AGREEMENT,
  value,
  defaultValue = {},
  onValueChange,
  label,
  showProgress = true,
  showErrors = false,
  name,
  disabled = false,
  className,
}: LikertScaleProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const answers = value ?? uncontrolled
  const answered = statements.filter((statement) => answers[statement.id]).length
  const columns = { gridTemplateColumns: `minmax(10rem, 1.6fr) repeat(${options.length}, minmax(3.5rem, 1fr))` }

  const choose = (statementId: string, option: string) => {
    const next = { ...answers, [statementId]: option }
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  return (
    <div role="group" aria-labelledby={`${uid}-label`} className={cn('@container flex w-full flex-col gap-3', disabled && 'opacity-60', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={`${uid}-label`} className="text-[14px] font-bold text-ink">
          {label}
        </span>
        {showProgress && (
          <span className="flex items-center gap-2 text-[12px] font-medium text-ink-faint tabular-nums">
            <span aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded-full bg-track">
              <span
                className="block h-full rounded-full bg-accent-strong transition-[width] motion-reduce:transition-none"
                style={{ width: `${statements.length ? (answered / statements.length) * 100 : 0}%` }}
              />
            </span>
            {answered} of {statements.length} answered
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 @xl:gap-0 @xl:overflow-hidden @xl:rounded-[var(--radius-tile)] @xl:border @xl:border-line">
        <div aria-hidden="true" className="hidden border-b border-line bg-surface-sunken px-4 py-2.5 @xl:grid" style={columns}>
          <span />
          {options.map((option) => (
            <span key={option.value} className="px-1 text-center text-[11px] font-bold leading-tight text-ink-faint">
              {option.label}
            </span>
          ))}
        </div>

        {statements.map((statement, row) => {
          const missing = showErrors && statement.required && !answers[statement.id]
          return (
            <div
              key={statement.id}
              role="radiogroup"
              aria-labelledby={`${uid}-${row}`}
              aria-required={statement.required || undefined}
              aria-invalid={missing || undefined}
              aria-describedby={missing ? `${uid}-${row}-error` : undefined}
              className={cn(
                'flex flex-col gap-2 rounded-[var(--radius-tile)] border p-3.5 @xl:grid @xl:items-center @xl:gap-0 @xl:rounded-none @xl:border-0 @xl:px-4 @xl:py-3',
                '@xl:[&:not(:last-child)]:border-b @xl:[&:not(:last-child)]:border-line @xl:odd:bg-surface',
                missing ? 'border-danger @xl:bg-[color-mix(in_oklab,var(--color-danger)_6%,transparent)]' : 'border-line bg-surface',
              )}
              style={columns}
            >
              <span className="flex flex-col gap-0.5 @xl:pr-3">
                <span id={`${uid}-${row}`} className="text-[13px] font-semibold text-ink">
                  {statement.label}
                  {statement.required && (
                    <span aria-hidden="true" className="text-danger">
                      {' '}
                      *
                    </span>
                  )}
                </span>
                {missing && (
                  <span id={`${uid}-${row}-error`} className="text-[12px] font-medium text-danger">
                    Choose an answer
                  </span>
                )}
              </span>
              {options.map((option) => {
                const checked = answers[statement.id] === option.value
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 @xl:justify-center @xl:py-2',
                      checked ? 'bg-accent-soft @xl:bg-transparent' : 'hover:bg-surface-muted',
                      disabled && 'cursor-not-allowed',
                    )}
                  >
                    <input
                      type="radio"
                      name={name ? `${name}[${statement.id}]` : `${uid}-${statement.id}`}
                      value={option.value}
                      checked={checked}
                      disabled={disabled}
                      required={statement.required}
                      onChange={() => choose(statement.id, option.value)}
                      className="size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface transition-colors checked:border-[5px] checked:border-accent-strong hover:border-ink-faint checked:hover:border-accent-strong disabled:cursor-not-allowed"
                    />
                    <span className="text-[13px] font-medium text-ink-soft @xl:sr-only">{option.label}</span>
                  </label>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
