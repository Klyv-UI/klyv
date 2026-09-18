'use client'

import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Field } from '../Field'
import { Input } from '../Input'
import { Modal } from '../Modal'

export type RichTextEditorFormat = 'bold' | 'italic' | 'underline' | 'strike' | 'h2' | 'h3' | 'ul' | 'ol' | 'quote' | 'link'

export interface RichTextEditorProps {
  /** Controlled HTML. Sanitised on the way in, so it may come from anywhere. */
  value?: string
  /** Starting HTML when uncontrolled. */
  defaultValue?: string
  /** Called with sanitised HTML after every edit. An empty document is ''. */
  onValueChange?: (html: string) => void
  /** Accessible name of the text box and its toolbar. */
  label: string
  /** Shown while the document is empty. */
  placeholder?: string
  /** Height of the writing area before it grows, in pixels. */
  minHeight?: number
  /** Blocks editing and dims the toolbar. */
  disabled?: boolean
  /** Ids of elements that describe the text box — a hint, an error. */
  'aria-describedby'?: string
  /** Merged last, so it wins. */
  className?: string
}

/* ------------------------------------------------------------- sanitiser */

const KEEP = new Set(['p', 'br', 'b', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'])
const RENAME: Record<string, string> = { strong: 'b', em: 'i', strike: 's', del: 's', h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3' }
// Dropped with everything inside them, not unwrapped: their text is code, or chrome.
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'title', 'meta', 'link', 'head', 'form', 'input', 'button', 'textarea', 'select', 'img', 'video', 'audio'])
const BLOCKS = 'p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote'

/** A link target the editor will keep: http(s), mailto, tel, or a relative path. */
export function richTextEditorSafeUrl(raw: string | null): string | null {
  const url = (raw ?? '').trim()
  if (!url) return null
  // Browsers ignore control characters and whitespace inside a scheme, so
  // `java\nscript:` still runs. Compare with them removed.
  const compact = url.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase()
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(compact)
  if (!scheme) return url
  return ['http', 'https', 'mailto', 'tel'].includes(scheme[1]) ? url : null
}

/**
 * Rebuilds the HTML from an allow-list rather than deleting a deny-list: every
 * element is recreated with only the attributes it is allowed, so an unknown
 * attack is dropped by default. Parsing happens in an inert document, where
 * scripts never run and images never load.
 */
export function richTextEditorSanitize(html: string): string {
  if (typeof document === 'undefined') return ''
  const doc = document.implementation.createHTMLDocument('')
  doc.body.innerHTML = html
  const out = doc.createElement('div')
  const copy = (from: Node, to: Element) => {
    from.childNodes.forEach((node) => {
      if (node.nodeType === 3) to.append(doc.createTextNode(node.textContent ?? ''))
      if (node.nodeType !== 1) return
      const element = node as Element
      const tag = element.tagName.toLowerCase()
      if (DROP.has(tag)) return
      let name: string | null = RENAME[tag] ?? (KEEP.has(tag) ? tag : null)
      if (tag === 'div') name = element.querySelector(BLOCKS) ? null : 'p'
      const href = name === 'a' ? richTextEditorSafeUrl(element.getAttribute('href')) : null
      if (!name || (name === 'a' && !href)) return copy(element, to)
      const clean = doc.createElement(name)
      if (href) {
        clean.setAttribute('href', href)
        clean.setAttribute('rel', 'noopener noreferrer nofollow')
      }
      copy(element, clean)
      to.append(clean)
    })
  }
  copy(doc.body, out)
  const text = out.textContent?.trim() ?? ''
  return text || out.querySelector('li') ? out.innerHTML : ''
}

const escapeText = (text: string) =>
  text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => `<p>${block.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>')}</p>`)
    .join('')

/* ----------------------------------------------------------------- toolbar */

const TAGS: Record<string, RichTextEditorFormat> = { B: 'bold', STRONG: 'bold', I: 'italic', EM: 'italic', U: 'underline', S: 'strike', STRIKE: 'strike', DEL: 'strike', H2: 'h2', H3: 'h3', UL: 'ul', OL: 'ol', BLOCKQUOTE: 'quote', A: 'link' }

function formatsAt(root: HTMLElement, node: Node | null): Set<RichTextEditorFormat> {
  const found = new Set<RichTextEditorFormat>()
  for (let at = node; at && at !== root; at = at.parentNode) {
    const format = at.nodeType === 1 ? TAGS[(at as Element).tagName] : undefined
    if (format) found.add(format)
  }
  return found
}

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 16 16" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

interface Tool {
  id: string
  label: string
  glyph: ReactNode
  format?: RichTextEditorFormat
  run: () => void
  needsExec?: boolean
}

/**
 * Formatted writing — bold, headings, lists, quotes, links — for a comment, a
 * description, a release note. Markdown is the better answer for people who
 * know it; this is for everyone else, who expects the buttons to do what they
 * show.
 *
 * The toolbar follows the caret: every button reports the formatting of the
 * text you are in, so pressing it again takes that formatting away. The value
 * is HTML, and every path in — the value prop, a paste, a link — goes through
 * an allow-list sanitiser, because pasted HTML carries whatever the page it
 * came from carried. Undo and redo keep their own history, so they still work
 * after the value is replaced from outside.
 */
export function RichTextEditor({
  value,
  defaultValue = '',
  onValueChange,
  label,
  placeholder = 'Start writing…',
  minHeight = 160,
  disabled = false,
  'aria-describedby': describedBy,
  className,
}: RichTextEditorProps) {
  const uid = useId()
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const emitted = useRef<string | null>(null)
  const history = useRef({ stack: [''], index: 0, at: 0 })
  const [formats, setFormats] = useState<Set<RichTextEditorFormat>>(new Set())
  const [empty, setEmpty] = useState(true)
  const [canExec, setCanExec] = useState(true)
  const [activeTool, setActiveTool] = useState(0)
  const [link, setLink] = useState<{ href: string; anchor: HTMLAnchorElement | null; error?: string } | null>(null)
  const toolRefs = useRef<(HTMLButtonElement | null)[]>([])
  // History lives in a ref so typing does not re-render; this repaints Undo and Redo.
  const [, repaint] = useState(0)

  const load = (html: string) => {
    const editor = editorRef.current
    if (!editor) return
    const clean = richTextEditorSanitize(html)
    editor.innerHTML = clean
    emitted.current = clean
    setEmpty(!clean)
  }

  useEffect(() => {
    load(value ?? defaultValue)
    history.current = { stack: [editorRef.current?.innerHTML ?? ''], index: 0, at: 0 }
    try {
      setCanExec(typeof document.execCommand === 'function' && document.queryCommandSupported('bold'))
    } catch {
      setCanExec(false)
    }
    // Mount only: later values arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (value !== undefined && value !== emitted.current) load(value)
  }, [value])

  const emit = () => {
    const editor = editorRef.current
    if (!editor) return
    const html = richTextEditorSanitize(editor.innerHTML)
    setEmpty(!html)
    if (html === emitted.current) return
    emitted.current = html
    onValueChange?.(html)
  }

  const record = (coalesce: boolean) => {
    const html = editorRef.current?.innerHTML ?? ''
    const h = history.current
    if (html === h.stack[h.index]) return
    const now = Date.now()
    if (coalesce && h.index > 0 && now - h.at < 800) h.stack[h.index] = html
    else {
      h.stack = [...h.stack.slice(Math.max(0, h.index - 99), h.index + 1), html]
      h.index = h.stack.length - 1
    }
    h.at = coalesce ? now : 0
    repaint((n) => n + 1)
  }

  const travel = (step: -1 | 1) => {
    const h = history.current
    const editor = editorRef.current
    const next = h.index + step
    if (!editor || next < 0 || next >= h.stack.length) return
    h.index = next
    h.at = 0
    editor.innerHTML = h.stack[next]
    repaint((n) => n + 1)
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    emit()
  }

  const readSelection = () => {
    const editor = editorRef.current
    const selection = typeof window === 'undefined' ? null : window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) return
    savedRange.current = range.cloneRange()
    setFormats(formatsAt(editor, range.startContainer))
  }

  useEffect(() => {
    document.addEventListener('selectionchange', readSelection)
    const editor = editorRef.current
    // History menu items and gestures arrive as beforeinput, not as keys.
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') return
      event.preventDefault()
      travel(event.inputType === 'historyUndo' ? -1 : 1)
    }
    editor?.addEventListener('beforeinput', onBeforeInput)
    return () => {
      document.removeEventListener('selectionchange', readSelection)
      editor?.removeEventListener('beforeinput', onBeforeInput)
    }
  })

  const restore = () => {
    const editor = editorRef.current
    editor?.focus()
    const range = savedRange.current
    if (!range) return
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  }

  const exec = (command: string, argument?: string) => {
    restore()
    try {
      document.execCommand('styleWithCSS', false, 'false')
      document.execCommand(command, false, argument)
    } catch {
      return
    }
    record(false)
    emit()
    readSelection()
  }

  const block = (tag: string, format: RichTextEditorFormat) => exec('formatBlock', formats.has(format) ? 'p' : tag)

  const openLink = () => {
    const editor = editorRef.current
    if (!editor || disabled) return
    let anchor: HTMLAnchorElement | null = null
    for (let at: Node | null = savedRange.current?.startContainer ?? null; at && at !== editor; at = at.parentNode) {
      if (at.nodeType === 1 && (at as Element).tagName === 'A') anchor = at as HTMLAnchorElement
    }
    setLink({ href: anchor?.getAttribute('href') ?? '', anchor })
  }

  const closeLink = () => {
    setLink(null)
    requestAnimationFrame(restore)
  }

  const saveLink = () => {
    if (!link) return
    const href = richTextEditorSafeUrl(link.href)
    if (!href) return setLink({ ...link, error: 'Use a web address, a mailto: or a tel: link.' })
    restore()
    const range = savedRange.current
    if (link.anchor) link.anchor.setAttribute('href', href)
    else if (range && !range.collapsed && canExec) document.execCommand('createLink', false, href)
    else if (range) {
      const anchor = document.createElement('a')
      anchor.setAttribute('href', href)
      if (range.collapsed) anchor.textContent = href
      else anchor.append(range.extractContents())
      range.insertNode(anchor)
    }
    record(false)
    emit()
    closeLink()
  }

  const removeLink = () => {
    const anchor = link?.anchor
    if (anchor) {
      anchor.replaceWith(...Array.from(anchor.childNodes))
      record(false)
      emit()
    }
    closeLink()
  }

  const tools: Tool[] = [
    { id: 'bold', label: 'Bold', format: 'bold', needsExec: true, glyph: <span className="font-extrabold">B</span>, run: () => exec('bold') },
    { id: 'italic', label: 'Italic', format: 'italic', needsExec: true, glyph: <span className="font-serif italic">I</span>, run: () => exec('italic') },
    { id: 'underline', label: 'Underline', format: 'underline', needsExec: true, glyph: <span className="underline">U</span>, run: () => exec('underline') },
    { id: 'strike', label: 'Strikethrough', format: 'strike', needsExec: true, glyph: <span className="line-through">S</span>, run: () => exec('strikeThrough') },
    { id: 'h2', label: 'Heading', format: 'h2', needsExec: true, glyph: <span>H2</span>, run: () => block('h2', 'h2') },
    { id: 'h3', label: 'Subheading', format: 'h3', needsExec: true, glyph: <span>H3</span>, run: () => block('h3', 'h3') },
    { id: 'ul', label: 'Bulleted list', format: 'ul', needsExec: true, glyph: svg(<path d="M6 4h8M6 8h8M6 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" strokeWidth={2} />), run: () => exec('insertUnorderedList') },
    { id: 'ol', label: 'Numbered list', format: 'ol', needsExec: true, glyph: svg(<path d="M7 4h7M7 8h7M7 12h7M2 3l1-.5V6M2 9.5c.3-.6 1.8-.6 1.8.3 0 .8-1.8 1.2-1.8 2.2h2" />), run: () => exec('insertOrderedList') },
    { id: 'quote', label: 'Quote', format: 'quote', needsExec: true, glyph: svg(<path d="M3 4v8M6.5 5h7M6.5 8h7M6.5 11h5" />), run: () => block('blockquote', 'quote') },
    { id: 'link', label: 'Link', format: 'link', glyph: svg(<path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1a2.5 2.5 0 01-3.5-3.5l1-1" />), run: openLink },
    { id: 'undo', label: 'Undo', glyph: svg(<path d="M5.5 3.5L2.5 6.5l3 3M3 6.5h6.5a3.5 3.5 0 010 7H7" />), run: () => travel(-1) },
    { id: 'redo', label: 'Redo', glyph: svg(<path d="M10.5 3.5l3 3-3 3M13 6.5H6.5a3.5 3.5 0 000 7H9" />), run: () => travel(1) },
  ]

  const onToolbarKey = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? tools.length - 1 : step !== undefined ? (activeTool + step + tools.length) % tools.length : null
    if (target === null) return
    event.preventDefault()
    setActiveTool(target)
    toolRefs.current[target]?.focus()
  }

  const onEditorKey = (event: KeyboardEvent) => {
    const mod = event.ctrlKey || event.metaKey
    if (!mod) return
    const key = event.key.toLowerCase()
    if (key === 'z' || key === 'y') {
      event.preventDefault()
      travel(key === 'y' || event.shiftKey ? 1 : -1)
    } else if (key === 'k') {
      event.preventDefault()
      readSelection()
      openLink()
    }
  }

  const onPaste = (event: ClipboardEvent) => {
    event.preventDefault()
    const html = event.clipboardData.getData('text/html')
    const clean = html ? richTextEditorSanitize(html) : escapeText(event.clipboardData.getData('text/plain'))
    const selection = window.getSelection()
    if (!clean || !selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const fragment = range.createContextualFragment(clean)
    const last = fragment.lastChild
    range.insertNode(fragment)
    if (last) {
      range.setStartAfter(last)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    record(false)
    emit()
  }

  const h = history.current
  return (
    <div className={cn('flex w-full flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface focus-within:border-line-strong', disabled && 'opacity-60', className)}>
      <div role="toolbar" aria-label={`${label} formatting`} aria-controls={`${uid}-editor`} onKeyDown={onToolbarKey} className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface-sunken p-1.5">
        {tools.map((tool, index) => {
          const unavailable = disabled || (tool.needsExec && !canExec) || (tool.id === 'undo' && h.index === 0) || (tool.id === 'redo' && h.index >= h.stack.length - 1)
          return (
            <button
              key={tool.id}
              ref={(node) => {
                toolRefs.current[index] = node
              }}
              type="button"
              tabIndex={index === activeTool ? 0 : -1}
              aria-label={tool.label}
              title={tool.label}
              aria-pressed={tool.format && tool.id !== 'link' ? formats.has(tool.format) : undefined}
              aria-disabled={unavailable || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onFocus={() => setActiveTool(index)}
              onClick={() => !unavailable && tool.run()}
              className={cn(
                'flex h-8 min-w-8 items-center justify-center rounded-[8px] px-1.5 text-[13px] font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink',
                tool.format && formats.has(tool.format) && 'bg-accent-soft text-ink hover:bg-accent-soft',
                unavailable && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                (index === 4 || index === 9) && 'ml-1.5',
              )}
            >
              {tool.glyph}
            </button>
          )
        })}
      </div>
      {!canExec && (
        <p className="border-b border-line px-3 py-1.5 text-[12px] font-medium text-ink-faint">
          This browser cannot apply formatting here. Typing, pasting and links still work.
        </p>
      )}
      <div className="relative">
        {empty && (
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-3 text-[13px] font-medium text-ink-faint">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          id={`${uid}-editor`}
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          aria-describedby={describedBy}
          aria-disabled={disabled || undefined}
          contentEditable={!disabled}
          suppressContentEditableWarning
          spellCheck
          onInput={(event) => {
            const type = (event.nativeEvent as InputEvent).inputType ?? ''
            record(type.startsWith('insertText') || type.startsWith('delete'))
            emit()
          }}
          onFocus={() => {
            try {
              document.execCommand('defaultParagraphSeparator', false, 'p')
            } catch {
              /* Enter still works; it makes <div>s, which the sanitiser turns into paragraphs. */
            }
          }}
          onKeyDown={onEditorKey}
          onPaste={onPaste}
          style={{ minHeight }}
          className={cn(
            'max-h-[480px] overflow-y-auto px-4 py-3 text-[13px] font-medium leading-relaxed text-ink outline-none',
            '[&_p]:my-1.5 [&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-[18px] [&_h2]:font-extrabold [&_h3]:mb-1 [&_h3]:mt-2.5 [&_h3]:text-[15px] [&_h3]:font-bold',
            '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-extrabold',
            '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-3 [&_blockquote]:text-ink-soft',
            '[&_a]:font-semibold [&_a]:underline [&_a]:decoration-accent-strong [&_a]:decoration-2 [&_a]:underline-offset-2',
          )}
        />
      </div>
      <Modal
        open={link !== null}
        onClose={closeLink}
        size="sm"
        title={link?.anchor ? 'Edit link' : 'Add link'}
        footer={
          <>
            {link?.anchor && (
              <Button variant="ghost" size="sm" onClick={removeLink} className="mr-auto">
                Remove link
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={closeLink}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveLink}>
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            saveLink()
          }}
        >
          <Field label="Link address" hint="A web address, or a mailto: or tel: link." error={link?.error}>
            <Input autoFocus inputMode="url" placeholder="https://" value={link?.href ?? ''} onChange={(event) => link && setLink({ ...link, href: event.target.value, error: undefined })} />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
