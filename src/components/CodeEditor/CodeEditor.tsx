'use client'

import { useId, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'

export interface CodeEditorProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'onChange' | 'rows' | 'wrap'> {
  /** Controlled source text. */
  value?: string
  /** Starting text when uncontrolled. */
  defaultValue?: string
  /** Called with the whole text after every edit. */
  onValueChange?: (value: string) => void
  /** Accessible name, when no Field or label supplies one. */
  label?: string
  /** Visible lines before the editor scrolls. */
  rows?: number
  /** Spaces per indent level. */
  tabSize?: number
  /** Marks the editor as failing validation. Pair it with a message. */
  invalid?: boolean
  /** Show the line and column read-out and the keyboard hint under the text. */
  showStatus?: boolean
  /** Classes for the frame rather than the textarea itself. */
  containerClassName?: string
}

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' }
const CLOSERS = new Set([')', ']', '}'])
const LINE = 20

/**
 * A textarea that behaves enough like an editor for JSON, config and snippets.
 *
 * It is still a textarea — no syntax runtime, no contenteditable — so forms,
 * autofill, spellcheck opt-outs and screen readers all work as they do for any
 * text field. On top: a line-number gutter kept in step with the scroll, Tab
 * and Shift+Tab to indent and outdent the selected lines, Enter that keeps the
 * indent (and opens a block between brackets), and bracket and quote pairs.
 *
 * Trapping Tab is the accessibility cost of any code field, so there is a way
 * out, stated under the editor and in its description: press Escape, then Tab
 * moves focus on as usual. Edits go through the browser’s own insert command
 * where it exists, so Ctrl+Z still undoes an indent.
 */
export function CodeEditor({
  value,
  defaultValue = '',
  onValueChange,
  label,
  rows = 12,
  tabSize = 2,
  invalid = false,
  showStatus = true,
  containerClassName,
  className,
  readOnly,
  disabled,
  onKeyDown,
  onScroll,
  onSelect,
  'aria-describedby': describedBy,
  ...props
}: CodeEditorProps) {
  const hintId = useId()
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const escaped = useRef(false)
  const pending = useRef<[number, number] | null>(null)
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const [caret, setCaret] = useState({ line: 1, column: 1 })
  const text = value ?? uncontrolled
  const lines = text.split('\n').length
  const indent = ' '.repeat(tabSize)

  const commit = (next: string) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  useIsomorphicLayoutEffect(() => {
    if (!pending.current || !area.current) return
    area.current.setSelectionRange(...pending.current)
    pending.current = null
  }, [text])

  /** Replace a range, keeping the browser’s undo history where it can. */
  const edit = (from: number, to: number, insert: string, selStart: number, selEnd = selStart) => {
    const node = area.current
    if (!node) return
    node.setSelectionRange(from, to)
    let done = false
    try {
      done = typeof document.execCommand === 'function' && document.execCommand('insertText', false, insert)
    } catch {
      done = false
    }
    if (done && node.value === text.slice(0, from) + insert + text.slice(to)) {
      node.setSelectionRange(selStart, selEnd)
      return
    }
    pending.current = [selStart, selEnd]
    commit(text.slice(0, from) + insert + text.slice(to))
  }

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.nativeEvent.isComposing) return
    const { key, shiftKey } = event
    if (key === 'Escape') {
      escaped.current = true
      return
    }
    if (key === 'Shift') return
    const leaving = escaped.current
    escaped.current = false
    if (key === 'Tab' && (leaving || readOnly || disabled)) return
    if (readOnly || disabled || event.ctrlKey || event.metaKey || event.altKey) return

    const node = event.currentTarget
    const start = node.selectionStart
    const end = node.selectionEnd
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const handled = () => event.preventDefault()

    if (key === 'Tab') {
      handled()
      if (start === end && !shiftKey) return edit(start, end, indent, start + indent.length)
      const lastChar = end > start && text[end - 1] === '\n' ? end - 1 : end
      const found = text.indexOf('\n', lastChar)
      const blockEnd = found === -1 ? text.length : found
      let first = 0
      let total = 0
      const next = text
        .slice(lineStart, blockEnd)
        .split('\n')
        .map((line, index) => {
          const change = shiftKey ? -(line.match(new RegExp(`^( {1,${tabSize}}|\\t)`))?.[0].length ?? 0) : indent.length
          if (index === 0) first = change
          total += change
          return shiftKey ? line.slice(-change) : indent + line
        })
      return edit(lineStart, blockEnd, next.join('\n'), Math.max(lineStart, start + first), Math.max(lineStart, end + total))
    }

    if (key === 'Enter') {
      handled()
      const leading = text.slice(lineStart, start).match(/^[ \t]*/)?.[0] ?? ''
      const before = text[start - 1]
      if (before && CLOSERS.has(PAIRS[before]) && start === end && text[end] === PAIRS[before]) {
        const opened = `\n${leading}${indent}`
        return edit(start, end, `${opened}\n${leading}`, start + opened.length)
      }
      const extra = before && CLOSERS.has(PAIRS[before]) ? indent : ''
      return edit(start, end, `\n${leading}${extra}`, start + 1 + leading.length + extra.length)
    }

    if (key === 'Backspace' && start === end && PAIRS[text[start - 1]] && text[start] === PAIRS[text[start - 1]]) {
      handled()
      return edit(start - 1, start + 1, '', start - 1)
    }

    if ((CLOSERS.has(key) || (key in PAIRS && !CLOSERS.has(PAIRS[key]))) && start === end && text[start] === key) {
      handled()
      return node.setSelectionRange(start + 1, start + 1)
    }

    if (key in PAIRS) {
      const close = PAIRS[key]
      if (start !== end) {
        handled()
        return edit(start, end, key + text.slice(start, end) + close, start + 1, end + 1)
      }
      const isQuote = !CLOSERS.has(close)
      const nextChar = text[start] ?? ''
      if (isQuote && /\w/.test(text[start - 1] ?? '')) return
      if (nextChar && !/[\s)\]},;:]/.test(nextChar)) return
      handled()
      return edit(start, end, key + close, start + 1)
    }
  }

  const trackCaret = () => {
    const node = area.current
    if (!node) return
    const before = node.value.slice(0, node.selectionStart)
    setCaret({ line: before.split('\n').length, column: before.length - before.lastIndexOf('\n') })
  }

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[var(--radius-field)] border bg-surface',
        // The textarea hides its own ring so the frame, gutter included, can carry it.
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)]',
        invalid ? 'border-danger' : 'border-line',
        disabled && 'opacity-50',
        containerClassName,
      )}
    >
      <div className="relative flex" style={{ height: rows * LINE + 24 }}>
        <div aria-hidden="true" className="shrink-0 select-none overflow-hidden border-r border-line bg-surface-sunken">
          <div ref={gutter} className="whitespace-pre px-3 py-3 text-right font-mono text-[12px] text-ink-faint tabular-nums" style={{ lineHeight: `${LINE}px`, minWidth: `${String(lines).length + 3}ch` }}>
            {Array.from({ length: lines }, (_, index) => index + 1).join('\n')}
          </div>
        </div>
        <textarea
          ref={area}
          value={text}
          onChange={(event) => commit(event.target.value)}
          onKeyDown={handleKey}
          onScroll={(event) => {
            if (gutter.current) gutter.current.style.transform = `translateY(${-event.currentTarget.scrollTop}px)`
            onScroll?.(event)
          }}
          onSelect={(event) => {
            trackCaret()
            onSelect?.(event)
          }}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={[describedBy, showStatus ? hintId : null].filter(Boolean).join(' ') || undefined}
          readOnly={readOnly}
          disabled={disabled}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={cn(
            'min-w-0 flex-1 resize-none bg-transparent px-3 py-3 font-mono text-[12.5px] text-ink outline-none placeholder:text-ink-faint',
            'whitespace-pre disabled:cursor-not-allowed',
            className,
          )}
          style={{ lineHeight: `${LINE}px`, tabSize }}
          {...props}
        />
      </div>
      {showStatus && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-sunken px-3 py-1.5 text-[11px] font-medium text-ink-faint">
          <span id={hintId}>
            {readOnly ? 'Read only.' : 'Tab indents. Press Esc, then Tab, to move focus out of the editor.'}
          </span>
          <span aria-hidden="true" className="shrink-0 tabular-nums">
            Ln {caret.line}, Col {caret.column}
          </span>
        </div>
      )}
    </div>
  )
}
