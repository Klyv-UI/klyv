import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crosshair, Maximize2, Minus, Plus, Search } from 'lucide-react'
import { Badge, Input, SegmentedControl, Text, VisuallyHidden, cn } from 'klyv'
import { loadExamples } from '../examples'
import { componentCount, isNewComponent, isShowpiece } from '../data/catalog'
import { TILE, atlas, tilesIn } from '../lib/atlas'
import { Constellation } from './atlas/Constellation'

/**
 * The atlas: the whole library on one canvas, alive.
 *
 * A catalogue answers "is there a component for this?" one page at a time.
 * This answers it in one look: 617 components laid out group by group, pannable
 * and zoomable like a map. Far out it is a map of the library — you can see how
 * big Forms is next to Charts. Zoom in and the tiles start running: each one
 * mounts its real documentation example, so a control you fly down to is the
 * live component, not a thumbnail of one.
 *
 * Two things keep that affordable. Only the tiles inside the viewport are
 * rendered at all, so panning across 617 of them costs the same as looking at
 * twenty; and a tile only comes alive past a zoom where you could actually read
 * it, with a cap on how many run at once — the nearest to the middle of the
 * screen win. Everything below that is a card with a name, which is also what a
 * visitor who never zooms in gets.
 *
 * The same library has a second shape — what imports what — which the
 * constellation view draws instead.
 */
type Mode = 'map' | 'graph'
const LIVE_SCALE = 0.62
const LIVE_LIMIT = 18
// Low enough that the whole width still fits on a narrow window, where the
// map is a map rather than something to read.
const MIN_SCALE = 0.08
const MAX_SCALE = 1.8

interface View {
  x: number
  y: number
  scale: number
}

export default function AtlasPage() {
  const frameRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 0.34 })
  const [size, setSize] = useState({ width: 1200, height: 700 })
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('map')
  const [live, setLive] = useState(true)
  const dragging = useRef<{ x: number; y: number; viewX: number; viewY: number } | null>(null)
  const tween = useRef(0)
  const navigate = useNavigate()

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => setSize({ width: frame.clientWidth, height: frame.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  /** Move the map so a point in the scene sits in the middle of the frame. */
  const flyTo = useCallback(
    (sceneX: number, sceneY: number, scale: number) => {
      cancelAnimationFrame(tween.current)
      const from = { ...view }
      const to = {
        scale,
        x: size.width / 2 - sceneX * scale,
        y: size.height / 2 - sceneY * scale,
      }
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (still) {
        setView(to)
        return
      }
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 620)
        const eased = 1 - Math.pow(1 - t, 3)
        setView({
          x: from.x + (to.x - from.x) * eased,
          y: from.y + (to.y - from.y) * eased,
          scale: from.scale + (to.scale - from.scale) * eased,
        })
        if (t < 1) tween.current = requestAnimationFrame(step)
      }
      tween.current = requestAnimationFrame(step)
    },
    [size, view],
  )

  useEffect(() => () => cancelAnimationFrame(tween.current), [])

  /**
   * The opening view: the full width of the map, from the top.
   *
   * Fitting its height as well would be honest and useless — the map is far
   * taller than it is wide, so everything would arrive at eight per cent,
   * where a tile is four pixels of nothing. Width is the dimension worth
   * seeing whole; the rest is a pan away.
   */
  const fit = useCallback(() => {
    const scale = Math.max(MIN_SCALE, Math.min(0.5, size.width / (atlas.width + 80)))
    setView({ scale, x: (size.width - atlas.width * scale) / 2, y: 24 })
  }, [size])

  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || size.width < 2) return
    fitted.current = true
    fit()
  }, [fit, size])

  const zoomAt = useCallback((factor: number, originX: number, originY: number) => {
    setView((current) => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current.scale * factor))
      const ratio = scale / current.scale
      return { scale, x: originX - (originX - current.x) * ratio, y: originY - (originY - current.y) * ratio }
    })
  }, [])

  // Wheel pans; wheel with a modifier — or a trackpad pinch, which arrives as
  // one — zooms about the pointer, the way every map does.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = frame.getBoundingClientRect()
      if (event.ctrlKey || event.metaKey) {
        zoomAt(Math.exp(-event.deltaY * 0.01), event.clientX - box.left, event.clientY - box.top)
      } else {
        setView((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }))
      }
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const visible = useMemo(() => {
    const margin = 240
    const rect = {
      x: (-view.x - margin) / view.scale,
      y: (-view.y - margin) / view.scale,
      width: (size.width + margin * 2) / view.scale,
      height: (size.height + margin * 2) / view.scale,
    }
    return tilesIn(rect, 260)
  }, [view, size])

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return null
    return new Set(
      atlas.tiles
        .filter((tile) => tile.entry.name.toLowerCase().includes(term) || tile.entry.blurb.toLowerCase().includes(term))
        .map((tile) => tile.entry.slug),
    )
  }, [query])

  // The nearest few to the middle of the screen are the ones that run.
  const running = useMemo(() => {
    if (!live || view.scale < LIVE_SCALE) return new Set<string>()
    const centreX = (-view.x + size.width / 2) / view.scale
    const centreY = (-view.y + size.height / 2) / view.scale
    return new Set(
      [...visible]
        .sort(
          (a, b) =>
            Math.hypot(a.x + TILE.width / 2 - centreX, a.y + TILE.height / 2 - centreY) -
            Math.hypot(b.x + TILE.width / 2 - centreX, b.y + TILE.height / 2 - centreY),
        )
        .slice(0, LIVE_LIMIT)
        .map((tile) => tile.entry.slug),
    )
  }, [visible, view, size, live])

  /**
   * The best match for what has been typed: a name that starts with it first,
   * then any name that contains it, then a blurb that does.
   */
  const best = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return undefined
    return (
      atlas.tiles.find((tile) => tile.entry.name.toLowerCase().startsWith(term)) ??
      atlas.tiles.find((tile) => tile.entry.name.toLowerCase().includes(term)) ??
      atlas.tiles.find((tile) => tile.entry.slug === [...(matches ?? [])][0])
    )
  }, [query, matches])

  // Typing highlights; Enter flies. Flying on every keystroke would start an
  // animation for each letter, and each one would cancel the last.
  const flyToBest = () => {
    if (!best) return
    flyTo(best.x + TILE.width / 2, best.y + TILE.height / 2, Math.max(view.scale, 0.85))
  }

  return (
    <div className="flex h-[calc(100vh-var(--header,72px)-32px)] min-h-[560px] flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Text as="h1" size="title" className="text-[26px] tracking-[-0.04em]">
            Atlas
          </Text>
          <Text size="caption" tone="soft">
            {mode === 'map'
              ? `Every one of the ${componentCount} components on one canvas. Drag to move, pinch or ⌘-scroll to zoom — and they start running as you get close.`
              : `All ${componentCount} of them as a graph of what imports what, settled by physics. Hover a star to light what it brings, and what uses it.`}
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<Mode>
            label="How to see the library"
            size="sm"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: 'map', label: 'Map' },
              { value: 'graph', label: 'Constellation' },
            ]}
          />
          <span className="relative">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  flyToBest()
                }
              }}
              placeholder="Find a component…"
              aria-label="Find a component on the atlas"
              className="h-9 w-[220px] pl-8 pr-[92px] text-[13px]"
            />
            {matches && (
              <button
                type="button"
                onClick={flyToBest}
                disabled={!best}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-ink transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                {matches.size === 0 ? 'None' : `Fly to ${best?.entry.name ?? ''}`.slice(0, 18)}
              </button>
            )}
          </span>
          {mode === 'map' && (
            <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
              <input type="checkbox" checked={live} onChange={(event) => setLive(event.target.checked)} className="accent-[var(--color-accent)]" />
              <Text as="span" size="caption" weight="semibold">
                Live tiles
              </Text>
            </label>
          )}
        </div>
      </header>

      {mode === 'graph' ? (
        <div className="relative flex-1 select-none overflow-hidden rounded-[var(--radius-window)] border border-line bg-surface-sunken">
          <Constellation query={query} />
        </div>
      ) : (
        <div
          ref={frameRef}
          className={cn(
            'relative flex-1 touch-none select-none overflow-hidden rounded-[var(--radius-window)] border border-line bg-surface-sunken',
            dragging.current ? 'cursor-grabbing' : 'cursor-grab',
          )}
          onPointerDown={(event) => {
            // A press on a tile or on the controls belongs to them: capturing the
            // pointer for a pan would retarget the click away from the button and
            // nothing would ever fire.
            if ((event.target as Element).closest('[data-tile], [data-controls]')) return
            // Without this a drag across the map sweeps a text selection
            // through every tile it crosses.
            event.preventDefault()
            dragging.current = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const start = dragging.current
            if (!start) return
            setView((current) => ({ ...current, x: start.viewX + (event.clientX - start.x), y: start.viewY + (event.clientY - start.y) }))
          }}
          onPointerUp={() => {
            dragging.current = null
          }}
          onPointerCancel={() => {
            dragging.current = null
          }}
        >
          <div aria-hidden className="landing-dots pointer-events-none absolute inset-0 opacity-60" />

          <div
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`, width: atlas.width, height: atlas.height }}
          >
            {atlas.groups.map((group) => (
              <div key={group.id} className="absolute" style={{ left: group.x, top: group.y, width: group.width }}>
                <span className="flex items-baseline gap-3 pb-4">
                  <span className="text-[30px] font-extrabold tracking-[-0.03em] text-ink">{group.id}</span>
                  <span className="font-mono text-[18px] font-bold tabular-nums text-ink-faint">{group.count}</span>
                </span>
              </div>
            ))}

            {visible.map((tile) => (
              <Tile
                key={tile.entry.slug}
                x={tile.x}
                y={tile.y}
                name={tile.entry.name}
                blurb={tile.entry.blurb}
                slug={tile.entry.slug}
                scale={view.scale}
                live={running.has(tile.entry.slug)}
                dimmed={matches ? !matches.has(tile.entry.slug) : false}
                onOpen={() => navigate(`/components/${tile.entry.slug}`)}
              />
            ))}
          </div>

          {/* Controls, and a map of the map. */}
          <div data-controls className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] p-1 shadow-[var(--shadow-float)] backdrop-blur-md">
              <ControlButton label="Zoom out" onClick={() => zoomAt(1 / 1.35, size.width / 2, size.height / 2)}>
                <Minus size={15} aria-hidden />
              </ControlButton>
              <span className="min-w-[52px] text-center font-mono text-[12px] font-bold tabular-nums text-ink-soft">
                {Math.round(view.scale * 100)}%
              </span>
              <ControlButton label="Zoom in" onClick={() => zoomAt(1.35, size.width / 2, size.height / 2)}>
                <Plus size={15} aria-hidden />
              </ControlButton>
              <ControlButton label="Fit the width of the library" onClick={fit}>
                <Maximize2 size={14} aria-hidden />
              </ControlButton>
              <ControlButton
                label="Fly somewhere at random"
                onClick={() => {
                  const tile = atlas.tiles[Math.floor(Math.random() * atlas.tiles.length)]
                  flyTo(tile.x + TILE.width / 2, tile.y + TILE.height / 2, 0.9)
                }}
              >
                <Crosshair size={14} aria-hidden />
              </ControlButton>
            </div>

            <Minimap view={view} size={size} onJump={(x, y) => flyTo(x, y, view.scale)} />
          </div>

          {view.scale < LIVE_SCALE && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-line bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] px-3 py-1.5 shadow-[var(--shadow-tile)] backdrop-blur-md">
              <Text as="span" size="caption" tone="soft" className="text-[12px]">
                Zoom in and the components start running
              </Text>
            </div>
          )}
        </div>
      )}

      <VisuallyHidden>
        <p>
          The atlas is a pointer-driven map. Every component it shows is listed, with a link and a description, on the
          components page.
        </p>
      </VisuallyHidden>
    </div>
  )
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
      <VisuallyHidden>{label}</VisuallyHidden>
    </button>
  )
}

/* ------------------------------------------------------------------ tile */

function Tile({
  x,
  y,
  name,
  blurb,
  slug,
  scale,
  live,
  dimmed,
  onOpen,
}: {
  x: number
  y: number
  name: string
  blurb: string
  slug: string
  scale: number
  live: boolean
  dimmed: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      data-tile
      onClick={onOpen}
      style={{ left: x, top: y, width: TILE.width, height: TILE.height }}
      className={cn(
        'absolute flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface text-left transition-[opacity,border-color] hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        dimmed && 'opacity-25',
      )}
    >
      <span className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <span className="truncate font-mono text-[12px] font-bold text-ink">{name}</span>
        {isShowpiece(name) ? <Badge>Showpiece</Badge> : isNewComponent(name) && <Badge>New</Badge>}
      </span>
      <span className="relative min-h-0 flex-1">
        {live ? (
          <LiveTile slug={slug} />
        ) : (
          <span className="flex h-full items-start p-3">
            <span className={cn('line-clamp-3 text-[12px] leading-snug text-ink-soft', scale < 0.3 && 'opacity-0')}>{blurb}</span>
          </span>
        )}
      </span>
    </button>
  )
}

/**
 * A tile that runs the component.
 *
 * It mounts the first specimen from the component's own documentation page —
 * the same node, not a copy of it — scaled to fit the tile, and never takes
 * the pointer: the tile is a link to the page, and a half-size checkbox is no
 * place to try to click one. Anything that fails to load says so quietly and
 * leaves the tile as it was.
 */
function LiveTile({ slug }: { slug: string }) {
  const [node, setNode] = useState<ReactNode | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    setNode(null)
    setFailed(false)
    loadExamples(slug)
      .then((examples) => {
        if (!live || !examples) {
          if (live) setFailed(true)
          return
        }
        const section = examples.sections.find((entry) => entry.specimens && entry.specimens.length > 0)
        const specimen = section?.specimens?.[0]?.node
        if (specimen) {
          setNode(specimen)
          return
        }
        const Content = examples.sections.find((entry) => entry.Content)?.Content
        if (Content) setNode(<Content />)
        else setFailed(true)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [slug])

  if (failed) return null
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden p-2">
      <span className="w-[calc(100%/0.72)] origin-center scale-[0.72]">
        <TileBoundary>{node}</TileBoundary>
      </span>
    </span>
  )
}

/** One tile failing is not the map failing. */
class TileBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/* --------------------------------------------------------------- minimap */

function Minimap({ view, size, onJump }: { view: View; size: { width: number; height: number }; onJump: (x: number, y: number) => void }) {
  const width = 180
  const scale = width / atlas.width
  const height = atlas.height * scale

  return (
    <div
      role="presentation"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        onJump((event.clientX - box.left) / scale, (event.clientY - box.top) / scale)
      }}
      className="pointer-events-auto relative hidden shrink-0 cursor-pointer overflow-hidden rounded-[var(--radius-tile)] border border-line bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] shadow-[var(--shadow-float)] backdrop-blur-md md:block"
      style={{ width, height: Math.min(height, 220) }}
    >
      {atlas.groups.map((group) => (
        <span
          key={group.id}
          className="absolute rounded-[2px] bg-[color-mix(in_oklab,var(--color-ink)_12%,transparent)]"
          style={{ left: group.x * scale, top: group.y * scale, width: group.width * scale, height: group.height * scale }}
        />
      ))}
      <span
        className="absolute rounded-[3px] border-2 border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)]"
        style={{
          left: (-view.x / view.scale) * scale,
          top: (-view.y / view.scale) * scale,
          width: (size.width / view.scale) * scale,
          height: (size.height / view.scale) * scale,
        }}
      />
    </div>
  )
}
