'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TerminalLine {
  id: string
  kind: 'input' | 'output' | 'error'
  content: ReactNode
}

export interface TerminalProps {
  /** Handle a command. Return what to print, or nothing. */
  onCommand: (command: string, api: TerminalApi) => void | Promise<void>
  /** Text before the caret. */
  prompt?: string
  /** Printed once, before anything is typed. */
  greeting?: ReactNode
  /** Title in the window chrome. Omit for a bare pane. */
  title?: string
  height?: number
  /** Tab-completion candidates. */
  commands?: string[]
  /** Merged last, so it wins. */
  className?: string
}

export interface TerminalApi {
  /** Print a line. */
  print: (content: ReactNode, kind?: TerminalLine['kind']) => void
  /** Wipe the scrollback. */
  clear: () => void
}

/**
 * A terminal that actually behaves like one.
 *
 * History is the part everyone leaves out, and it is the first thing anyone
 * reaches for: up and down walk previous commands, and the *draft* is
 * preserved — pressing up, changing your mind, and pressing down returns what
 * you had half-typed rather than an empty line. Losing that is the difference
 * between a terminal and a text box with a monospace font.
 *
 * The caret is a real focused input laid transparently over the rendered line,
 * so composition, IME, selection, autocorrect and paste all work exactly as
 * the platform does them. Reconstructing a caret from keystrokes is the usual
 * approach and it breaks on every keyboard that is not a US-QWERTY one.
 *
 * Output arrives through a callback rather than a return value, because a real
 * command prints as it goes — a long task should be able to write four lines
 * over two seconds, not one string at the end.
 */
export function Terminal({
  onCommand,
  prompt = '~ $',
  greeting,
  title = 'klyv — zsh',
  height = 320,
  commands = [],
  className,
}: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>(() =>
    greeting ? [{ id: 'greeting', kind: 'output', content: greeting }] : [],
  )
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState<string[]>([])
  // -1 means "editing a new line"; the draft is parked while walking back.
  const [cursor, setCursor] = useState(-1)
  const parked = useRef('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(0)

  const push = (content: ReactNode, kind: TerminalLine['kind'] = 'output') => {
    // The id is taken here, not inside the updater. Two pushes in one batch
    // queue two updaters that both run later — reading the ref from inside
    // would give them both the same, already-incremented value.
    nextId.current += 1
    const id = `line-${nextId.current}`
    setLines((current) => [...current, { id, kind, content }])
  }

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [lines, busy])

  const run = async () => {
    const command = draft.trim()
    push(
      <>
        <span className="text-ink-faint">{prompt}</span> {draft}
      </>,
      'input',
    )
    setDraft('')
    setCursor(-1)
    parked.current = ''
    if (!command) return

    setHistory((current) => [...current, command])
    setBusy(true)
    try {
      await onCommand(command, { print: push, clear: () => setLines([]) })
    } catch (error) {
      push(String(error), 'error')
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const walk = (direction: -1 | 1) => {
    if (history.length === 0) return
    if (cursor === -1 && direction === -1) parked.current = draft

    const next =
      direction === -1
        ? cursor === -1
          ? history.length - 1
          : Math.max(0, cursor - 1)
        : cursor === -1
          ? -1
          : cursor + 1

    if (next === -1 || next >= history.length) {
      setCursor(-1)
      // The half-typed line comes back, rather than an empty one.
      setDraft(parked.current)
      return
    }
    setCursor(next)
    setDraft(history[next])
  }

  const complete = () => {
    const matches = commands.filter((entry) => entry.startsWith(draft) && entry !== draft)
    if (matches.length === 1) setDraft(`${matches[0]} `)
    else if (matches.length > 1) push(matches.join('   '))
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-tile)] border border-line bg-[#0b0d12] font-mono',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {title && (
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <span className="flex gap-1.5">
            {['#ff5f57', '#febc2e', '#28c840'].map((dot) => (
              <span key={dot} className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
            ))}
          </span>
          <span className="text-[11px] font-bold text-white/55">{title}</span>
        </div>
      )}

      <div
        ref={scrollRef}
        className="overflow-y-auto p-3 text-[12.5px] leading-[1.7]"
        style={{ height }}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              'whitespace-pre-wrap break-words',
              line.kind === 'error' ? 'text-[#ff6b6b]' : 'text-white/85',
            )}
          >
            {line.content}
          </div>
        ))}

        <div className="relative flex items-baseline gap-2">
          {/* The terminal's ground is physical near-black, not a themed
              surface, so the accent is mixed toward white before it is used as
              text on it — a dark accent reads at 4:1 here otherwise. */}
          <span className="shrink-0 text-[color-mix(in_oklab,var(--color-accent)_75%,#ffffff)]">
            {prompt}
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="whitespace-pre-wrap break-words text-white/85">
              {draft}
              {!busy && (
                <span className="ml-[1px] inline-block h-[1.05em] w-[7px] translate-y-[2px] bg-white/80 align-middle" />
              )}
            </span>
            {/* A real input, so IME, paste and selection behave normally. */}
            <input
              ref={inputRef}
              value={draft}
              disabled={busy}
              spellCheck={false}
              autoComplete="off"
              aria-label="Terminal input"
              onChange={(event) => {
                setDraft(event.target.value)
                // Editing takes you out of history — every shell behaves this
                // way, and without it the next arrow key resumes from wherever
                // the last walk left off rather than from the new line.
                setCursor(-1)
                parked.current = event.target.value
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void run()
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  walk(-1)
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  walk(1)
                } else if (event.key === 'Tab') {
                  event.preventDefault()
                  complete()
                } else if (event.key === 'l' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  setLines([])
                }
              }}
              className="absolute inset-0 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
            />
          </span>
        </div>
      </div>
    </div>
  )
}
