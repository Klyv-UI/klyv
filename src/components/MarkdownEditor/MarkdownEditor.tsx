'use client'

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Tabs } from '../Tabs'
import { renderMarkdown } from './render'

export type MarkdownEditorAction = 'heading' | 'bold' | 'italic' | 'link' | 'code' | 'quote' | 'list'

export interface MarkdownEditorProps {
  /** Controlled markdown. */
  value?: string
  /** Starting markdown when uncontrolled. */
  defaultValue?: string
  /** Called with the markdown after every edit. */
  onValueChange?: (value: string) => void
  /** Accessible name for the text area. Pair with a Field for a visible label. */
  label: string
  /** The formatting buttons, in order. */
  actions?: MarkdownEditorAction[]
  /** Shown while the text area is empty. */
  placeholder?: string
  /** Visible lines in the text area. */
  rows?: number
  /** The HTML level a `#` heading renders at in the preview, so it fits the page’s outline. */
  headingLevel?: 2 | 3 | 4
  /** Marks the field as failing validation. */
  invalid?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Goes on the text area, so a Field label points at it. */
  id?: string
  /** Forwarded from Field. */
  'aria-describedby'?: string
  /** Merged last, so it wins. */
  className?: string
}

interface Edit {
  text: string
  start: number
  end: number
}

const glyph = (children: ReactNode) => (
  <svg viewBox="0 0 16 16" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const ACTIONS: Record<MarkdownEditorAction, { label: string; shortcut?: string; icon: ReactNode }> = {
  heading: { label: 'Heading', icon: <span className="text-[13px] font-extrabold">H</span> },
  bold: { label: 'Bold', shortcut: 'B', icon: <span className="text-[13px] font-extrabold">B</span> },
  italic: { label: 'Italic', shortcut: 'I', icon: <span className="font-serif text-[14px] font-semibold italic">I</span> },
  link: { label: 'Link', shortcut: 'K', icon: glyph(<path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 014 4l-1 1M9 11.5l-1 1a2.8 2.8 0 01-4-4l1-1" />) },
  code: { label: 'Code', icon: glyph(<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" />) },
  quote: { label: 'Quote', icon: glyph(<path d="M3 4.5v7M6.5 5.5h6.5M6.5 8h6.5M6.5 10.5h4" />) },
  list: { label: 'Bulleted list', icon: glyph(<path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5M2.75 4.5h.01M2.75 8h.01M2.75 11.5h.01" />) },
}

const DEFAULT_ACTIONS: MarkdownEditorAction[] = ['heading', 'bold', 'italic', 'link', 'code', 'quote', 'list']

/** Wraps the selection in a marker, or unwraps it if the marker is already there. */
function wrap(text: string, start: number, end: number, marker: string, placeholder: string): Edit {
  const before = text.slice(0, start)
  const after = text.slice(end)
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return { text: before.slice(0, -marker.length) + text.slice(start, end) + after.slice(marker.length), start: start - marker.length, end: end - marker.length }
  }
  const inner = text.slice(start, end) || placeholder
  return { text: before + marker + inner + marker + after, start: start + marker.length, end: start + marker.length + inner.length }
}

/** Adds a prefix to every line the selection touches, or removes it from all of them. */
function prefixLines(text: string, start: number, end: number, prefix: string): Edit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const lineEndIndex = text.indexOf('\n', end)
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex
  const lines = text.slice(lineStart, lineEnd).split('\n')
  const remove = lines.every((line) => line.startsWith(prefix))
  const next = lines.map((line) => (remove ? line.slice(prefix.length) : prefix + line)).join('\n')
  return { text: text.slice(0, lineStart) + next + text.slice(lineEnd), start: lineStart, end: lineStart + next.length }
}

function apply(action: MarkdownEditorAction, text: string, start: number, end: number): Edit {
  const chosen = text.slice(start, end)
  switch (action) {
    case 'bold':
      return wrap(text, start, end, '**', 'bold text')
    case 'italic':
      return wrap(text, start, end, '_', 'italic text')
    case 'code':
      if (chosen.includes('\n')) {
        const block = `\`\`\`\n${chosen}\n\`\`\``
        return { text: text.slice(0, start) + block + text.slice(end), start: start + 4, end: start + 4 + chosen.length }
      }
      return wrap(text, start, end, '`', 'code')
    case 'link': {
      const words = chosen || 'link text'
      const inserted = `[${words}](https://)`
      const urlStart = start + words.length + 3
      return { text: text.slice(0, start) + inserted + text.slice(end), start: urlStart, end: urlStart + 8 }
    }
    case 'heading':
      return prefixLines(text, start, end, '## ')
    case 'quote':
      return prefixLines(text, start, end, '> ')
    case 'list':
      return prefixLines(text, start, end, '- ')
  }
}

/**
 * Markdown with a toolbar, for the places people write more than a sentence —
 * a release note, an issue, a comment that needs a list.
 *
 * A rich-text editor is a large dependency and stores something nobody can
 * diff; a bare textarea asks everyone to remember the syntax. This is the
 * middle: the buttons and Ctrl or ⌘ with B, I and K wrap the selection in the
 * syntax and select what is left to type, pressing one again removes it, and
 * edits go through the browser’s own undo where it allows.
 *
 * The preview is rendered by a small built-in parser into React elements, never
 * into an HTML string. Anything that looks like HTML in the source is shown as
 * text, and links only render for http, https, mailto and relative addresses —
 * so a pasted `javascript:` link is inert rather than one click from running.
 */
export function MarkdownEditor({
  value,
  defaultValue = '',
  onValueChange,
  label,
  actions = DEFAULT_ACTIONS,
  placeholder = 'Write in Markdown…',
  rows = 8,
  headingLevel = 3,
  invalid = false,
  disabled = false,
  id,
  'aria-describedby': describedBy,
  className,
}: MarkdownEditorProps) {
  const uid = useId()
  const textareaId = id ?? `${uid}-text`
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const text = value ?? uncontrolled
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [activeTool, setActiveTool] = useState(0)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<[number, number] | null>(null)
  const toolRefs = useRef<(HTMLButtonElement | null)[]>([])

  const change = (next: string) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area || !pendingSelection.current) return
    area.focus()
    area.setSelectionRange(...pendingSelection.current)
    pendingSelection.current = null
  })

  const run = (action: MarkdownEditorAction) => {
    const area = areaRef.current
    if (!area || disabled) return
    const { selectionStart: start, selectionEnd: end } = area
    const edit = apply(action, text, start, end)
    pendingSelection.current = [edit.start, edit.end]

    // Replace only the part that changed, through the browser's editing
    // commands where it has them, so Ctrl+Z undoes the formatting.
    let from = 0
    while (from < text.length && text[from] === edit.text[from]) from += 1
    let tail = 0
    while (tail < text.length - from && tail < edit.text.length - from && text[text.length - 1 - tail] === edit.text[edit.text.length - 1 - tail]) tail += 1
    area.focus()
    area.setSelectionRange(from, text.length - tail)
    const inserted = edit.text.slice(from, edit.text.length - tail)
    const native = typeof document.execCommand === 'function' && document.execCommand('insertText', false, inserted)
    if (!native || area.value !== edit.text) change(edit.text)
    else area.setSelectionRange(edit.start, edit.end)
  }

  const onAreaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
    const action = actions.find((candidate) => ACTIONS[candidate].shortcut?.toLowerCase() === event.key.toLowerCase())
    if (!action) return
    event.preventDefault()
    run(action)
  }

  const onToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: activeTool + 1, ArrowLeft: activeTool - 1, Home: 0, End: actions.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    const next = (moves[event.key] + actions.length) % actions.length
    setActiveTool(next)
    toolRefs.current[next]?.focus()
  }

  const shortcutHint = (key?: string) => (key ? ` (Ctrl+${key})` : '')

  const writePanel = (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[var(--radius-field)] border border-line bg-surface',
        'has-[textarea:focus]:border-line-strong has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-focus has-[textarea:focus-visible]:outline-solid',
        invalid && 'border-danger',
      )}
    >
      <div role="toolbar" aria-label="Formatting" aria-controls={textareaId} onKeyDown={onToolbarKeyDown} className="flex flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1">
        {actions.map((action, index) => {
          const { label: name, shortcut, icon } = ACTIONS[action]
          return (
            <button
              key={action}
              ref={(node) => {
                toolRefs.current[index] = node
              }}
              type="button"
              aria-label={name}
              aria-keyshortcuts={shortcut ? `Control+${shortcut} Meta+${shortcut}` : undefined}
              title={name + shortcutHint(shortcut)}
              tabIndex={index === activeTool ? 0 : -1}
              disabled={disabled}
              // Keeps the selection in the text area while the button is pressed.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setActiveTool(index)
                run(action)
              }}
              className="flex size-8 items-center justify-center rounded-[var(--radius-8)] text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-40"
            >
              {icon}
            </button>
          )
        })}
      </div>
      <textarea
        ref={areaRef}
        id={textareaId}
        aria-label={id ? undefined : label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        rows={rows}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => change(event.target.value)}
        onKeyDown={onAreaKeyDown}
        className="w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none placeholder:font-sans placeholder:text-ink-faint disabled:cursor-not-allowed"
      />
    </div>
  )

  const previewPanel = (
    <div
      className="min-h-[120px] rounded-[var(--radius-field)] border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-ink"
      style={{ minHeight: `${rows * 1.625 + 3.5}em` }}
    >
      {text.trim() ? renderMarkdown(text, headingLevel) : <p className="text-ink-faint">Nothing to preview yet.</p>}
    </div>
  )

  return (
    <Tabs
      label={`${label} mode`}
      variant="underline"
      value={mode}
      onValueChange={setMode}
      className={cn('w-full gap-2', disabled && 'opacity-60', className)}
      items={[
        { value: 'write', label: 'Write', content: writePanel },
        { value: 'preview', label: 'Preview', content: previewPanel },
      ]}
    />
  )
}
