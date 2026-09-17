'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Textarea } from '../Textarea'
import { CrossIcon } from '../internal/icons'

export type NpsSurveyCategory = 'detractor' | 'passive' | 'promoter'

export interface NpsSurveyResponse {
  score: number
  category: NpsSurveyCategory
  /** The follow-up answer, trimmed. May be empty. */
  comment: string
}

export interface NpsSurveyProps {
  /** The recommendation question. Name the product. */
  question?: string
  /** Controlled score. */
  value?: number | null
  /** Initial score when uncontrolled. */
  defaultValue?: number | null
  onValueChange?: (score: number) => void
  /** Return a promise to hold the submit button busy until it settles. */
  onSubmit: (response: NpsSurveyResponse) => void | Promise<void>
  /** Shows a close button. The survey does not hide itself — the caller decides when to stop asking. */
  onDismiss?: () => void
  /** The second question, per category. */
  followUp?: Partial<Record<NpsSurveyCategory, string>>
  /** Replaces the thank-you message. */
  thanks?: ReactNode
  /** card is a standalone panel; inline sits flat inside a page or a toast. */
  variant?: 'card' | 'inline'
  /** Merged last, so it wins. */
  className?: string
}

const categoryOf = (score: number): NpsSurveyCategory => (score <= 6 ? 'detractor' : score <= 8 ? 'passive' : 'promoter')

const FOLLOW_UP: Record<NpsSurveyCategory, string> = {
  detractor: 'What is the one thing we should fix first?',
  passive: 'What would have made it a 10?',
  promoter: 'What do you value most?',
}

const BANDS: { category: NpsSurveyCategory; label: string; span: string }[] = [
  { category: 'detractor', label: 'Not likely', span: 'col-span-7' },
  { category: 'passive', label: 'Maybe', span: 'col-span-2' },
  { category: 'promoter', label: 'Very likely', span: 'col-span-2' },
]

/**
 * The 0–10 “how likely are you to recommend us” question, with a follow-up
 * that changes with the answer.
 *
 * The scale is a group of real radio buttons, so arrow keys move along it and
 * a screen reader hears “7, 8 of 11”. The bands under it are what the scores
 * mean to the reader — not likely, maybe, very likely — rather than the
 * detractor and promoter labels, which are the analyst’s words, not theirs.
 *
 * The follow-up only appears once a score is picked, and asks something that
 * fits it: a 3 is asked what to fix, a 10 what they value. One generic “any
 * comments?” gets the fewest answers of all. Picking a score does not submit:
 * people change their mind between 7 and 8, and the comment is often the more
 * useful half.
 */
export function NpsSurvey({
  question = 'How likely are you to recommend us to a friend or colleague?',
  value: controlled,
  defaultValue = null,
  onValueChange,
  onSubmit,
  onDismiss,
  followUp,
  thanks,
  variant = 'card',
  className,
}: NpsSurveyProps) {
  const id = useId()
  const [uncontrolled, setUncontrolled] = useState<number | null>(defaultValue)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  // The button that was pressed is gone once the thanks replaces the form, so
  // focus moves to the thanks instead of falling to the page.
  useEffect(() => {
    if (done) statusRef.current?.focus()
  }, [done])
  const score = controlled === undefined ? uncontrolled : controlled
  const category = score === null ? null : categoryOf(score)

  const pick = (next: number) => {
    if (controlled === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  const submit = async () => {
    if (score === null || category === null) return
    setBusy(true)
    try {
      await onSubmit({ score, category, comment: comment.trim() })
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  const Shell = variant === 'card' ? Surface : 'div'
  const shellProps = variant === 'card' ? { variant: 'card' as const, padding: 'lg' as const } : {}

  return (
    <Shell {...shellProps} className={cn('relative flex flex-col gap-4', className)}>
      {onDismiss && (
        <IconButton icon={CrossIcon} label="Dismiss survey" size="xs" onClick={onDismiss} className="absolute right-3 top-3" />
      )}

      <div ref={statusRef} role="status" tabIndex={-1} className="outline-none">
        {done && (
          <div className="flex flex-col gap-1 pr-8">
            <Text size="heading">Thanks for telling us.</Text>
            <Text size="label" tone="soft" leading="normal">
              {thanks ?? 'Every answer is read by the team that builds the product.'}
            </Text>
          </div>
        )}
      </div>

      {!done && (
        <>
          <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className="mb-3 p-0 pr-8">
              <Text as="span" size="heading" leading="tight">
                {question}
              </Text>
            </legend>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, n) => (
                <label key={n} className="relative">
                  <input type="radio" name={id} value={n} checked={score === n} onChange={() => pick(n)} className="peer sr-only" />
                  <span
                    className={cn(
                      'flex h-10 cursor-pointer items-center justify-center rounded-[var(--radius-glyph)] border text-[13px] font-bold tabular-nums transition-colors',
                      'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-focus-visible:outline-solid',
                      score === n ? 'border-accent-strong bg-accent text-accent-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                    )}
                  >
                    {n}
                  </span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-11 gap-1" aria-hidden="true">
              {BANDS.map((band) => (
                <span
                  key={band.category}
                  className={cn(
                    'border-t-2 pt-1 text-[11px] font-semibold',
                    band.span,
                    band.category === 'promoter' && 'text-right',
                    band.category === 'passive' && 'text-center',
                    category === band.category ? 'border-accent-strong text-ink' : 'border-line text-ink-faint',
                  )}
                >
                  {band.label}
                </span>
              ))}
            </div>
          </fieldset>

          {category && (
            <div className="flex flex-col gap-2">
              <Text as="label" htmlFor={`${id}-comment`} size="label" weight="semibold" tone="soft">
                {followUp?.[category] ?? FOLLOW_UP[category]} <span className="text-ink-faint">(optional)</span>
              </Text>
              <Textarea id={`${id}-comment`} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
              <div className="flex justify-end gap-2">
                <Button onClick={submit} loading={busy}>
                  Send feedback
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  )
}
