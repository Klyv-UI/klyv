import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text, type TextTone } from '../Text'

export type InlineMessageTone = 'hint' | 'success' | 'warning' | 'danger'

const TONES: Record<InlineMessageTone, TextTone> = {
  hint: 'faint',
  success: 'success',
  warning: 'soft',
  danger: 'danger',
}

/** A glyph accompanies tone so colour is not the only signal. */
const MARKS: Record<InlineMessageTone, string> = {
  hint: '',
  success: '✓',
  warning: '!',
  danger: '!',
}

export interface InlineMessageProps {
  tone?: InlineMessageTone
  /** The message. */
  children: ReactNode
  /** Announce changes. Use for validation results that appear after an action. */
  live?: boolean
  /** Wire this to the control via aria-describedby. */
  id?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The one-line form of Alert, for the message under a field. It is deliberately
 * unboxed: a bordered block under every input makes a form feel like a list of
 * problems rather than a form.
 */
export function InlineMessage({
  tone = 'hint',
  children,
  live = false,
  id,
  className,
}: InlineMessageProps) {
  return (
    <Text
      id={id}
      size="caption"
      weight="medium"
      tone={TONES[tone]}
      leading="normal"
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      className={cn('flex items-start gap-1.5', className)}
    >
      {MARKS[tone] && (
        <span aria-hidden="true" className="font-bold">
          {MARKS[tone]}
        </span>
      )}
      <span>{children}</span>
    </Text>
  )
}
