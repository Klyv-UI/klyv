'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'

export interface MagicTabItem {
  value: string
  label: string
  icon?: IconComponent
  /** Small count shown after the label — unread, results, errors. */
  count?: number
  disabled?: boolean
}

export type MagicTabsVariant = 'pill' | 'underline'

export interface MagicTabsProps {
  items: MagicTabItem[]
  value: string
  onValueChange: (value: string) => void
  /** Accessible name for the tab list. */
  label: string
  variant?: MagicTabsVariant
  /** Control height. */
  size?: 'sm' | 'md'
  /** Spread the tabs across the full width. */
  fullWidth?: boolean
  /** Ties the list to its panel — set the same id on the panel. */
  panelId?: string
  /** Merged last, so it wins. */
  className?: string
}

const SIZES = {
  sm: { tab: 'h-8 px-3 text-[12px]', gap: 'gap-0.5' },
  md: { tab: 'h-10 px-4 text-[13px]', gap: 'gap-1' },
} as const

/**
 * Tabs whose indicator physically slides from the old tab to the new one.
 *
 * `SegmentedControl` cross-fades a background; this measures. The indicator is
 * one absolutely positioned element that reads the selected tab's box and
 * animates `transform` and `width` to match — which is what lets it travel
 * across tabs of different widths, and what makes the movement legible as
 * *from here, to there* rather than as two things changing colour.
 *
 * The measurement is taken in `useLayoutEffect` so the indicator is never
 * painted in the wrong place for a frame, and re-taken by a `ResizeObserver`,
 * so it survives a font load, a container resize and a count appearing in a
 * label. A second, quieter indicator follows the pointer, so hovering shows
 * where a click would land before it lands there.
 *
 * Semantics are a real tab list: `role="tablist"`, roving `tabindex`, arrow
 * keys with Home and End, and `aria-selected` on the chosen tab.
 */
export function MagicTabs({
  items,
  value,
  onValueChange,
  label,
  variant = 'pill',
  size = 'md',
  fullWidth = false,
  panelId,
  className,
}: MagicTabsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  const [indicator, setIndicator] = useState<{ x: number; width: number } | null>(null)
  const [hover, setHover] = useState<{ x: number; width: number } | null>(null)

  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  )

  useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current
      const tab = tabsRef.current[selectedIndex]
      if (!list || !tab) return
      setIndicator({ x: tab.offsetLeft, width: tab.offsetWidth })
    }
    measure()

    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    for (const tab of tabsRef.current) if (tab) observer.observe(tab)
    return () => observer.disconnect()
  }, [items, selectedIndex])

  // Fonts land after the first paint and change every tab width with them.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (!fonts) return
    let cancelled = false
    fonts.ready.then(() => {
      const tab = tabsRef.current[selectedIndex]
      if (!cancelled && tab) setIndicator({ x: tab.offsetLeft, width: tab.offsetWidth })
    })
    return () => {
      cancelled = true
    }
  }, [selectedIndex])

  const focusTab = (index: number) => {
    const next = (index + items.length) % items.length
    tabsRef.current[next]?.focus()
    if (!items[next].disabled) onValueChange(items[next].value)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') focusTab(0)
    else if (event.key === 'End') focusTab(items.length - 1)
    else focusTab(selectedIndex + (event.key === 'ArrowRight' ? 1 : -1))
  }

  const isPill = variant === 'pill'

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      onPointerLeave={() => setHover(null)}
      className={cn(
        'relative inline-flex isolate',
        SIZES[size].gap,
        isPill && 'rounded-full border border-line bg-surface-muted p-1',
        !isPill && 'border-b border-line',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {/* The hover ghost, behind the real indicator. */}
      <span
        aria-hidden="true"
        className={cn(
          'motion-safe-only pointer-events-none absolute -z-10 transition-all duration-[var(--duration-fast)] ease-out',
          isPill ? 'rounded-full bg-surface/70' : 'rounded-[8px] bg-surface-muted',
          hover ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          transform: `translateX(${hover?.x ?? 0}px)`,
          width: hover?.width ?? 0,
          top: 4,
          bottom: 4,
          left: 0,
        }}
      />

      <span
        aria-hidden="true"
        className={cn(
          'motion-safe-only pointer-events-none absolute -z-10 transition-[transform,width] duration-[var(--duration-slow)] ease-[cubic-bezier(0.32,0.72,0,1)]',
          isPill
            ? 'rounded-full bg-surface shadow-[var(--shadow-tile)]'
            : 'rounded-full bg-ink',
          indicator ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          transform: `translateX(${indicator?.x ?? 0}px)`,
          width: indicator?.width ?? 0,
          top: isPill ? 4 : undefined,
          bottom: isPill ? 4 : -1,
          height: isPill ? undefined : 2,
          left: 0,
        }}
      />

      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => {
              tabsRef.current[index] = node
            }}
            type="button"
            role="tab"
            id={panelId ? `${panelId}-tab-${item.value}` : undefined}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            onPointerEnter={(event) => {
              const node = event.currentTarget
              setHover({ x: node.offsetLeft, width: node.offsetWidth })
            }}
            className={cn(
              'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-bold transition-colors duration-[var(--duration-fast)]',
              'disabled:pointer-events-none disabled:opacity-40',
              SIZES[size].tab,
              selected ? 'text-ink' : 'text-ink-soft hover:text-ink',
              fullWidth && 'flex-1',
            )}
          >
            {item.icon && <item.icon size={15} strokeWidth={2.25} aria-hidden="true" />}
            {item.label}
            {typeof item.count === 'number' && (
              <Text
                as="span"
                size="micro"
                tabular
                className={cn(
                  'inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 transition-colors',
                  selected ? 'bg-accent text-accent-ink' : 'bg-surface-muted text-ink-faint',
                )}
              >
                {item.count}
              </Text>
            )}
          </button>
        )
      })}
    </div>
  )
}
