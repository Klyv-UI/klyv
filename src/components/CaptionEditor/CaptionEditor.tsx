'use client'

import { useEffect, useId, useState, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Input } from '../Input'
import { Textarea } from '../Textarea'
import { Text } from '../Text'
import { CrossIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export interface CaptionEditorCue {
  id: string
  /** Seconds from the start of the media. */
  start: number
  end: number
  text: string
}

export type CaptionEditorFormat = 'vtt' | 'srt'

export interface CaptionEditorProps {
  /** The cues, for a controlled editor. */
  value?: CaptionEditorCue[]
  /** The starting cues, for an uncontrolled one. */
  defaultValue?: CaptionEditorCue[]
  /** Called after every edit, import, add or delete. */
  onValueChange?: (cues: CaptionEditorCue[]) => void
  /** The audio or video being captioned. Its time drives the highlight and the “set” buttons. */
  mediaRef: RefObject<HTMLMediaElement | null>
  /** File name, without extension, used for exports. */
  exportName?: string
  /** Names the editor. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

let counter = 0
const newId = () => `cue-${(counter += 1)}`

/** `75.5` → `01:15.500`; hours appear only when needed. */
export function formatCaptionTime(seconds: number, format: CaptionEditorFormat | 'short' = 'short') {
  const ms = Math.round(Math.max(0, seconds) * 1000)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor(ms / 60_000) % 60
  const s = Math.floor(ms / 1000) % 60
  const pad = (n: number, size = 2) => String(n).padStart(size, '0')
  const tail = `${pad(m)}:${pad(s)}${format === 'srt' ? ',' : '.'}${pad(ms % 1000, 3)}`
  return format === 'short' && h === 0 ? tail : `${pad(h)}:${tail}`
}

/** Accepts `1:02:03.5`, `02:03,500`, `3.25`. Returns null for anything else. */
export function parseCaptionTime(text: string): number | null {
  const match = /^\s*(?:(?:(\d+):)?(\d{1,2}):)?(\d{1,2}(?:[.,]\d{1,3})?)\s*$/.exec(text)
  if (!match) return null
  const [, h = '0', m = '0', s] = match
  return Number(h) * 3600 + Number(m) * 60 + Number(s.replace(',', '.'))
}

/** Reads WebVTT or SRT. Notes, styles and cue settings are skipped; cues come back sorted. */
export function parseCaptions(source: string): CaptionEditorCue[] {
  const time = '((?:\\d+:)?\\d{1,2}:\\d{2}[.,]\\d{1,3})'
  const arrow = new RegExp(`${time}\\s*-->\\s*${time}`)
  const cues: CaptionEditorCue[] = []
  for (const block of source.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const lines = block.split('\n')
    const at = lines.findIndex((line) => arrow.test(line))
    if (at === -1 || /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue
    const [, a, b] = arrow.exec(lines[at])!
    const start = parseCaptionTime(a)
    const end = parseCaptionTime(b)
    if (start === null || end === null) continue
    cues.push({ id: newId(), start, end, text: lines.slice(at + 1).join('\n').trim() })
  }
  return cues.sort((x, y) => x.start - y.start)
}

/** Writes cues as a WebVTT or SRT file. */
export function serializeCaptions(cues: CaptionEditorCue[], format: CaptionEditorFormat): string {
  const body = cues
    .map((cue, index) => `${index + 1}\n${formatCaptionTime(cue.start, format)} --> ${formatCaptionTime(cue.end, format)}\n${cue.text}`)
    .join('\n\n')
  return format === 'vtt' ? `WEBVTT\n\n${body}\n` : `${body}\n`
}

const ClockIcon: IconComponent = ({ size = 16 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 5v3l2 1.5" strokeLinecap="round" />
  </svg>
)
const PlayIcon: IconComponent = ({ size = 16 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M5 3.2v9.6a.6.6 0 00.9.5l7.4-4.8a.6.6 0 000-1L5.9 2.7a.6.6 0 00-.9.5z" />
  </svg>
)

function TimeField({ value, label, onCommit }: { value: number; label: string; onCommit: (seconds: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const invalid = draft !== null && parseCaptionTime(draft) === null
  const commit = () => {
    if (draft === null) return
    const parsed = parseCaptionTime(draft)
    if (parsed !== null) {
      onCommit(parsed)
      setDraft(null)
    }
  }
  return (
    <Input
      inputSize="sm"
      aria-label={label}
      invalid={invalid}
      value={draft ?? formatCaptionTime(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') setDraft(null)
      }}
      containerClassName="w-[112px]"
      className="font-mono tabular-nums"
    />
  )
}

/**
 * Write and time subtitles against the media they belong to.
 *
 * Captions are timing work more than typing work, and typing `00:01:12.480`
 * while scrubbing is how they end up a second late. Each cue's start and end
 * can be stamped from the player's current time, and the cue under the
 * playhead is highlighted as the media plays — so a caption that lands early
 * is visible, not just audible.
 *
 * Problems are flagged where they are, not at export: a cue that ends before
 * it starts, and cues that overlap, which most players render as two lines
 * fighting for the same space. WebVTT and SRT differ by little more than a
 * header and a comma, so both import and export go through the same parser.
 */
export function CaptionEditor({
  value,
  defaultValue = [],
  onValueChange,
  mediaRef,
  exportName = 'captions',
  label = 'Caption editor',
  className,
}: CaptionEditorProps) {
  const [inner, setInner] = useState(defaultValue)
  const cues = value ?? inner
  const [now, setNow] = useState(0)
  const [importing, setImporting] = useState(false)
  const [source, setSource] = useState('')
  const [importError, setImportError] = useState('')
  const importId = useId()

  const commit = (next: CaptionEditorCue[], sort = false) => {
    const ordered = sort ? [...next].sort((a, b) => a.start - b.start) : next
    if (value === undefined) setInner(ordered)
    onValueChange?.(ordered)
  }
  const patch = (id: string, change: Partial<CaptionEditorCue>, sort = false) =>
    commit(cues.map((cue) => (cue.id === id ? { ...cue, ...change } : cue)), sort)

  useEffect(() => {
    const media = mediaRef.current
    if (!media) return
    const sync = () => setNow(media.currentTime)
    const events = ['timeupdate', 'seeked', 'loadedmetadata'] as const
    events.forEach((name) => media.addEventListener(name, sync))
    return () => events.forEach((name) => media.removeEventListener(name, sync))
  }, [mediaRef])

  const seek = (seconds: number) => {
    const media = mediaRef.current
    if (!media) return
    media.currentTime = seconds
    void media.play()?.catch(() => undefined)
  }

  const add = () => {
    const start = Math.round(now * 10) / 10
    commit([...cues, { id: newId(), start, end: start + 2, text: '' }], true)
  }

  const download = (format: CaptionEditorFormat) => {
    const blob = new Blob([serializeCaptions(cues, format)], { type: format === 'vtt' ? 'text/vtt' : 'application/x-subrip' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${exportName}.${format}`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  const runImport = (text: string) => {
    const parsed = parseCaptions(text)
    if (!parsed.length) return setImportError('No cues found. Paste a WebVTT or SRT file with “start --> end” lines.')
    commit(parsed)
    setImporting(false)
    setSource('')
    setImportError('')
  }

  const active = cues.findIndex((cue) => now >= cue.start && now < cue.end)

  return (
    <section aria-label={label} className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={add}>
          Add cue at {formatCaptionTime(now)}
        </Button>
        <Button size="sm" variant="outline" aria-expanded={importing} aria-controls={importId} onClick={() => setImporting(!importing)}>
          Import…
        </Button>
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="muted" onClick={() => download('vtt')} disabled={!cues.length}>
            Export .vtt
          </Button>
          <Button size="sm" variant="muted" onClick={() => download('srt')} disabled={!cues.length}>
            Export .srt
          </Button>
        </span>
      </div>

      <div id={importId} hidden={!importing} className="flex flex-col gap-2 rounded-[var(--radius-tile)] border border-line p-3">
        <Textarea
          aria-label="WebVTT or SRT text"
          placeholder={'WEBVTT\n\n00:00.000 --> 00:02.500\nHello'}
          rows={5}
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="font-mono text-[12px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => runImport(source)} disabled={!source.trim()}>
            Replace cues
          </Button>
          <label className="text-[12px] font-semibold text-ink-soft">
            <span className="mr-2">or open a file</span>
            <input
              type="file"
              accept=".vtt,.srt,text/vtt"
              className="text-[12px]"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (file) runImport(await file.text())
                event.target.value = ''
              }}
            />
          </label>
        </div>
        {importError && (
          <Text size="caption" tone="danger" role="alert">
            {importError}
          </Text>
        )}
      </div>

      {cues.length === 0 ? (
        <Text size="caption" tone="faint" className="rounded-[var(--radius-tile)] border border-dashed border-line p-6 text-center">
          No cues yet. Play the media, pause where a line begins, and add a cue.
        </Text>
      ) : (
        <ol className="flex flex-col gap-2">
          {cues.map((cue, index) => {
            const n = index + 1
            const backwards = cue.end <= cue.start
            const overlap = index > 0 && cues[index - 1].end > cue.start
            return (
              <li
                key={cue.id}
                aria-current={index === active ? 'true' : undefined}
                aria-label={`Cue ${n}`}
                className={cn(
                  'flex flex-col gap-2 rounded-[var(--radius-tile)] border p-2.5 transition-colors',
                  index === active ? 'border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_14%,transparent)]' : 'border-line',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Text as="span" size="caption" weight="bold" tone="faint" tabular className="w-6">
                    {n}
                  </Text>
                  <TimeField value={cue.start} label={`Cue ${n} start`} onCommit={(start) => patch(cue.id, { start }, true)} />
                  <IconButton icon={ClockIcon} size="xs" label={`Set cue ${n} start to current time`} onClick={() => patch(cue.id, { start: now }, true)} />
                  <span aria-hidden="true" className="text-ink-faint">→</span>
                  <TimeField value={cue.end} label={`Cue ${n} end`} onCommit={(end) => patch(cue.id, { end })} />
                  <IconButton icon={ClockIcon} size="xs" label={`Set cue ${n} end to current time`} onClick={() => patch(cue.id, { end: now })} />
                  <span className="ml-auto flex gap-1">
                    <IconButton icon={PlayIcon} size="xs" label={`Play from cue ${n}`} onClick={() => seek(cue.start)} />
                    <IconButton icon={CrossIcon} size="xs" label={`Delete cue ${n}`} onClick={() => commit(cues.filter((c) => c.id !== cue.id))} />
                  </span>
                </div>
                <Textarea
                  aria-label={`Cue ${n} text`}
                  rows={2}
                  value={cue.text}
                  onChange={(event) => patch(cue.id, { text: event.target.value })}
                  className="text-[13px]"
                />
                {(backwards || overlap) && (
                  <Text size="caption" tone={backwards ? 'danger' : 'soft'} weight="semibold">
                    {backwards ? 'Ends before it starts.' : `Overlaps cue ${index} by ${(cues[index - 1].end - cue.start).toFixed(2)}s.`}
                  </Text>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
