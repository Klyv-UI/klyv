'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { IconButton } from '../IconButton'
import { PanZoom, type PanZoomView } from '../PanZoom'
import { ChevronDownIcon, MinusIcon, PlusIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export interface OrgChartPerson {
  id: string
  name: string
  /** Role, printed under the name. */
  title?: string
  /** Photo URL. Initials are shown without one. */
  avatar?: string
  /** Direct reports. */
  children?: OrgChartPerson[]
}

export interface OrgChartProps {
  /** The person at the top. */
  data: OrgChartPerson
  /** Accessible name for the chart. */
  label: string
  /** Ids expanded on first render. Overrides `defaultDepth`. */
  defaultExpanded?: string[]
  /** Without `defaultExpanded`, levels open on first render: 1 shows the top person’s reports. */
  defaultDepth?: number
  /** Selected person’s id. Omit to let the chart track selection itself. */
  selected?: string
  /** Called when a card is clicked or activated with Enter or Space. */
  onSelect?: (id: string) => void
  /** Height of the viewport in pixels. */
  height?: number
  /** Zoom with the mouse wheel. Off by default so the page still scrolls past the chart. */
  wheelZoom?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const FitIcon: IconComponent = ({ size = 16, strokeWidth = 2.25, className }) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
  </svg>
)

const CARD_W = 188
const CARD_H = 60
const GAP_X = 20
const GAP_Y = 44
const PAD = 28

interface Placed {
  person: OrgChartPerson
  x: number
  y: number
  level: number
  parent?: Placed
  position: number
  siblings: number
}

/**
 * A reporting structure drawn top-down as cards, with elbow connectors in one
 * SVG layer underneath.
 *
 * Each subtree is laid out as wide as its widest level and centred over its
 * reports, so a team never overlaps its neighbour and a manager always sits
 * over the people they manage. Teams collapse, because a two-hundred-person
 * company fully expanded is a wall no one reads; the chart opens a couple of
 * levels and lets the reader go further where they care.
 *
 * It sits in a PanZoom viewport, with buttons for zoom since the wheel is left
 * to the page by default. The cards are a real tree for assistive technology:
 * one tab stop, up and down through visible people, right to open a team or
 * step into it, left to close it or step out to the manager. The viewport pans
 * to keep the focused card in view.
 */
export function OrgChart({
  data,
  label,
  defaultExpanded,
  defaultDepth = 2,
  selected: selectedProp,
  onSelect,
  height = 440,
  wheelZoom = false,
  className,
}: OrgChartProps) {
  const [expanded, setExpanded] = useState(() => {
    if (defaultExpanded) return new Set(defaultExpanded)
    const ids = new Set<string>()
    const walk = (person: OrgChartPerson, level: number) => {
      if (level >= defaultDepth || !person.children?.length) return
      ids.add(person.id)
      person.children.forEach((child) => walk(child, level + 1))
    }
    walk(data, 0)
    return ids
  })
  const [ownSelected, setOwnSelected] = useState<string>()
  const selected = selectedProp ?? ownSelected
  const [focused, setFocused] = useState(data.id)
  const [view, setView] = useState<PanZoomView>({ x: 0, y: 0, scale: 1 })
  const frameRef = useRef<HTMLDivElement>(null)
  const moveFocus = useRef(false)
  const cards = useRef(new Map<string, HTMLDivElement | null>())

  const widths = new Map<string, number>()
  const measure = (person: OrgChartPerson): number => {
    const kids = expanded.has(person.id) ? (person.children ?? []) : []
    const inner = kids.reduce((sum, child) => sum + measure(child), 0) + GAP_X * Math.max(0, kids.length - 1)
    const width = Math.max(CARD_W, inner)
    widths.set(person.id, width)
    return width
  }
  const totalWidth = measure(data)

  const placed: Placed[] = []
  const place = (
    person: OrgChartPerson,
    left: number,
    level: number,
    parent: Placed | undefined,
    position: number,
    siblings: number,
  ) => {
    const width = widths.get(person.id) ?? CARD_W
    const node = { person, x: left + width / 2 - CARD_W / 2, y: PAD + level * (CARD_H + GAP_Y), level, parent, position, siblings }
    placed.push(node)
    const kids = expanded.has(person.id) ? (person.children ?? []) : []
    const inner = kids.reduce((sum, child) => sum + (widths.get(child.id) ?? CARD_W), 0) + GAP_X * Math.max(0, kids.length - 1)
    let start = left + (width - inner) / 2
    kids.forEach((child, index) => {
      place(child, start, level + 1, node, index + 1, kids.length)
      start += (widths.get(child.id) ?? CARD_W) + GAP_X
    })
  }
  place(data, PAD, 0, undefined, 1, 1)

  const contentWidth = totalWidth + PAD * 2
  const contentHeight = PAD * 2 + (Math.max(...placed.map((node) => node.level)) + 1) * (CARD_H + GAP_Y) - GAP_Y
  const tabStop = placed.some((node) => node.person.id === focused) ? focused : data.id

  const toggle = (id: string, open?: boolean) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (open ?? !next.has(id)) next.add(id)
      else next.delete(id)
      return next
    })

  const select = (id: string) => {
    setOwnSelected(id)
    onSelect?.(id)
  }

  const zoom = (factor: number) => {
    const box = frameRef.current?.getBoundingClientRect()
    const cx = (box?.width ?? 0) / 2
    const cy = (box?.height ?? height) / 2
    const scale = Math.min(2, Math.max(0.3, view.scale * factor))
    const ratio = scale / view.scale
    setView({ scale, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio })
  }

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    const node = placed.find((entry) => entry.person.id === focused)
    cards.current.get(focused)?.focus({ preventScroll: true })
    const box = frameRef.current?.getBoundingClientRect()
    if (!node || !box) return
    // Pan just enough to bring the card fully into the frame, with a margin.
    const left = view.x + node.x * view.scale
    const top = view.y + node.y * view.scale
    const right = left + CARD_W * view.scale
    const bottom = top + CARD_H * view.scale
    let dx = 0
    let dy = 0
    if (left < 16) dx = 16 - left
    else if (right > box.width - 16) dx = box.width - 16 - right
    if (top < 16) dy = 16 - top
    else if (bottom > box.height - 16) dy = box.height - 16 - bottom
    if (dx || dy) setView({ ...view, x: view.x + dx, y: view.y + dy })
  })

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const node = placed[index]
    const id = node.person.id
    const hasKids = Boolean(node.person.children?.length)
    const isOpen = expanded.has(id)
    const go = (target: Placed | undefined) => {
      if (!target) return
      moveFocus.current = true
      setFocused(target.person.id)
    }
    const actions: Record<string, () => void> = {
      ArrowDown: () => go(placed[index + 1]),
      ArrowUp: () => go(placed[index - 1]),
      Home: () => go(placed[0]),
      End: () => go(placed[placed.length - 1]),
      ArrowRight: () => (hasKids && !isOpen ? toggle(id, true) : hasKids ? go(placed[index + 1]) : undefined),
      ArrowLeft: () => (hasKids && isOpen ? toggle(id, false) : go(node.parent)),
      Enter: () => {
        if (hasKids) toggle(id)
        select(id)
      },
    }
    actions[' '] = actions.Enter
    const action = actions[event.key]
    if (!action) return
    event.preventDefault()
    // PanZoom pans on the same arrow keys; inside the tree they move focus instead.
    event.stopPropagation()
    action()
  }

  return (
    <div ref={frameRef} className={cn('relative w-full', className)} style={{ height }}>
      <PanZoom
        label={`${label}, pan and zoom`}
        contentWidth={contentWidth}
        contentHeight={contentHeight}
        view={view}
        onViewChange={setView}
        min={0.3}
        max={2}
        wheelZoom={wheelZoom}
        className="size-full"
      >
        <div className="relative" style={{ width: contentWidth, height: contentHeight }}>
          <svg
            aria-hidden="true"
            width={contentWidth}
            height={contentHeight}
            className="absolute inset-0 overflow-visible"
          >
            {placed.map(
              (node) =>
                node.parent && (
                  <path
                    key={node.person.id}
                    d={`M${node.parent.x + CARD_W / 2} ${node.parent.y + CARD_H}V${node.y - GAP_Y / 2}H${node.x + CARD_W / 2}V${node.y}`}
                    fill="none"
                    className="stroke-line-strong"
                    strokeWidth="1.5"
                  />
                ),
            )}
          </svg>
          <div role="tree" aria-label={label}>
            {placed.map((node, index) => {
              const { person } = node
              const hasKids = Boolean(person.children?.length)
              const isOpen = expanded.has(person.id)
              const isSelected = person.id === selected
              return (
                <div
                  key={person.id}
                  ref={(element) => {
                    cards.current.set(person.id, element)
                  }}
                  role="treeitem"
                  aria-level={node.level + 1}
                  aria-posinset={node.position}
                  aria-setsize={node.siblings}
                  aria-expanded={hasKids ? isOpen : undefined}
                  aria-selected={isSelected}
                  tabIndex={person.id === tabStop ? 0 : -1}
                  onFocus={() => setFocused(person.id)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setFocused(person.id)
                    if (hasKids) toggle(person.id)
                    select(person.id)
                  }}
                  className={cn(
                    'absolute flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-tile)] border bg-surface px-3',
                    'shadow-[var(--shadow-tile)] transition-colors',
                    isSelected
                      ? 'border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_16%,var(--color-surface))]'
                      : 'border-line hover:border-line-strong',
                  )}
                  style={{ left: node.x, top: node.y, width: CARD_W, height: CARD_H }}
                >
                  <Avatar name={person.name} src={person.avatar} size="xs" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[12px] font-bold text-ink">{person.name}</span>
                    {person.title && <span className="truncate text-[11px] font-medium text-ink-soft">{person.title}</span>}
                  </span>
                  {hasKids && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -bottom-2.5 left-1/2 flex h-5 -translate-x-1/2 items-center gap-0.5 rounded-full',
                        'border border-line bg-surface px-1.5 text-[10px] font-bold text-ink-soft',
                      )}
                    >
                      {person.children?.length}
                      <ChevronDownIcon
                        size={10}
                        className={cn('transition-transform motion-reduce:transition-none', isOpen && 'rotate-180')}
                      />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </PanZoom>

      <div className="absolute right-2 top-2 flex gap-1 rounded-full border border-line bg-surface p-0.5 shadow-[var(--shadow-tile)]">
        <IconButton icon={PlusIcon} label="Zoom in" size="xs" tone="bare" onClick={() => zoom(1.25)} />
        <IconButton icon={MinusIcon} label="Zoom out" size="xs" tone="bare" onClick={() => zoom(0.8)} />
        <IconButton
          icon={FitIcon}
          label="Fit to view"
          size="xs"
          tone="bare"
          onClick={() => {
            const box = frameRef.current?.getBoundingClientRect()
            if (!box) return
            const fit = Math.min(box.width / contentWidth, box.height / contentHeight) * 0.92
            const scale = Math.min(2, Math.max(0.3, fit))
            setView({ scale, x: (box.width - contentWidth * scale) / 2, y: (box.height - contentHeight * scale) / 2 })
          }}
        />
      </div>
    </div>
  )
}
