'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface FieldError {
  /** The id of the control this is about — the link focuses it. */
  id: string
  /** The field's name, as its label reads. */
  label: string
  /** What is wrong and what to do, in that order. */
  message: string
}

export interface ValidationSummaryProps {
  errors: FieldError[]
  /** Heading above the list. */
  title?: string
  /** Move focus here when errors appear. */
  focusOnError?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The digest at the top of a form listing everything that is wrong, with a link
 * to each field.
 *
 * Inline messages alone fail the case that matters: a long form, submitted,
 * with one error below the fold. Nothing appears to happen. The summary is the
 * only pattern that makes a rejected submission perceivable without asking the
 * reader to hunt.
 *
 * It takes focus when it appears — that is the WCAG technique, not a
 * flourish. It is a container rather than a control, so it needs `tabIndex={-1}`
 * to be focusable at all, and focusing it is what makes a screen reader read the
 * heading and the count instead of leaving the caret at the submit button.
 *
 * Each entry is a real link to the field's id, so it works with the browser's
 * own focus handling rather than a scroll hack — and it moves the caret, not
 * just the viewport, which a `scrollIntoView` never does.
 */
export function ValidationSummary({
  errors,
  title,
  focusOnError = true,
  className,
}: ValidationSummaryProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const previous = useRef(0)

  useEffect(() => {
    // Only on the transition into an error state — not on every keystroke that
    // leaves one behind, which would trap focus up here while typing.
    if (focusOnError && errors.length > 0 && previous.current === 0) {
      rootRef.current?.focus()
    }
    previous.current = errors.length
  }, [errors.length, focusOnError])

  if (errors.length === 0) return null

  const heading =
    title ??
    `${errors.length} ${errors.length === 1 ? 'thing needs' : 'things need'} fixing before this can be sent`

  return (
    <div
      ref={rootRef}
      role="alert"
      // A container has to be told it can hold focus, and it has to hold it
      // for the heading and count to be announced at all. A plain div rather
      // than `Surface`, which does not forward a ref.
      tabIndex={-1}
      aria-labelledby="validation-summary-title"
      className={cn(
        'flex flex-col gap-2 rounded-[var(--radius-tile)] border border-danger/40 bg-danger/[0.06] p-3.5 outline-offset-2',
        className,
      )}
    >
      <Text as="h2" id="validation-summary-title" size="heading" tone="danger">
        {heading}
      </Text>

      <ul className="flex flex-col gap-1">
        {errors.map((error) => (
          <li key={error.id}>
            <a
              href={`#${error.id}`}
              onClick={(event) => {
                // Focus, not just scroll: the caret has to land in the field.
                const field = document.getElementById(error.id)
                if (!field) return
                event.preventDefault()
                field.focus()
                field.scrollIntoView({ block: 'center', behavior: 'smooth' })
              }}
              className="text-[13px] font-bold text-ink underline underline-offset-2 hover:text-danger"
            >
              {error.label}
            </a>
            <Text as="span" size="caption" tone="soft" leading="normal">
              {' — '}
              {error.message}
            </Text>
          </li>
        ))}
      </ul>
    </div>
  )
}
