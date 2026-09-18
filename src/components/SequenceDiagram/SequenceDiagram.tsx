'use client'

import { useId, useMemo } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'
import { PlotAnnouncer, svgId, useChartCursor } from '../internal/plot'

export interface SequenceDiagramError {
  /** 1-based line number in the source. */
  line: number
  message: string
}

export interface SequenceDiagramParticipant {
  id: string
  label: string
}

export type SequenceDiagramEvent =
  | { kind: 'message'; line: number; from: string; to: string; text: string; reply: boolean; activate?: '+' | '-' }
  | { kind: 'note'; line: number; side: 'over' | 'left' | 'right'; of: string[]; text: string }
  | { kind: 'open'; line: number; block: 'alt' | 'opt' | 'loop'; text: string }
  | { kind: 'else'; line: number; text: string }
  | { kind: 'close'; line: number }
  | { kind: 'activate' | 'deactivate'; line: number; of: string }

export interface SequenceDiagramProps {
  /**
   * The diagram as text. One statement per line: `participant A as Alice`,
   * `A->B: message`, `B-->A: reply`, `A->+B` / `B-->-A` to activate and
   * deactivate, `note over A,B: text`, `note left of A: text`, `alt` / `else` /
   * `opt` / `loop` … `end`, `activate A`, `deactivate A`. `#` starts a comment.
   */
  source: string
  /** Accessible name for the diagram. */
  label: string
  /** Print the numbered text version under the diagram instead of only exposing it to assistive tech. */
  showTranscript?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const ID = '([A-Za-z_][\\w.]*)'
const MESSAGE = new RegExp(`^${ID}\\s*(-->|->)\\s*([+-]?)\\s*${ID}\\s*:\\s*(.*)$`)
const PARTICIPANT = new RegExp(`^(?:participant|actor)\\s+${ID}(?:\\s+as\\s+(.+))?$`, 'i')
const NOTE = new RegExp(`^note\\s+(over|left of|right of)\\s+${ID}(?:\\s*,\\s*${ID})?\\s*:\\s*(.*)$`, 'i')
const BLOCK = /^(alt|opt|loop)\b\s*(.*)$/i
const ELSE = /^else\b\s*(.*)$/i
const ACTIVATION = new RegExp(`^(activate|deactivate)\\s+${ID}$`, 'i')

/**
 * Reads the text syntax into participants and events, collecting every error
 * with its line number instead of stopping at the first one. Lines that fail
 * are skipped, so the rest of the diagram still draws while someone types.
 */
export function parseSequenceDiagram(source: string) {
  const participants: SequenceDiagramParticipant[] = []
  const events: SequenceDiagramEvent[] = []
  const errors: SequenceDiagramError[] = []
  const open: { block: string; line: number }[] = []
  const active = new Map<string, number>()
  const known = (id: string) => {
    if (!participants.some((entry) => entry.id === id)) participants.push({ id, label: id })
  }
  const deactivate = (id: string, line: number) => {
    const depth = active.get(id) ?? 0
    if (depth === 0) errors.push({ line, message: `${id} is not active, so it cannot be deactivated.` })
    else active.set(id, depth - 1)
    return depth > 0
  }

  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    const text = raw.replace(/\s+#.*$/, '').trim()
    if (!text || text.startsWith('#')) return
    let match: RegExpMatchArray | null
    if ((match = text.match(PARTICIPANT))) {
      const existing = participants.find((entry) => entry.id === match![1])
      if (existing) existing.label = match[2]?.trim() || existing.label
      else participants.push({ id: match[1], label: match[2]?.trim() || match[1] })
    } else if ((match = text.match(NOTE))) {
      const of = [match[2], match[3]].filter(Boolean) as string[]
      of.forEach(known)
      const side = match[1].toLowerCase().startsWith('left') ? 'left' : match[1].toLowerCase() === 'over' ? 'over' : 'right'
      events.push({ kind: 'note', line, side, of, text: match[4].trim() })
    } else if ((match = text.match(ACTIVATION))) {
      known(match[2])
      if (match[1].toLowerCase() === 'activate') {
        active.set(match[2], (active.get(match[2]) ?? 0) + 1)
        events.push({ kind: 'activate', line, of: match[2] })
      } else if (deactivate(match[2], line)) events.push({ kind: 'deactivate', line, of: match[2] })
    } else if ((match = text.match(MESSAGE))) {
      const [, from, arrow, mark, to, label] = match
      known(from)
      known(to)
      if (!label.trim()) errors.push({ line, message: `The message from ${from} to ${to} has no text after the colon.` })
      let activate: '+' | '-' | undefined = mark ? (mark as '+' | '-') : undefined
      if (activate === '+') active.set(to, (active.get(to) ?? 0) + 1)
      if (activate === '-' && !deactivate(from, line)) activate = undefined
      events.push({ kind: 'message', line, from, to, text: label.trim(), reply: arrow === '-->', activate })
    } else if ((match = text.match(BLOCK))) {
      open.push({ block: match[1].toLowerCase(), line })
      events.push({ kind: 'open', line, block: match[1].toLowerCase() as 'alt', text: match[2].trim() })
    } else if ((match = text.match(ELSE))) {
      if (open[open.length - 1]?.block !== 'alt') errors.push({ line, message: '“else” only belongs inside an alt block.' })
      else events.push({ kind: 'else', line, text: match[1].trim() })
    } else if (/^end$/i.test(text)) {
      if (!open.pop()) errors.push({ line, message: '“end” has no alt, opt or loop to close.' })
      else events.push({ kind: 'close', line })
    } else {
      const hint = /->/.test(text) && !text.includes(':') ? ' Messages need a colon: A->B: text.' : ''
      errors.push({ line, message: `Could not read “${text.slice(0, 40)}”.${hint}` })
    }
  })
  for (const block of open.reverse()) {
    errors.push({ line: block.line, message: `The ${block.block} block opened here is never closed with “end”.` })
    events.push({ kind: 'close', line: block.line })
  }
  errors.sort((a, b) => a.line - b.line)
  return { participants, events, errors }
}

const GAP = 160
const MARGIN = 90
const HEAD = 44

/**
 * A sequence diagram written as text, drawn as SVG.
 *
 * Diagrams that live in docs change with the code, and redrawing boxes in a
 * design tool every time is why they go stale. Writing `A->B: message` keeps
 * them in version control and in review. The parser is small and strict: every
 * line it cannot read is reported with its number, and the lines it can read
 * still draw, so a typo does not blank the diagram.
 *
 * The same events produce a numbered list, which is the diagram for anyone who
 * cannot see it. The SVG is one tab stop; arrow keys step through the messages
 * in order and announce each one.
 */
export function SequenceDiagram({ source, label, showTranscript = false, className }: SequenceDiagramProps) {
  const listId = useId()
  const marker = svgId(`${listId}arrow`)
  const { participants, events, errors } = useMemo(() => parseSequenceDiagram(source), [source])
  const column = new Map(participants.map((entry, index) => [entry.id, MARGIN + index * GAP]))
  const xOf = (id: string) => column.get(id) ?? MARGIN
  const nameOf = (id: string) => participants.find((entry) => entry.id === id)?.label ?? id
  const width = Math.max(360, MARGIN * 2 + (participants.length - 1) * GAP)

  // Walk the events once, handing each a y and collecting activation bars and block frames.
  let y = HEAD + 22
  const rows: { event: SequenceDiagramEvent; y: number }[] = []
  const bars: { x: number; y0: number; y1: number; depth: number }[] = []
  const frames: { block: string; text: string; y0: number; y1: number; elses: { y: number; text: string }[]; depth: number }[] = []
  const stack: (typeof frames)[number][] = []
  const opened = new Map<string, number[]>()
  const start = (id: string, at: number) => opened.set(id, [...(opened.get(id) ?? []), at])
  const stop = (id: string, at: number) => {
    const list = opened.get(id) ?? []
    const from = list.pop()
    if (from !== undefined) bars.push({ x: xOf(id), y0: from, y1: at, depth: list.length })
  }
  for (const event of events) {
    if (event.kind === 'message') {
      const self = event.from === event.to
      y += 14
      rows.push({ event, y })
      if (event.activate === '+') start(event.to, y)
      if (event.activate === '-') stop(event.from, y)
      y += self ? 34 : 22
    } else if (event.kind === 'note') {
      rows.push({ event, y: y + 4 })
      y += 38
    } else if (event.kind === 'open') {
      const frame = { block: event.block, text: event.text, y0: y, y1: y, elses: [], depth: stack.length }
      frames.push(frame)
      stack.push(frame)
      y += 26
    } else if (event.kind === 'else') {
      stack[stack.length - 1]?.elses.push({ y, text: event.text })
      y += 24
    } else if (event.kind === 'close') {
      const frame = stack.pop()
      if (frame) frame.y1 = y + 4
      y += 14
    } else if (event.kind === 'activate') start(event.of, y)
    else stop(event.of, y)
  }
  for (const [id, list] of opened) while (list.length) stop(id, y)
  const height = y + HEAD + 12

  const messages = rows.filter((row) => row.event.kind === 'message')
  const { active, setActive, keyProps } = useChartCursor(messages.length)
  const current = active === null ? null : messages[active].event

  const sentence = (event: SequenceDiagramEvent) => {
    if (event.kind === 'message')
      return `${nameOf(event.from)} ${event.reply ? 'replies to' : 'to'} ${nameOf(event.to)}: ${event.text}`
    if (event.kind === 'note')
      return `Note ${event.side === 'over' ? 'over' : `${event.side} of`} ${event.of.map(nameOf).join(' and ')}: ${event.text}`
    if (event.kind === 'open') return `${event.block === 'alt' ? 'If' : event.block === 'opt' ? 'Optionally, if' : 'Loop'} ${event.text}`.trim()
    if (event.kind === 'else') return `Otherwise ${event.text}`.trim()
    if (event.kind === 'close') return 'End of block'
    return `${nameOf(event.of)} ${event.kind === 'activate' ? 'becomes active' : 'finishes'}`
  }

  const head = (entry: SequenceDiagramParticipant, top: number) => (
    <g key={`${entry.id}-${top}`}>
      <rect x={xOf(entry.id) - 62} y={top} width="124" height="30" rx="8" className="fill-surface stroke-line-strong" />
      <text x={xOf(entry.id)} y={top + 15} textAnchor="middle" dominantBaseline="central" className="fill-ink text-[12px] font-bold">
        {entry.label}
      </text>
    </g>
  )

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {errors.length > 0 && (
        <div className="rounded-[var(--radius-glyph)] border border-danger/40 bg-[color-mix(in_oklab,var(--color-danger)_8%,transparent)] p-3">
          <p className="text-[12px] font-bold text-danger">
            {errors.length === 1 ? '1 syntax error' : `${errors.length} syntax errors`}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[12px] font-medium text-ink-soft">
            {errors.map((error) => (
              <li key={`${error.line}-${error.message}`}>
                <span className="font-mono font-bold text-ink">Line {error.line}:</span> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="w-full overflow-x-auto">
        <svg
          role="img"
          aria-label={`${label}. ${participants.length} participants, ${messages.length} messages; use arrow keys to step through them.`}
          aria-describedby={listId}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[480px] rounded-[var(--radius-glyph)] outline-offset-2"
          {...keyProps}
        >
          <defs>
            <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="fill-ink-soft" />
            </marker>
          </defs>
          {frames.map((frame) => {
            const inset = frame.depth * 8
            return (
              <g key={`${frame.y0}-${frame.block}`}>
                <rect
                  x={24 + inset}
                  y={frame.y0}
                  width={width - 48 - inset * 2}
                  height={frame.y1 - frame.y0}
                  rx="6"
                  className="fill-[color-mix(in_oklab,var(--color-accent)_6%,transparent)] stroke-line-strong"
                />
                <rect x={24 + inset} y={frame.y0} width="46" height="18" rx="6" className="fill-accent" />
                <text x={47 + inset} y={frame.y0 + 9} textAnchor="middle" dominantBaseline="central" className="fill-accent-ink text-[10px] font-bold">
                  {frame.block}
                </text>
                <text x={78 + inset} y={frame.y0 + 9} dominantBaseline="central" className="fill-ink-soft text-[10px] font-semibold">
                  {frame.text && `[${frame.text}]`}
                </text>
                {frame.elses.map((entry) => (
                  <g key={entry.y}>
                    <line x1={24 + inset} x2={width - 24 - inset} y1={entry.y} y2={entry.y} className="stroke-line-strong" strokeDasharray="4 3" />
                    <text x={32 + inset} y={entry.y + 11} dominantBaseline="central" className="fill-ink-soft text-[10px] font-semibold">
                      {`else${entry.text ? ` [${entry.text}]` : ''}`}
                    </text>
                  </g>
                ))}
              </g>
            )
          })}
          {participants.map((entry) => (
            <line key={entry.id} x1={xOf(entry.id)} x2={xOf(entry.id)} y1={HEAD} y2={height - HEAD} className="stroke-line-strong" strokeDasharray="3 4" />
          ))}
          {bars.map((bar) => (
            <rect
              key={`${bar.x}-${bar.y0}-${bar.depth}`}
              x={bar.x - 5 + bar.depth * 4}
              y={bar.y0}
              width="10"
              height={Math.max(8, bar.y1 - bar.y0)}
              className="fill-accent-soft stroke-accent-strong"
            />
          ))}
          {rows.map(({ event, y: rowY }) => {
            if (event.kind === 'note') {
              const xs = event.of.map(xOf)
              // Wide enough for the text at roughly 6px a character, never narrower than the participants it spans.
              const wide = Math.max(120, event.text.length * 6 + 24)
              const middle = (Math.min(...xs) + Math.max(...xs)) / 2
              const half = Math.max(wide, Math.max(...xs) - Math.min(...xs) + 120) / 2
              const left = event.side === 'left' ? xs[0] - 16 - wide : event.side === 'right' ? xs[0] + 16 : middle - half
              const right = event.side === 'left' ? xs[0] - 16 : event.side === 'right' ? xs[0] + 16 + wide : middle + half
              return (
                <g key={`note-${event.line}`}>
                  <rect x={left} y={rowY} width={right - left} height="28" rx="4" className="fill-[color-mix(in_oklab,var(--color-warning)_16%,var(--color-surface))] stroke-line-strong" />
                  <text x={(left + right) / 2} y={rowY + 14} textAnchor="middle" dominantBaseline="central" className="fill-ink text-[11px] font-medium">
                    {event.text}
                  </text>
                </g>
              )
            }
            if (event.kind !== 'message') return null
            const index = messages.findIndex((row) => row.event === event)
            const lit = index === active
            const from = xOf(event.from)
            const to = xOf(event.to)
            const self = event.from === event.to
            const stroke = cn(lit ? 'stroke-ink' : 'stroke-ink-soft')
            return (
              <g key={`msg-${event.line}`} onPointerEnter={() => setActive(index)}>
                {self ? (
                  <path d={`M${from + 5} ${rowY}h36v18h-36`} fill="none" className={stroke} strokeWidth={lit ? 2 : 1.25} markerEnd={`url(#${marker})`} strokeDasharray={event.reply ? '5 4' : undefined} />
                ) : (
                  <line
                    x1={from + Math.sign(to - from) * 5}
                    x2={to - Math.sign(to - from) * 5}
                    y1={rowY}
                    y2={rowY}
                    className={stroke}
                    strokeWidth={lit ? 2 : 1.25}
                    strokeDasharray={event.reply ? '5 4' : undefined}
                    markerEnd={`url(#${marker})`}
                  />
                )}
                <text
                  x={self ? from + 48 : (from + to) / 2}
                  y={self ? rowY + 9 : rowY - 6}
                  textAnchor={self ? 'start' : 'middle'}
                  dominantBaseline={self ? 'central' : 'auto'}
                  className={cn('text-[11px]', lit ? 'fill-ink font-bold' : 'fill-ink-soft font-medium')}
                >
                  {event.text}
                </text>
              </g>
            )
          })}
          {participants.map((entry) => head(entry, 6))}
          {participants.map((entry) => head(entry, height - HEAD + 6))}
        </svg>
      </div>

      {(() => {
        const list = (
          <ol id={listId} className={cn(showTranscript && 'list-decimal pl-5 text-[12px] font-medium leading-relaxed text-ink-soft')}>
            {events
              .filter((event) => event.kind !== 'activate' && event.kind !== 'deactivate')
              .map((event) => (
                <li key={`${event.kind}-${event.line}`}>{sentence(event)}</li>
              ))}
          </ol>
        )
        return showTranscript ? list : <VisuallyHidden>{list}</VisuallyHidden>
      })()}

      <PlotAnnouncer message={current ? `Step ${(active ?? 0) + 1} of ${messages.length}. ${sentence(current)}` : ''} />
    </div>
  )
}
