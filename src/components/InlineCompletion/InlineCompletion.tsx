'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'

export type InlineCompletionSuggestion = string | null | undefined

export interface InlineCompletionProps {
  /** Controlled text. */
  value?: string
  /** Starting text when uncontrolled. */
  defaultValue?: string
  /** Called with the text after every keystroke and every accepted suggestion. */
  onValueChange?: (value: string) => void
  /**
   * Returns what should follow the text — only the continuation, not the text
   * itself. May return a promise; the signal aborts when the text changes
   * before it settles, and a late answer is ignored either way.
   */
  getSuggestion: (text: string, signal: AbortSignal) => InlineCompletionSuggestion | Promise<InlineCompletionSuggestion>
  /** Quiet time after the last keystroke before asking, in milliseconds. */
  debounce?: number
  /** A textarea instead of a single line. */
  multiline?: boolean
  /** Visible lines when multiline. */
  rows?: number
  /** Called with the part of a suggestion that was accepted. */
  onAccept?: (accepted: string) => void
  /** Accessible name. Pair with a Field for a visible one. */
  label: string
  placeholder?: string
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Overrides the generated id. Field supplies one. */
  id?: string
  /** Extra descriptions, such as a Field hint. */
  'aria-describedby'?: string
  /** Merged last, so it wins; targets the wrapper. */
  className?: string
}

const COPIED = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'textIndent', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'tabSize', 'wordSpacing'] as const

/**
 * A text field that finishes the sentence: a suggested continuation appears in
 * faint text after the caret, the way a code editor or a mail client offers it.
 * Tab or → takes all of it, Ctrl/⌘+→ takes the next word, Escape sends it away
 * until the text changes, and typing the same characters it suggested simply
 * walks through it.
 *
 * The ghost text is drawn by a mirror laid over the field that copies the
 * field’s font, padding, border and scroll position, so the suggestion starts
 * exactly where the typed text ends. It is only offered with the caret at the
 * end — a suggestion in the middle of a sentence would be a guess about the
 * wrong thing — and each new suggestion is read out once, politely.
 */
export function InlineCompletion({
  value,
  defaultValue = '',
  onValueChange,
  getSuggestion,
  debounce = 150,
  multiline = false,
  rows = 3,
  onAccept,
  label,
  placeholder,
  disabled = false,
  id,
  'aria-describedby': describedBy,
  className,
}: InlineCompletionProps) {
  const uid = useId()
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const text = value ?? uncontrolled
  const [ghost, setGhost] = useState('')
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)
  const [atEnd, setAtEnd] = useState(false)
  const [mirror, setMirror] = useState<CSSProperties>({})
  const [scroll, setScroll] = useState({ left: 0, top: 0 })
  const [announcement, setAnnouncement] = useState('')
  const announced = useRef('')
  const getRef = useRef(getSuggestion)
  getRef.current = getSuggestion

  // Copy the field's text metrics, and again whenever it changes size.
  useIsomorphicLayoutEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const measure = () => {
      const style = window.getComputedStyle(field)
      setMirror(Object.fromEntries(COPIED.map((key) => [key, style[key]])) as CSSProperties)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(field)
    return () => observer.disconnect()
  }, [multiline])

  useEffect(() => {
    if (!text.trim() || dismissedAt === text) return setGhost('')
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const next = await getRef.current(text, controller.signal)
        if (!controller.signal.aborted) setGhost(next ?? '')
      } catch {
        if (!controller.signal.aborted) setGhost('')
      }
    }, debounce)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [text, dismissedAt, debounce])

  const visible = atEnd && !disabled ? ghost : ''

  useEffect(() => {
    if (!visible || announced.current.endsWith(visible)) return
    announced.current = visible
    setAnnouncement(`Suggestion: ${visible.trim()}. Press Tab to accept.`)
  }, [visible])

  const readCaret = () => {
    const field = fieldRef.current
    if (!field) return
    setAtEnd(field.selectionStart === field.value.length && field.selectionEnd === field.value.length && document.activeElement === field)
    setScroll({ left: field.scrollLeft, top: field.scrollTop })
  }

  const commit = (next: string) => {
    // Typing the suggested characters walks through the ghost instead of dropping it.
    const typed = next.startsWith(text) ? next.slice(text.length) : null
    setGhost((current) => (typed && current.startsWith(typed) ? current.slice(typed.length) : ''))
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  const accept = (part: string) => {
    if (!part) return
    commit(text + part)
    onAccept?.(part)
    requestAnimationFrame(() => {
      const field = fieldRef.current
      if (!field) return
      field.setSelectionRange(field.value.length, field.value.length)
      if (multiline) field.scrollTop = field.scrollHeight
      else field.scrollLeft = field.scrollWidth
      readCaret()
    })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!visible) return
    const mod = event.ctrlKey || event.metaKey
    if (event.key === 'Tab' && !event.shiftKey && !mod && !event.altKey) {
      event.preventDefault()
      accept(visible)
    } else if (event.key === 'ArrowRight' && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      accept(mod ? (/^\s*\S+/.exec(visible)?.[0] ?? visible) : visible)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setDismissedAt(text)
      setGhost('')
    }
  }

  const shared = {
    id: id ?? `${uid}-field`,
    ref: fieldRef,
    value: text,
    placeholder,
    disabled,
    'aria-label': label,
    'aria-autocomplete': 'inline' as const,
    'aria-describedby': [describedBy, `${uid}-keys`].filter(Boolean).join(' '),
    autoComplete: 'off',
    spellCheck: multiline,
    onChange: (event: { target: { value: string } }) => commit(event.target.value),
    onKeyDown,
    onKeyUp: readCaret,
    onSelect: readCaret,
    onClick: readCaret,
    onFocus: readCaret,
    onBlur: () => setAtEnd(false),
    onScroll: readCaret,
    className: cn(
      'w-full min-w-0 border border-line bg-surface font-medium text-ink placeholder:text-ink-faint focus:border-line-strong disabled:cursor-not-allowed',
      multiline ? 'resize-y rounded-[var(--radius-tile)] px-4 py-3 text-[13px] leading-relaxed' : 'h-10 rounded-full px-4 text-[13px]',
    ),
  }

  return (
    <div className={cn('relative w-full', disabled && 'opacity-40', className)}>
      {multiline ? <textarea rows={rows} {...shared} /> : <input type="text" {...shared} />}
      <div
        aria-hidden="true"
        style={{ ...mirror, borderStyle: 'solid', borderColor: 'transparent' }}
        className={cn('pointer-events-none absolute inset-0 overflow-hidden', multiline ? 'whitespace-pre-wrap break-words' : 'flex items-center whitespace-pre')}
      >
        <div style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>
          <span className="text-transparent">{text}</span>
          <span data-inline-completion-ghost="" className="text-ink-faint">
            {visible}
          </span>
        </div>
      </div>
      <span id={`${uid}-keys`} className="sr-only">
        Suggestions appear as you type. Tab accepts, Control and Right Arrow accepts a word, Escape dismisses.
      </span>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
