'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { Surface } from '../Surface'
import { Text } from '../Text'

export interface MentionOption {
  id: string
  /** Inserted after the trigger character. */
  value: string
  label: string
  hint?: string
}

export interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  /** People, channels, tickets — anything the trigger character introduces. */
  options: MentionOption[]
  /** Accessible name for the field. */
  label: string
  /** Character that opens the list. */
  trigger?: string
  /** Shown while empty. */
  placeholder?: string
  /** Visible rows, as on a textarea. */
  rows?: number
  /** Called with the option each time one is inserted. */
  onMention?: (option: MentionOption) => void
  /** Merged last, so it wins. */
  className?: string
}

/** Properties the mirror must copy for its text to wrap identically. */
const MIRRORED = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'wordSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'boxSizing',
] as const

/**
 * A textarea where typing `@` opens a list, and choosing from it inserts a
 * mention.
 *
 * The list is positioned at the caret, not under the field. Getting that right
 * means knowing where the caret is in pixels, and a textarea will not say — so
 * a hidden mirror element copies the field's metrics, receives the text up to
 * the caret plus a marker span, and the marker's offset *is* the caret
 * position. It is the only technique that survives wrapped lines, and it is why
 * most implementations settle for a list pinned to the bottom of the field.
 *
 * The query is the run of characters between the trigger and the caret, and it
 * closes on whitespace — so `@sa` searches and `@sarah rosewood ` does not
 * reopen the list halfway through a sentence.
 *
 * While the list is open the textarea keeps focus and drives it through
 * `aria-activedescendant`, which is the combobox pattern: arrows and Enter go
 * to the list, every other key goes to the text, and focus never moves.
 */
export function MentionInput({
  value,
  onChange,
  options,
  label,
  trigger = '@',
  placeholder,
  rows = 4,
  onMention,
  className,
}: MentionInputProps) {
  const id = useId()
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState<{ text: string; at: number } | null>(null)
  const [caret, setCaret] = useState({ left: 0, top: 0 })
  const [active, setActive] = useState(0)

  const matches = query
    ? options
        .filter((option) =>
          `${option.label} ${option.value}`.toLowerCase().includes(query.text.toLowerCase()),
        )
        .slice(0, 6)
    : []
  const open = query !== null && matches.length > 0

  /** The trigger run immediately before the caret, if there is one. */
  const readQuery = (text: string, position: number) => {
    const before = text.slice(0, position)
    const at = before.lastIndexOf(trigger)
    if (at === -1) return null
    const run = before.slice(at + trigger.length)
    // Whitespace ends a mention, so a finished sentence cannot reopen the list.
    if (/\s/.test(run)) return null
    // Must start a word, or it is an email address rather than a mention.
    if (at > 0 && !/\s/.test(before[at - 1])) return null
    return { text: run, at }
  }

  useIsomorphicLayoutEffect(() => {
    const area = areaRef.current
    const mirror = mirrorRef.current
    if (!area || !mirror || !query) return

    // Copy the metrics that decide where text wraps, then measure a marker.
    const styles = getComputedStyle(area)
    for (const property of MIRRORED) mirror.style[property] = styles[property]
    mirror.style.width = `${area.clientWidth}px`

    mirror.textContent = value.slice(0, query.at)
    const marker = document.createElement('span')
    marker.textContent = trigger + query.text
    mirror.appendChild(marker)

    setCaret({
      left: marker.offsetLeft,
      top: marker.offsetTop + marker.offsetHeight - area.scrollTop,
    })
  }, [query, trigger, value])

  useEffect(() => {
    setActive(0)
  }, [query?.text])

  const insert = (option: MentionOption) => {
    const area = areaRef.current
    if (!query || !area) return
    const before = value.slice(0, query.at)
    const after = value.slice(query.at + trigger.length + query.text.length)
    const inserted = `${trigger}${option.value} `
    onChange(before + inserted + after)
    onMention?.(option)
    setQuery(null)
    requestAnimationFrame(() => {
      const position = before.length + inserted.length
      area.focus()
      area.setSelectionRange(position, position)
    })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % matches.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + matches.length) % matches.length)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      insert(matches[active])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setQuery(null)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <textarea
        ref={areaRef}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        // A textarea keeps its native textbox role: ARIA does not allow
        // `combobox` on it, and `aria-expanded` is not valid on a textbox. What
        // a multi-line field can legally carry still announces the list —
        // autocomplete says one exists, controls points at it while it is open,
        // and activedescendant walks through it.
        aria-autocomplete="list"
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-option-${matches[active]?.id}` : undefined}
        onChange={(event) => {
          onChange(event.target.value)
          setQuery(readQuery(event.target.value, event.target.selectionStart))
        }}
        onClick={(event) =>
          setQuery(readQuery(value, event.currentTarget.selectionStart))
        }
        onKeyUp={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            setQuery(readQuery(value, event.currentTarget.selectionStart))
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => window.setTimeout(() => setQuery(null), 120)}
        className={cn(
          'w-full resize-y rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-3 text-[13px] font-medium leading-normal text-ink',
          'placeholder:text-ink-faint',
        )}
      />

      {/* Never shown. Its only job is to tell us where the caret is. */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre-wrap break-words"
      />

      {open && (
        <Surface
          variant="floating"
          id={`${id}-list`}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-[var(--z-popover)] max-h-[220px] w-[260px] overflow-y-auto border border-line p-1"
          style={{ left: caret.left, top: caret.top + 6 }}
        >
          {matches.map((option, index) => (
            <button
              key={option.id}
              id={`${id}-option-${option.id}`}
              type="button"
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => insert(option)}
              onPointerEnter={() => setActive(index)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[var(--radius-10)] px-2 py-1.5 text-left transition-colors',
                index === active ? 'bg-surface-muted' : 'hover:bg-surface-muted',
              )}
            >
              <Avatar name={option.label} size="xs" />
              <span className="flex min-w-0 flex-col">
                <Text as="span" size="body" truncate>
                  {option.label}
                </Text>
                {option.hint && (
                  <Text as="span" size="caption" tone="faint" truncate>
                    {option.hint}
                  </Text>
                )}
              </span>
            </button>
          ))}
        </Surface>
      )}
    </div>
  )
}
