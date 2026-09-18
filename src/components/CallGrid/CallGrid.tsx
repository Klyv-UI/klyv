'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Avatar } from '../Avatar'
import { VisuallyHidden } from '../VisuallyHidden'

export interface CallGridParticipant {
  id: string
  name: string
  /** The live video element, or anything standing in for it. Ignored while `videoOff` is set. */
  video?: ReactNode
  /** Avatar image for the camera-off state. Initials are used without it. */
  avatarSrc?: string
  /** Microphone muted. */
  muted?: boolean
  /** Camera off: the tile shows the avatar instead of video. */
  videoOff?: boolean
  /** Hand raised, shown as a badge and read out first. */
  handRaised?: boolean
}

export interface CallGridLayout {
  columns: number
  rows: number
  /** Tile size in pixels. */
  width: number
  height: number
}

export interface CallGridProps {
  /** Everyone in the call, in display order. */
  participants: CallGridParticipant[]
  /** Accessible name for the list of tiles. */
  label: string
  /** The participant currently speaking. Their tile gets the accent ring. */
  activeSpeakerId?: string | null
  /** Controlled spotlight. Null or undefined shows the grid. */
  pinnedId?: string | null
  /** Initial spotlight, uncontrolled. */
  defaultPinnedId?: string | null
  /** Called with the participant pinned, or null when unpinned. */
  onPinnedChange?: (id: string | null) => void
  /** Width over height of a tile. 16 / 9 matches most cameras. */
  aspectRatio?: number
  /** Space between tiles in pixels. */
  gap?: number
  /** Merged last, so it wins. Give the component a height here. */
  className?: string
}

/**
 * The rows × columns that give each tile the most area in a box, for a fixed tile shape.
 *
 * Every column count from 1 to n is tried: the tile is as wide as a column allows, unless the rows then overflow the
 * height, in which case the height decides. The winner is the largest tile, not the squarest grid — three people in a
 * wide window sit side by side; three people in a phone stack up.
 */
export function callGridLayout(count: number, width: number, height: number, aspectRatio = 16 / 9, gap = 8): CallGridLayout {
  let best: CallGridLayout = { columns: 1, rows: 1, width: 0, height: 0 }
  if (count <= 0 || width <= 0 || height <= 0) return best
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns)
    const cellWidth = (width - gap * (columns - 1)) / columns
    const cellHeight = (height - gap * (rows - 1)) / rows
    if (cellWidth <= 0 || cellHeight <= 0) continue
    const tileWidth = Math.min(cellWidth, cellHeight * aspectRatio)
    if (tileWidth > best.width) best = { columns, rows, width: Math.floor(tileWidth), height: Math.floor(tileWidth / aspectRatio) }
  }
  return best
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

const glyph = (path: ReactNode) => (
  <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
)
const MicOff = glyph(<path d="M6 3.5a2 2 0 0 1 4 0V7M10 9.4A2 2 0 0 1 6 8V7M3.8 7.5a4.2 4.2 0 0 0 7 3M8 12v2M2.5 2.5l11 11" />)
const Hand = glyph(<path d="M5.5 8V3.5a1 1 0 0 1 2 0V7m0-4.5a1 1 0 0 1 2 0V7m0-3a1 1 0 0 1 2 0v4.5c0 3-1.8 5-4.3 5-1.6 0-2.6-.8-3.5-2.1L2.6 9.3a1 1 0 0 1 1.6-1.2l1.3 1.4" />)
const Pin = glyph(<path d="M9.5 2.5l4 4-2 1-2.5 2.5-.5 2.5-5-5 2.5-.5L8.5 4.5zM5.5 10.5l-3 3" />)

/**
 * A video-call layout that works out its own grid: given the participants and the size of the box, it picks the rows
 * and columns that make every tile as large as possible at the camera’s aspect ratio.
 *
 * Fixed breakpoints (“four people is 2 × 2”) waste most of a wide window and letterbox a tall one. Trying every column
 * count is cheap — it is n divisions — and it is exact, so the layout is re-solved on every resize from a
 * ResizeObserver. The last row is centred rather than left-aligned, because a lone tile hanging at the left edge reads
 * as a gap.
 *
 * Pinning someone switches to a spotlight: their tile solves the same problem for the main stage, and everyone else
 * moves to a scrolling filmstrip underneath. The speaker ring, muted, hand-raised and camera-off states are drawn on the
 * tile and also written into it as text, and the tiles are a real list, so a screen reader hears “Ada Park, speaking,
 * muted” instead of nothing.
 */
export function CallGrid({
  participants,
  label,
  activeSpeakerId = null,
  pinnedId,
  defaultPinnedId = null,
  onPinnedChange,
  aspectRatio = 16 / 9,
  gap = 8,
  className,
}: CallGridProps) {
  const [uncontrolledPin, setUncontrolledPin] = useState<string | null>(defaultPinnedId)
  const requestedPin = pinnedId !== undefined ? pinnedId : uncontrolledPin
  const pinned = participants.find((person) => person.id === requestedPin) ?? null
  const [stageRef, measured] = useSize<HTMLDivElement>()
  // Before the first measurement (and where there is no layout at all) solve for a nominal stage, not an empty one.
  const stage = measured.width > 0 && measured.height > 0 ? measured : { width: 640, height: 360 }

  const setPinned = (id: string | null) => {
    if (pinnedId === undefined) setUncontrolledPin(id)
    onPinnedChange?.(id)
  }

  const others = pinned ? participants.filter((person) => person.id !== pinned.id) : participants
  const layout = pinned
    ? callGridLayout(1, stage.width, stage.height, aspectRatio, gap)
    : callGridLayout(participants.length, stage.width, stage.height, aspectRatio, gap)

  const tile = (person: CallGridParticipant, width: number, height: number, compact: boolean) => {
    const speaking = person.id === activeSpeakerId
    const isPinned = person.id === pinned?.id
    const avatarScale = Math.max(0.6, Math.min(2.6, (height * 0.34) / 48))
    const states = [speaking && 'speaking', person.handRaised && 'hand raised', person.muted && 'muted', person.videoOff && 'camera off']
      .filter(Boolean)
      .join(', ')
    return (
      <li
        key={person.id}
        style={{ width, height }}
        className={cn(
          'group relative shrink-0 overflow-hidden rounded-[var(--radius-tile)] bg-surface-sunken outline outline-2 -outline-offset-2',
          speaking ? 'outline-accent-strong' : 'outline-transparent',
          'motion-safe:transition-[outline-color] motion-safe:duration-200',
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {person.videoOff || !person.video ? (
            <span aria-hidden="true" style={{ transform: `scale(${avatarScale})` }} className="inline-flex">
              <Avatar name={person.name} src={person.avatarSrc} size="lg" />
            </span>
          ) : (
            person.video
          )}
        </div>
        <div className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1">
          <span className="flex min-w-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--color-surface)_86%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-ink backdrop-blur-sm">
            {person.muted && <span className="text-danger">{MicOff}</span>}
            <span className="truncate">{person.name}</span>
            {states && <VisuallyHidden>, {states}</VisuallyHidden>}
          </span>
        </div>
        {person.handRaised && (
          <span aria-hidden="true" className="absolute left-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-warning text-accent-ink">
            {Hand}
          </span>
        )}
        <button
          type="button"
          aria-pressed={isPinned}
          aria-label={isPinned ? `Unpin ${person.name}` : `Pin ${person.name}`}
          onClick={() => setPinned(isPinned ? null : person.id)}
          className={cn(
            'absolute right-1.5 top-1.5 inline-flex items-center justify-center rounded-full transition-opacity',
            compact ? 'size-6' : 'size-7',
            isPinned
              ? 'bg-accent text-accent-ink opacity-100'
              : 'bg-[color-mix(in_oklab,var(--color-surface)_86%,transparent)] text-ink opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
          )}
        >
          {Pin}
        </button>
      </li>
    )
  }

  const stripHeight = 96
  const stripWidth = Math.round(stripHeight * aspectRatio * 0.82)

  return (
    <div className={cn('flex h-[420px] w-full min-w-0 flex-col gap-2', className)}>
      <div ref={stageRef} className="relative min-h-0 flex-1">
        <ul
          aria-label={pinned ? `${label}, spotlight` : label}
          className="absolute inset-0 flex flex-wrap content-center items-center justify-center"
          style={{ gap }}
        >
          {(pinned ? [pinned] : participants).map((person) => tile(person, layout.width, layout.height, false))}
        </ul>
      </div>
      {pinned && others.length > 0 && (
        <ul
          aria-label={`${label}, filmstrip`}
          className="flex shrink-0 gap-2 overflow-x-auto pb-1"
          style={{ height: stripHeight + 4 }}
        >
          {others.map((person) => tile(person, stripWidth, stripHeight, true))}
        </ul>
      )}
    </div>
  )
}
