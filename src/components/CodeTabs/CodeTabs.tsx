'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { CodeBlock } from '../CodeBlock'
import { CopyButton } from '../CopyButton'
import { Surface } from '../Surface'

export interface CodeTabsItem {
  /** Stable id — also what is remembered under `storageKey`. */
  value: string
  /** The tab's text — "npm", "server.ts". */
  label: string
  code: string
  /** Colour TypeScript and TSX tokens in this tab. */
  highlight?: boolean
}

export interface CodeTabsProps {
  items: CodeTabsItem[]
  /** Controlled selected tab. */
  value?: string
  /** Selected tab on first render when uncontrolled. */
  defaultValue?: string
  /** Called when a tab is chosen, here or in another instance sharing the key. */
  onValueChange?: (value: string) => void
  /**
   * Remember the choice under this key, in this browser and across every
   * CodeTabs on the page that shares it. Omit to remember nothing.
   */
  storageKey?: string
  /** Accessible name for the tab list. */
  label: string
  /** Number the lines. */
  numbered?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const SYNC_EVENT = 'klyv:code-tabs'

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * One snippet in several forms — npm, pnpm and yarn; the client and the
 * server file — with the variant a reader picked remembered.
 *
 * Docs that ask "which package manager?" on every block are asking the same
 * question twenty times. With a `storageKey`, choosing pnpm once switches
 * every block on the page that has a pnpm tab, and the next page opens on it.
 * Blocks without that tab keep their own choice rather than going blank.
 *
 * Storage can be missing or refuse writes (private windows, blocked cookies),
 * so every access is guarded and the tabs work the same without it.
 */
export function CodeTabs({
  items,
  value,
  defaultValue,
  onValueChange,
  storageKey,
  label,
  numbered = false,
  className,
}: CodeTabsProps) {
  const [own, setOwn] = useState(defaultValue ?? items[0]?.value)
  const selectedValue = value ?? own
  const current = items.find((item) => item.value === selectedValue) ?? items[0]
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items
  const changeRef = useRef(onValueChange)
  changeRef.current = onValueChange

  const selectedRef = useRef(selectedValue)
  selectedRef.current = selectedValue

  const adopt = (next: string) => {
    if (next === selectedRef.current || !itemsRef.current.some((item) => item.value === next)) return
    if (value === undefined) setOwn(next)
    changeRef.current?.(next)
  }
  const adoptRef = useRef(adopt)
  adoptRef.current = adopt

  useEffect(() => {
    if (!storageKey) return
    const stored = readStored(storageKey)
    if (stored) adoptRef.current(stored)

    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: string }>).detail
      if (detail?.key === storageKey) adoptRef.current(detail.value)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue) adoptRef.current(event.newValue)
    }
    window.addEventListener(SYNC_EVENT, onSync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync)
      window.removeEventListener('storage', onStorage)
    }
  }, [storageKey])

  const choose = (next: string) => {
    adopt(next)
    if (!storageKey) return
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      // Remembering is a convenience; the tab has already changed.
    }
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { key: storageKey, value: next } }))
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const count = items.length
    const target =
      event.key === 'ArrowRight' ? (index + 1) % count
      : event.key === 'ArrowLeft' ? (index - 1 + count) % count
      : event.key === 'Home' ? 0
      : event.key === 'End' ? count - 1
      : null
    if (target === null) return
    event.preventDefault()
    choose(items[target].value)
    refs.current[target]?.focus()
  }

  if (!current) return null

  return (
    <Surface variant="sunken" className={cn('flex w-full min-w-0 flex-col overflow-hidden', className)}>
      <div className="flex items-center gap-2 border-b border-line pl-1.5 pr-2">
        <div role="tablist" aria-label={label} className="no-scrollbar flex min-w-0 flex-1 overflow-x-auto">
          {items.map((item, index) => {
            const selected = item.value === current.value
            return (
              <button
                key={item.value}
                ref={(node) => {
                  refs.current[index] = node
                }}
                type="button"
                role="tab"
                id={`${base}-tab-${index}`}
                aria-selected={selected}
                aria-controls={`${base}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(item.value)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  '-mb-px h-9 shrink-0 border-b-2 px-2.5 font-mono text-[12px] transition-colors',
                  'focus-visible:outline-offset-[-4px]',
                  selected ? 'border-b-accent-strong font-bold text-ink' : 'border-b-transparent font-medium text-ink-soft hover:text-ink',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
        <CopyButton value={current.code} iconOnly label={`Copy ${current.label}`} size="sm" />
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${items.indexOf(current)}`}>
        <CodeBlock
          code={current.code}
          copyable={false}
          numbered={numbered}
          highlight={current.highlight ?? false}
          className="rounded-none bg-transparent"
        />
      </div>
    </Surface>
  )
}
