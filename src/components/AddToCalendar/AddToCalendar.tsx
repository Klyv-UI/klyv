'use client'

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button, type ButtonSize, type ButtonVariant } from '../Button'
import { ChevronDownIcon } from '../internal/icons'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { Text } from '../Text'

export type AddToCalendarProvider = 'google' | 'outlook' | 'office365' | 'yahoo' | 'ics'

export interface AddToCalendarEvent {
  title: string
  start: Date
  /** Exclusive end. For an all-day event, the day after the last day. */
  end: Date
  /** Dates only, no times. Read in local time. */
  allDay?: boolean
  description?: string
  location?: string
  /** A link back to the event page. Added to the .ics and to the description elsewhere. */
  url?: string
  /** Stable id for the .ics, so re-importing updates rather than duplicates. */
  uid?: string
}

export interface AddToCalendarProps {
  event: AddToCalendarEvent
  /** Which options to list, in order. */
  providers?: AddToCalendarProvider[]
  /** The trigger’s text. */
  label?: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  /** The .ics file name, without the extension. Defaults to a slug of the title. */
  fileName?: string
  /** Show the title, time and place above the options. */
  showSummary?: boolean
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Called after an option is chosen. */
  onSelect?: (provider: AddToCalendarProvider) => void
  /** Merged onto the trigger button. */
  className?: string
}

const pad = (value: number) => String(value).padStart(2, '0')
/** 20261014T153000Z */
const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
/** 20261014, from the local calendar date. */
const dateStamp = (date: Date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const details = (event: AddToCalendarEvent) => [event.description, event.url].filter(Boolean).join('\n\n')

const query = (params: Record<string, string | undefined>) =>
  Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

function outlookLink(host: string, event: AddToCalendarEvent) {
  return `https://${host}/calendar/0/action/compose?${query({
    rru: 'addevent',
    subject: event.title,
    startdt: event.allDay ? isoDate(event.start) : event.start.toISOString(),
    enddt: event.allDay ? isoDate(event.end) : event.end.toISOString(),
    allday: event.allDay ? 'true' : 'false',
    body: details(event),
    location: event.location,
  })}`
}

const LINKS: Record<Exclude<AddToCalendarProvider, 'ics'>, (event: AddToCalendarEvent) => string> = {
  google: (event) =>
    `https://calendar.google.com/calendar/render?${query({
      action: 'TEMPLATE',
      text: event.title,
      dates: event.allDay
        ? `${dateStamp(event.start)}/${dateStamp(event.end)}`
        : `${utcStamp(event.start)}/${utcStamp(event.end)}`,
      details: details(event),
      location: event.location,
    })}`,
  outlook: (event) => outlookLink('outlook.live.com', event),
  office365: (event) => outlookLink('outlook.office.com', event),
  yahoo: (event) =>
    `https://calendar.yahoo.com/?${query({
      v: '60',
      title: event.title,
      st: event.allDay ? dateStamp(event.start) : utcStamp(event.start),
      et: event.allDay ? undefined : utcStamp(event.end),
      dur: event.allDay ? 'allday' : undefined,
      desc: details(event),
      in_loc: event.location,
    })}`,
}

/** RFC 5545 text: backslash, semicolon, comma and newlines escaped. */
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Lines longer than 75 octets are folded with CRLF and a space. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const width = new TextEncoder().encode(char).length
    if (size + width > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += width
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** The .ics text for an event. Exported for callers that want to attach it to an email. */
export function createAddToCalendarIcs(event: AddToCalendarEvent, now: Date = new Date()): string {
  const uid = event.uid ?? `${utcStamp(event.start)}-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@klyv`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Klyv//AddToCalendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(uid)}`,
    `DTSTAMP:${utcStamp(now)}`,
    event.allDay ? `DTSTART;VALUE=DATE:${dateStamp(event.start)}` : `DTSTART:${utcStamp(event.start)}`,
    event.allDay ? `DTEND;VALUE=DATE:${dateStamp(event.end)}` : `DTEND:${utcStamp(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    event.description && `DESCRIPTION:${escapeText(event.description)}`,
    event.location && `LOCATION:${escapeText(event.location)}`,
    event.url && `URL:${event.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => Boolean(line))
  return lines.map(fold).join('\r\n') + '\r\n'
}

const NAMES: Record<AddToCalendarProvider, string> = {
  google: 'Google Calendar',
  outlook: 'Outlook.com',
  office365: 'Office 365',
  yahoo: 'Yahoo Calendar',
  ics: 'Download .ics file',
}

function summaryWhen(event: AddToCalendarEvent) {
  const day: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  if (event.allDay) {
    const last = new Date(event.end.getFullYear(), event.end.getMonth(), event.end.getDate() - 1)
    const first = event.start.toLocaleDateString(undefined, day)
    return last.toDateString() === event.start.toDateString() ? `${first} · All day` : `${first} – ${last.toLocaleDateString(undefined, day)}`
  }
  const time: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  const sameDay = event.start.toDateString() === event.end.toDateString()
  const end = sameDay
    ? event.end.toLocaleTimeString(undefined, { ...time, timeZoneName: 'short' })
    : event.end.toLocaleString(undefined, { ...day, ...time, timeZoneName: 'short' })
  return `${event.start.toLocaleDateString(undefined, day)}, ${event.start.toLocaleTimeString(undefined, time)} – ${end}`
}

const ITEM =
  'flex w-full items-center gap-2.5 rounded-[var(--radius-10)] px-2.5 py-2 text-left text-[13px] font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink focus-visible:bg-surface-muted'

const CalendarGlyph = () => (
  <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="12" height="11" rx="2" />
    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3M8 8.5v3.5M6.25 10.25h3.5" />
  </svg>
)

/**
 * One button that puts an event in whichever calendar the reader uses.
 *
 * There is no single "add to calendar" link on the web. Google, Outlook.com,
 * Office 365 and Yahoo each take their own URL shape, and Apple Calendar,
 * Thunderbird and desktop Outlook only take a file. So the menu lists the web
 * calendars as real links — they open in a new tab and can be middle-clicked —
 * and ends with a generated .ics for everything else. The file is built in
 * the browser: times in UTC so it lands at the right moment in any zone,
 * text escaped and lines folded as RFC 5545 requires, which is where
 * hand-rolled .ics files usually break.
 *
 * The panel repeats what is being added — title, time with its zone, place —
 * so nobody adds the wrong session from a page listing several. It follows
 * the menu pattern: arrows move, Escape closes and focus returns to the button.
 */
export function AddToCalendar({
  event,
  providers = ['google', 'outlook', 'office365', 'yahoo', 'ics'],
  label = 'Add to calendar',
  variant = 'outline',
  size = 'sm',
  fileName,
  showSummary = true,
  placement = 'bottom',
  align = 'start',
  onSelect,
  className,
}: AddToCalendarProps) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const download = () => {
    const name = (fileName ?? event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) || 'event'
    try {
      const blob = new Blob([createAddToCalendarIcs(event)], { type: 'text/calendar;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `${name}.ics`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch {
      // No Blob URLs here (an old embedded browser): nothing to download into.
    }
    onSelect?.('ics')
    setOpen(false)
  }

  const onKeyDown = (keyEvent: KeyboardEvent<HTMLDivElement>) => {
    const nodes = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const at = nodes.indexOf(document.activeElement as HTMLElement)
    const moves: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: nodes.length - 1 }
    if (!(keyEvent.key in moves) || nodes.length === 0) return
    keyEvent.preventDefault()
    nodes[(moves[keyEvent.key] + nodes.length) % nodes.length]?.focus()
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      align={align}
      label={`Add ${event.title} to calendar`}
      initialFocus='[role="menuitem"]'
      className="w-[260px] p-1"
      trigger={
        <Button variant={variant} size={size} aria-haspopup="menu" aria-expanded={open} className={className}>
          <CalendarGlyph />
          {label}
          <ChevronDownIcon size={12} className="-mr-1 opacity-60" />
        </Button>
      }
    >
      {showSummary && (
        <div className="flex flex-col gap-0.5 border-b border-line px-2.5 pb-2.5 pt-2">
          <Text size="body" weight="bold" className="truncate">
            {event.title}
          </Text>
          <Text size="caption" tone="soft" leading="normal">
            {summaryWhen(event)}
          </Text>
          {event.location && (
            <Text size="caption" tone="faint" className="truncate">
              {event.location}
            </Text>
          )}
        </div>
      )}
      <div ref={listRef} role="menu" aria-label="Calendars" onKeyDown={onKeyDown} className={cn('flex flex-col', showSummary && 'pt-1')}>
        {providers.map((provider) =>
          provider === 'ics' ? (
            <button key={provider} type="button" role="menuitem" tabIndex={-1} onClick={download} className={ITEM}>
              {NAMES.ics}
            </button>
          ) : (
            <a
              key={provider}
              role="menuitem"
              tabIndex={-1}
              href={LINKS[provider](event)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onSelect?.(provider)
                setOpen(false)
              }}
              className={ITEM}
            >
              {NAMES[provider]}
            </a>
          ),
        )}
      </div>
    </Popover>
  )
}
