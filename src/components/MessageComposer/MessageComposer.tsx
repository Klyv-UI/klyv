'use client'

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import type { IconComponent } from '../../lib/types'
import { IconButton } from '../IconButton'
import { Tag } from '../Tag'
import { CrossIcon } from '../internal/icons'

export interface MessageComposerAttachment {
  id: string
  /** File name, shown on the chip and in its remove button’s label. */
  name: string
  /** Optional detail after the name — “2.4 MB”. */
  meta?: string
}

export interface MessageComposerSendPayload {
  text: string
  attachments: MessageComposerAttachment[]
}

export interface MessageComposerProps {
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called on every edit, and with an empty string after a send. */
  onValueChange?: (value: string) => void
  /** Called with the trimmed text and attachments. Return a promise to show the sending state until it settles. */
  onSend: (payload: MessageComposerSendPayload) => void | Promise<void>
  /** Files waiting to go with the message. The caller owns the list. */
  attachments?: MessageComposerAttachment[]
  /** Removes one attachment chip. */
  onRemoveAttachment?: (id: string) => void
  /** Shows the attach button. Open your own file picker here. */
  onAttach?: () => void
  /** Extra controls beside attach — an emoji picker trigger, a formatting toggle. */
  actions?: ReactNode
  /** Enter sends and Shift+Enter adds a line. When false, Enter adds a line and Ctrl/⌘+Enter sends. */
  sendOnEnter?: boolean
  /** Character limit. Past it the counter turns red and send is blocked, rather than silently truncating a paste. */
  maxLength?: number
  /** Tallest the field grows before it scrolls, in lines. */
  maxRows?: number
  /** Forces the sending state, for a send the caller tracks itself. */
  sending?: boolean
  disabled?: boolean
  placeholder?: string
  /** Accessible name for the text field. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const PaperclipIcon: IconComponent = ({ size = 16, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M13.5 7.5l-5.6 5.6a3.3 3.3 0 01-4.7-4.7l5.9-5.9a2.2 2.2 0 013.1 3.1l-5.9 5.9a1.1 1.1 0 01-1.6-1.6l5.3-5.3" />
  </svg>
)

const SendIcon: IconComponent = ({ size = 16, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
  </svg>
)

const LINE_HEIGHT = 20

/**
 * The box at the bottom of a conversation. It grows with what is typed up to a
 * few lines and then scrolls, so a long message never pushes the thread off
 * screen and a short one never sits in a tall empty well.
 *
 * Enter sends because that is what every chat product has taught people; the
 * setting flips it for long-form contexts where a stray Enter would send half a
 * thought. Composition input is respected either way — Enter that confirms a
 * Japanese or Chinese IME candidate is not a send.
 *
 * Send stays disabled while there is nothing to send, and while a send is in
 * flight, which is what prevents the double message from an impatient second tap.
 */
export function MessageComposer({
  value: controlled,
  defaultValue = '',
  onValueChange,
  onSend,
  attachments = [],
  onRemoveAttachment,
  onAttach,
  actions,
  sendOnEnter = true,
  maxLength,
  maxRows = 6,
  sending: sendingProp = false,
  disabled = false,
  placeholder = 'Write a message…',
  label = 'Message',
  className,
}: MessageComposerProps) {
  const counterId = useId()
  const hintId = useId()
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const [pending, setPending] = useState(false)
  const value = controlled ?? uncontrolled
  const sending = sendingProp || pending

  const setValue = (next: string) => {
    if (controlled === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  useIsomorphicLayoutEffect(() => {
    const field = fieldRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${Math.min(field.scrollHeight, maxRows * LINE_HEIGHT + 16)}px`
  }, [value, maxRows])

  const over = maxLength !== undefined && value.length > maxLength
  const empty = value.trim() === '' && attachments.length === 0
  const blocked = disabled || sending || empty || over

  const send = async () => {
    if (blocked) return
    const result = onSend({ text: value.trim(), attachments })
    setValue('')
    if (result && typeof (result as Promise<void>).then === 'function') {
      setPending(true)
      try {
        await result
      } finally {
        setPending(false)
      }
    }
    fieldRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    const modifier = event.metaKey || event.ctrlKey
    if (sendOnEnter ? !event.shiftKey : modifier) {
      event.preventDefault()
      void send()
    }
  }

  const remaining = maxLength === undefined ? 0 : maxLength - value.length
  const nearLimit = maxLength !== undefined && remaining <= Math.max(20, maxLength * 0.1)

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[var(--radius-field)] border border-line bg-surface p-2 transition-colors focus-within:border-line-strong',
        'has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-focus has-[textarea:focus-visible]:outline-solid',
        disabled && 'opacity-40',
        className,
      )}
    >
      {attachments.length > 0 && (
        <ul aria-label="Attachments" className="flex flex-wrap gap-1.5 px-1 pt-1">
          {attachments.map((file) => (
            <li key={file.id}>
              <Tag size="sm" className="gap-1 pr-1">
                <span className="max-w-[180px] truncate">{file.name}</span>
                {file.meta && <span className="text-ink-faint">{file.meta}</span>}
                {onRemoveAttachment && (
                  <IconButton icon={CrossIcon} label={`Remove ${file.name}`} size="xs" className="size-5" onClick={() => onRemoveAttachment(file.id)} disabled={sending} />
                )}
              </Tag>
            </li>
          ))}
        </ul>
      )}

      <textarea
        ref={fieldRef}
        rows={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={label}
        aria-describedby={maxLength !== undefined ? `${hintId} ${counterId}` : hintId}
        aria-invalid={over || undefined}
        disabled={disabled}
        className="w-full resize-none bg-transparent px-2 py-2 text-[13px] font-medium leading-5 text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
      />
      <span id={hintId} className="sr-only">
        {sendOnEnter ? 'Enter to send, Shift+Enter for a new line.' : 'Ctrl+Enter to send.'}
      </span>

      <div className="flex items-center gap-1">
        {onAttach && <IconButton icon={PaperclipIcon} label="Attach a file" size="sm" onClick={onAttach} disabled={disabled || sending} />}
        {actions}
        <span className="flex-1" />
        {maxLength !== undefined && (
          <span
            id={counterId}
            aria-live={nearLimit ? 'polite' : 'off'}
            className={cn('px-2 text-[11px] font-semibold tabular-nums', over ? 'text-danger' : nearLimit ? 'text-ink-soft' : 'text-ink-faint')}
          >
            {over ? `${-remaining} over the limit` : nearLimit ? `${remaining} characters left` : `${value.length}/${maxLength}`}
          </span>
        )}
        <IconButton icon={SendIcon} label="Send" tone="accent" size="sm" loading={sending} disabled={blocked} onClick={() => void send()} />
      </div>
    </div>
  )
}
