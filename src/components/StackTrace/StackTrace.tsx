'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { CopyButton } from '../CopyButton'
import { ChevronRightIcon } from '../internal/icons'
import { Text } from '../Text'

export type StackTraceFormat = 'v8' | 'firefox' | 'python' | 'unknown'

export interface StackTraceFrame {
  /** Function or method name; empty for anonymous and top-level code. */
  fn: string
  file: string
  line?: number
  column?: number
  /** The source line, when the trace carries it (Python does). */
  code?: string
  /** node_modules, site-packages, runtime internals. */
  library: boolean
  /** The line as it appeared in the trace. */
  raw: string
}

export interface StackTraceParsed {
  format: StackTraceFormat
  /** "TypeError: Cannot read properties of undefined" — the headline. */
  message: string
  frames: StackTraceFrame[]
}

export interface StackTraceProps {
  /** The raw trace — `error.stack` from V8, Firefox or Safari, or a Python traceback. */
  trace: string
  /** Returns a file’s source, to show lines around a frame. May be async; return undefined when unknown. */
  getSource?: (file: string) => string | undefined | Promise<string | undefined>
  /** Lines shown either side of the frame’s line. */
  contextLines?: number
  /** Decides which frames are library code. Defaults to node_modules, site-packages and runtime internals. */
  isLibraryFrame?: (frame: Omit<StackTraceFrame, 'library'>) => boolean
  /** Merged last, so it wins. */
  className?: string
}

const LIBRARY = /node_modules|site-packages|dist-packages|<frozen |^node:|^internal\/|\/lib\/python\d|^native$|<anonymous>|^\[native code\]$|webpack\/bootstrap/

const defaultIsLibrary = (frame: Omit<StackTraceFrame, 'library'>) => LIBRARY.test(frame.file)

const V8 = /^\s*at (?:(.+?) \((.+)\)|(.+))$/
const LOCATION = /^(.*?):(\d+)(?::(\d+))?$/
const GECKO = /^\s*(.*?)@(.*?)(?::(\d+))?(?::(\d+))?\s*$/
const PYTHON = /^\s*File "(.+)", line (\d+)(?:, in (.+))?$/

/**
 * Splits a trace into frames. V8 (`at fn (file:line:col)`), Firefox and Safari
 * (`fn@file:line:col`) and Python (`File "…", line n, in fn`) are recognised; lines
 * that match none of them are part of the message.
 */
function parse(trace: string, isLibrary: StackTraceProps['isLibraryFrame'] = defaultIsLibrary): StackTraceParsed {
  const lines = trace.replace(/\r\n/g, '\n').split('\n')
  const frames: StackTraceFrame[] = []
  const message: string[] = []
  const push = (frame: Omit<StackTraceFrame, 'library'>) => frames.push({ ...frame, library: isLibrary(frame) })

  if (lines.some((line) => PYTHON.test(line))) {
    for (let index = 0; index < lines.length; index += 1) {
      const match = PYTHON.exec(lines[index])
      if (match) {
        const raw = lines[index]
        const next = lines[index + 1]
        const code = next !== undefined && /^\s{4,}\S/.test(next) && !PYTHON.test(next) ? next.trim() : undefined
        if (code !== undefined) index += 1
        push({ fn: match[3] === '<module>' ? '' : match[3] ?? '', file: match[1], line: Number(match[2]), code, raw })
      } else if (lines[index].trim() && !/^\s/.test(lines[index]) && !/^Traceback \(most recent call last\)/.test(lines[index]) && !/^(During handling|The above exception)/.test(lines[index])) {
        message.push(lines[index].trim())
      }
    }
    // Python prints the exception last; the last one is the one that escaped.
    return { format: 'python', message: message[message.length - 1] ?? 'Traceback', frames }
  }

  let format: StackTraceFormat = 'unknown'
  for (const line of lines) {
    const v8 = V8.exec(line)
    if (v8) {
      format = 'v8'
      const fn = (v8[1] ?? '').replace(/^async /, '').replace(/^new /, 'new ')
      const location = (v8[2] ?? v8[3]).trim()
      const where = LOCATION.exec(location)
      push({ fn, file: where ? where[1] : location, line: where ? Number(where[2]) : undefined, column: where?.[3] ? Number(where[3]) : undefined, raw: line })
      continue
    }
    const gecko = line.includes('@') ? GECKO.exec(line) : null
    if (gecko && gecko[2] && (gecko[3] || /^(https?|file|webpack|resource|moz-extension):|\[native code\]/.test(gecko[2]))) {
      format = 'firefox'
      push({ fn: gecko[1] === 'global code' ? '' : gecko[1], file: gecko[2], line: gecko[3] ? Number(gecko[3]) : undefined, column: gecko[4] ? Number(gecko[4]) : undefined, raw: line })
      continue
    }
    if (line.trim() && frames.length === 0) message.push(line.trim())
  }
  return { format, message: message.join(' ') || 'Error', frames }
}

type Group = { kind: 'app'; index: number; frame: StackTraceFrame } | { kind: 'library'; start: number; frames: StackTraceFrame[] }

function Source({ frame, getSource, contextLines }: { frame: StackTraceFrame; getSource: NonNullable<StackTraceProps['getSource']>; contextLines: number }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'done'; source?: string }>({ status: 'loading' })

  const load = useRef(getSource)
  load.current = getSource

  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    Promise.resolve()
      .then(() => load.current(frame.file))
      .then(
        (source) => live && setState({ status: 'done', source }),
        () => live && setState({ status: 'done' }),
      )
    return () => {
      live = false
    }
  }, [frame.file])

  if (state.status === 'loading') return <Text size="caption" tone="faint" className="px-3 py-2" role="status">Loading source…</Text>
  const all = state.source?.split('\n')
  if (!all || frame.line === undefined || frame.line > all.length) {
    return <Text size="caption" tone="faint" className="px-3 py-2">{frame.code ?? 'Source not available for this file.'}</Text>
  }
  const from = Math.max(1, frame.line - contextLines)
  const to = Math.min(all.length, frame.line + contextLines)
  return (
    <pre className="overflow-x-auto bg-surface-sunken py-2 font-mono text-[12px] leading-[1.6]">
      {all.slice(from - 1, to).map((text, offset) => {
        const number = from + offset
        const current = number === frame.line
        return (
          <div key={number} className={cn('flex pr-3', current && 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)]')} aria-current={current ? 'true' : undefined}>
            <span className={cn('w-12 shrink-0 select-none pr-3 text-right', current ? 'font-bold text-danger' : 'text-ink-faint')}>{number}</span>
            <code className={cn('whitespace-pre', current ? 'text-ink' : 'text-ink-soft')}>{text || ' '}</code>
          </div>
        )
      })}
    </pre>
  )
}

/**
 * An error’s stack, parsed into frames so the ones that matter stand out.
 *
 * Browsers, Node and Python each print a trace their own way; this reads all
 * three and shows every frame as function, file and line. Frames in
 * node_modules, site-packages and the runtime are folded into one expandable
 * row per run — a React error is thirty frames of React around the two lines
 * of yours that caused it, and it is those two you came to read. Opening an
 * app frame asks `getSource` for the file and shows the lines around it with
 * the failing one marked; without it, Python’s own quoted line is shown. The
 * raw trace is always one click from the clipboard, because it is what gets
 * pasted into the issue.
 */
export function StackTrace({ trace, getSource, contextLines = 3, isLibraryFrame, className }: StackTraceProps) {
  const parsed = useMemo(() => parse(trace, isLibraryFrame), [trace, isLibraryFrame])
  const groups = useMemo(() => {
    const out: Group[] = []
    parsed.frames.forEach((frame, index) => {
      const last = out[out.length - 1]
      if (frame.library && last?.kind === 'library') last.frames.push(frame)
      else if (frame.library) out.push({ kind: 'library', start: index, frames: [frame] })
      else out.push({ kind: 'app', index, frame })
    })
    return out
  }, [parsed])

  const firstApp = parsed.frames.findIndex((frame) => !frame.library)
  const [openFrames, setOpenFrames] = useState<Set<number>>(() => new Set(firstApp >= 0 && (getSource || parsed.frames[firstApp].code) ? [firstApp] : []))
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set())
  const flip = (set: Set<number>, key: number) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }

  const frameRow = (frame: StackTraceFrame, index: number, muted: boolean) => {
    const open = openFrames.has(index)
    const where = `${frame.file}${frame.line !== undefined ? `:${frame.line}` : ''}${frame.column !== undefined ? `:${frame.column}` : ''}`
    const expandable = !muted && Boolean(getSource || frame.code)
    const label = (
      <>
        <span className={cn('font-mono text-[12px] font-semibold', muted ? 'text-ink-soft' : 'text-ink')}>{frame.fn || '(anonymous)'}</span>
        <span className="min-w-0 break-all font-mono text-[11px] text-ink-faint">{where}</span>
      </>
    )
    return (
      <li key={index} className="border-t border-line first:border-t-0">
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpenFrames((current) => flip(current, index))}
            className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-left hover:bg-surface-muted"
          >
            <ChevronRightIcon size={12} className={cn('shrink-0 self-center text-ink-faint transition-transform motion-reduce:transition-none', open && 'rotate-90')} />
            {label}
          </button>
        ) : (
          <div className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 pr-3', muted ? 'pl-8' : 'pl-[33px]')}>{label}</div>
        )}
        {expandable && open && (getSource ? <Source frame={frame} getSource={getSource} contextLines={contextLines} /> : (
          <pre className="overflow-x-auto bg-surface-sunken px-3 py-2 font-mono text-[12px] text-ink">{frame.code}</pre>
        ))}
      </li>
    )
  }

  const libraryCount = parsed.frames.filter((frame) => frame.library).length

  return (
    <div className={cn('flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface', className)}>
      <div className="flex items-start gap-3 border-b border-line bg-[color-mix(in_oklab,var(--color-danger)_7%,transparent)] px-3 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text size="body" weight="bold" tone="danger" leading="normal" className="break-words font-mono text-[13px]">
            {parsed.message}
          </Text>
          <Text size="caption" tone="faint">
            {`${parsed.frames.length} frames${libraryCount ? ` · ${libraryCount} in libraries` : ''}${parsed.format === 'python' ? ' · most recent call last' : ''}`}
          </Text>
        </div>
        <CopyButton value={trace} label="Copy trace" />
      </div>
      {parsed.frames.length === 0 ? (
        <Text size="label" tone="faint" className="px-3 py-3">No stack frames could be read from this trace.</Text>
      ) : (
        <ol className="flex flex-col" aria-label="Stack frames">
          {groups.map((group) =>
            group.kind === 'app' ? (
              frameRow(group.frame, group.index, false)
            ) : (
              <Fragment key={`group-${group.start}`}>
                <li className="border-t border-line first:border-t-0">
                  <button
                    type="button"
                    aria-expanded={openGroups.has(group.start)}
                    onClick={() => setOpenGroups((current) => flip(current, group.start))}
                    className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-[11px] font-semibold text-ink-faint hover:bg-surface-muted hover:text-ink-soft"
                  >
                    <ChevronRightIcon size={12} className={cn('shrink-0 transition-transform motion-reduce:transition-none', openGroups.has(group.start) && 'rotate-90')} />
                    {`${group.frames.length} library ${group.frames.length === 1 ? 'frame' : 'frames'}`}
                    <span className="min-w-0 truncate font-mono font-medium">
                      {[...new Set(group.frames.map((frame) => /(?:node_modules|site-packages)\/((?:@[^/]+\/)?[^/]+)/.exec(frame.file)?.[1] ?? frame.file.split('/').pop()))].slice(0, 3).join(', ')}
                    </span>
                  </button>
                  {openGroups.has(group.start) && (
                    <ol className="bg-surface-sunken" aria-label={`${group.frames.length} library frames`}>
                      {group.frames.map((frame, offset) => frameRow(frame, group.start + offset, true))}
                    </ol>
                  )}
                </li>
              </Fragment>
            ),
          )}
        </ol>
      )}
    </div>
  )
}
