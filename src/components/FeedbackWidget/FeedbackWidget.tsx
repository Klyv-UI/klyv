'use client'

import { useId, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Text } from '../Text'
import { Textarea } from '../Textarea'
import { InlineMessage } from '../InlineMessage'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { SegmentedControl } from '../SegmentedControl'
import { SuccessMark } from '../SuccessMark'

export interface Feedback {
  /** 1–5, or null when only a message was left. */
  rating: number | null
  message: string
  category?: string
}

export interface FeedbackWidgetProps {
  onSubmit: (feedback: Feedback) => void | Promise<void>
  /** "Idea", "Bug", "Other". Omit to skip the choice. */
  categories?: string[]
  title?: string
  triggerLabel?: string
  placement?: PopoverPlacement
  align?: PopoverAlign
  className?: string
}

const FACES = [
  { value: 1, face: '😞', label: 'Very unhappy' },
  { value: 2, face: '🙁', label: 'Unhappy' },
  { value: 3, face: '😐', label: 'Neutral' },
  { value: 4, face: '🙂', label: 'Happy' },
  { value: 5, face: '😍', label: 'Very happy' },
]

/**
 * "How is it going?" behind a small button: a face, a sentence, and send.
 *
 * Either half is enough — a face with no words is still signal, and a bug
 * report does not need a mood. The faces are real radio buttons, so arrow keys
 * move between them and each is announced by its word, not by its emoji's
 * Unicode name. The thanks replaces the form, so nobody wonders whether it went.
 */
export function FeedbackWidget({
  onSubmit,
  categories,
  title = 'Share feedback',
  triggerLabel = 'Feedback',
  placement = 'top',
  align = 'end',
  className,
}: FeedbackWidgetProps) {
  const groupName = useId()
  const messageId = useId()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState(categories?.[0] ?? '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>()

  const reset = () => {
    setRating(null)
    setMessage('')
    setSent(false)
    setError(undefined)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (rating === null && !message.trim()) return
    setSending(true)
    setError(undefined)
    try {
      await onSubmit({ rating, message: message.trim(), category: categories ? category : undefined })
      setSent(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'It did not send. Try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && sent) reset()
      }}
      placement={placement}
      align={align}
      label={title}
      className="w-[min(340px,calc(100vw-24px))] p-4"
      trigger={
        <Button size="sm" variant="outline" aria-expanded={open} className={className}>
          {triggerLabel}
        </Button>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-3 text-center" role="status">
          <SuccessMark size="md" />
          <Text size="heading">Thank you</Text>
          <Text size="caption" tone="soft" leading="normal">
            Every message is read by the team that builds this.
          </Text>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
          <Text size="heading">{title}</Text>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[12px] font-semibold text-ink-soft">How is it going?</legend>
            <div className="flex justify-between gap-1">
              {FACES.map((item) => (
                <label key={item.value} className="relative">
                  <input
                    type="radio"
                    name={groupName}
                    value={item.value}
                    checked={rating === item.value}
                    onChange={() => setRating(item.value)}
                    aria-label={item.label}
                    className="peer absolute inset-0 cursor-pointer appearance-none rounded-full"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none flex size-11 items-center justify-center rounded-full text-[22px] transition-[transform,background-color]',
                      'grayscale peer-hover:grayscale-0 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent-strong',
                      'peer-checked:scale-110 peer-checked:bg-accent-soft peer-checked:grayscale-0',
                    )}
                  >
                    {item.face}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {categories && categories.length > 0 && (
            <SegmentedControl
              label="Kind of feedback"
              size="sm"
              fullWidth
              value={category}
              onValueChange={setCategory}
              options={categories.map((item) => ({ value: item, label: item }))}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={messageId} className="text-[12px] font-semibold text-ink-soft">
              Anything to add? <span className="font-medium text-ink-faint">(optional)</span>
            </label>
            <Textarea id={messageId} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>

          {error && (
            <InlineMessage tone="danger" live>
              {error}
            </InlineMessage>
          )}

          <Button type="submit" loading={sending} disabled={rating === null && !message.trim()}>
            Send feedback
          </Button>
        </form>
      )}
    </Popover>
  )
}
