import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, VisuallyHidden, cn } from 'klyv'
import { HUB, buildConstellation, starAt, step, type Constellation as Graph } from '../../lib/constellation'
import { sizes } from '../../data/sizes'

/**
 * The library as a constellation: what imports what, settled by physics.
 *
 * The Atlas shows the shelf; this shows the wiring. Every star is a
 * component, every line a real import, and the clusters are not drawn — they
 * happen, because components that share dependencies are pulled together by
 * the same springs. Hovering lights the whole transitive set a component
 * brings with it, which is the number the size column on the catalogue can
 * only tell you one component at a time.
 *
 * It is drawn on a canvas rather than in the DOM: 617 stars and some two
 * thousand lines are nothing for a canvas and far too much for that many
 * elements, and it lets the settling run at frame rate. The simulation stops
 * on its own once the energy falls away, so a page left open is not a page
 * spinning a fan.
 */
const kB = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

export function Constellation({ query }: { query: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const graph = useMemo<Graph>(() => buildConstellation(), [])
  const [hover, setHover] = useState<number | null>(null)
  const [settled, setSettled] = useState(false)
  const view = useRef({ x: 0, y: 0, scale: 1 })
  /** Until the reader pans or zooms, the view keeps the whole constellation in frame. */
  const adjusted = useRef(false)
  // The simulation effect owns the drawing; everything else asks for a frame
  // through this rather than reaching into the canvas itself.
  const drawRef = useRef<() => void>(() => {})
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const dragging = useRef<{ x: number; y: number; viewX: number; viewY: number } | null>(null)
  const navigate = useNavigate()

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return null
    return new Set(graph.stars.map((star, index) => (star.name.toLowerCase().includes(term) ? index : -1)).filter((index) => index >= 0))
  }, [query, graph])

  const hoverRef = useRef<number | null>(null)
  hoverRef.current = hover
  const matchRef = useRef<Set<number> | null>(null)
  matchRef.current = matches

  /** Canvas space to constellation space. */
  const toGraph = useCallback((clientX: number, clientY: number) => {
    const box = frameRef.current!.getBoundingClientRect()
    const current = view.current
    return {
      x: (clientX - box.left - box.width / 2 - current.x) / current.scale,
      y: (clientY - box.top - box.height / 2 - current.y) / current.scale,
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    if (!canvas || !frame) return
    const context = canvas.getContext('2d')
    if (!context) return

    let alpha = 1
    let running = true
    let frameId = 0
    let width = 0
    let height = 0

    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      width = frame.clientWidth
      height = frame.clientHeight
      canvas.width = width * ratio
      canvas.height = height * ratio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(() => {
      resize()
      draw()
    })
    observer.observe(frame)

    /**
     * A token as a colour the canvas will take.
     *
     * A canvas parses colours itself and does not take every form CSS does,
     * so the element resolves the token first and the canvas is handed what
     * the browser computed. Read per draw, so changing the accent or the
     * theme repaints in the new one.
     */
    const probe = document.createElement('span')
    probe.style.display = 'none'
    frame.appendChild(probe)
    const resolve = (token: string, fallback: string) => {
      probe.style.color = ''
      probe.style.color = `var(${token})`
      return getComputedStyle(probe).color || fallback
    }

    function draw() {
      if (!context) return
      const { x, y, scale } = view.current
      const lit = hoverRef.current
      const brought = lit === null ? null : new Set(graph.brings.get(lit) ?? [])
      // The other direction: everything that imports it. For a hub this is
      // the whole story — Text imports nothing and is used by 248.
      const users = lit === null ? null : new Set(graph.usedBy.get(lit) ?? [])
      const found = matchRef.current

      const ink = resolve('--color-ink', '#17191c')
      const accent = resolve('--color-accent-strong', '#b9e93a')

      // Fit what is there, until someone takes the view over.
      if (!adjusted.current) {
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        for (const star of graph.stars) {
          if (star.x < minX) minX = star.x
          if (star.x > maxX) maxX = star.x
          if (star.y < minY) minY = star.y
          if (star.y > maxY) maxY = star.y
        }
        // The group names sit outside the stars, so the fit takes them in too.
        for (const home of graph.anchors.values()) {
          const length = Math.hypot(home.x, home.y) || 1
          const labelX = home.x + (home.x / length) * 150
          const labelY = home.y + (home.y / length) * 150
          minX = Math.min(minX, labelX - 70)
          maxX = Math.max(maxX, labelX + 70)
          minY = Math.min(minY, labelY - 20)
          maxY = Math.max(maxY, labelY + 20)
        }
        const fit = Math.max(0.2, Math.min(1.4, Math.min(width / (maxX - minX + 80), height / (maxY - minY + 80))))
        view.current = { scale: fit, x: -((minX + maxX) / 2) * fit, y: -((minY + maxY) / 2) * fit }
      }

      context.clearRect(0, 0, width, height)
      context.save()
      context.translate(width / 2 + x, height / 2 + y)
      context.scale(scale, scale)

      // Edges first, so the stars sit on top of their own lines.
      context.lineWidth = 1 / scale
      for (const edge of graph.edges) {
        const from = graph.stars[edge.from]
        const to = graph.stars[edge.to]
        const downstream = lit !== null && (edge.from === lit || brought!.has(edge.from)) && (brought!.has(edge.to) || edge.to === lit)
        const upstream = lit !== null && edge.to === lit && users!.has(edge.from)
        if (lit !== null && !downstream && !upstream) continue
        if (lit === null && (from.imported >= HUB || to.imported >= HUB)) continue
        context.strokeStyle = lit === null ? ink : downstream ? accent : ink
        context.globalAlpha = lit === null ? 0.05 : downstream ? 0.6 : 0.16
        context.beginPath()
        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
        context.stroke()
      }

      context.globalAlpha = 1
      for (let index = 0; index < graph.stars.length; index++) {
        const star = graph.stars[index]
        const isLit = index === lit
        const isBrought = brought?.has(index) ?? false
        const isUser = users?.has(index) ?? false
        const isMatch = found?.has(index) ?? false
        let alphaFor = 1
        if (lit !== null && !isLit && !isBrought && !isUser) alphaFor = 0.1
        else if (found && !isMatch && lit === null) alphaFor = 0.12

        context.globalAlpha = alphaFor
        const isHub = star.imported >= HUB
        const highlighted = isLit || isBrought || isMatch || (isHub && lit === null && !found)
        context.fillStyle = highlighted ? accent : ink
        if (!highlighted) context.globalAlpha = isUser ? 0.85 : alphaFor * 0.4
        if (isHub && lit === null && !found) {
          context.globalAlpha = 0.18
          context.beginPath()
          context.arc(star.x, star.y, star.radius + 10, 0, Math.PI * 2)
          context.fill()
          context.globalAlpha = alphaFor
        }
        context.beginPath()
        context.arc(star.x, star.y, star.radius + (isLit ? 2.5 : isHub ? 2 : 0), 0, Math.PI * 2)
        context.fill()
      }

      // Each group's name over the middle of its own stars, so the regions
      // can be read as the library's sections.
      context.textAlign = 'center'
      context.fillStyle = ink
      context.font = `700 ${15 / scale}px ui-sans-serif, system-ui, sans-serif`
      context.globalAlpha = lit === null ? 0.5 : 0.18
      // Pushed outward from the home, past the region, so the name sits at
      // the region's outer edge rather than on top of its stars.
      for (const [group, home] of graph.anchors) {
        const length = Math.hypot(home.x, home.y) || 1
        const out = 150
        context.fillText(group, home.x + (home.x / length) * out, home.y + (home.y / length) * out)
      }

      // Star names, only where they can be read: the hovered star and what it
      // brings, or at rest the hubs — each one only if it does not land on a
      // name already drawn, which is what turned the middle into mush.
      context.font = `${11 / scale}px ui-monospace, SFMono-Regular, Menlo, monospace`
      const placed: { x: number; y: number; w: number }[] = []
      const clear = (x: number, y: number, w: number) =>
        placed.every((box) => Math.abs(box.x - x) > (box.w + w) / 2 || Math.abs(box.y - y) > 14 / scale)
      const order = [...graph.stars.keys()].sort((a, b) => graph.stars[b].imported - graph.stars[a].imported)
      for (const index of order) {
        const star = graph.stars[index]
        const isLit = index === lit
        const isBrought = brought?.has(index) ?? false
        const isHub = star.imported >= HUB
        if (!isLit && !isBrought && !(isHub && lit === null)) continue
        const y = star.y - star.radius - 5 / scale
        const w = context.measureText(star.name).width
        if (!isLit && !clear(star.x, y, w)) continue
        placed.push({ x: star.x, y, w })
        context.globalAlpha = isLit ? 1 : 0.8
        context.fillText(star.name, star.x, y)
      }

      context.restore()
    }

    function tick() {
      if (!running) return
      if (alpha > 0.02) {
        const energy = step(graph, alpha, null)
        alpha *= 0.98
        if (energy < 0.0006 && alpha < 0.6) alpha = 0
        draw()
        frameId = requestAnimationFrame(tick)
        return
      }
      // Settled: stop the loop and only redraw on interaction.
      setSettled(true)
      draw()
    }

    drawRef.current = draw
    frameId = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(frameId)
      observer.disconnect()
      probe.remove()
    }
  }, [graph])

  /** Once settled the canvas is painted on demand, not every frame. */
  const repaint = useCallback(() => drawRef.current(), [])

  useEffect(() => {
    repaint()
  }, [hover, matches, repaint])

  const hovered = hover === null ? null : graph.stars[hover]
  const broughtCount = hover === null ? 0 : (graph.brings.get(hover)?.length ?? 0)
  const userCount = hover === null ? 0 : (graph.usedBy.get(hover)?.length ?? 0)

  return (
    <div
      ref={frameRef}
      className={cn('relative size-full touch-none select-none overflow-hidden', dragging.current ? 'cursor-grabbing' : hovered ? 'cursor-pointer' : 'cursor-grab')}
      onPointerDown={(event) => {
        event.preventDefault()
        dragging.current = { x: event.clientX, y: event.clientY, viewX: view.current.x, viewY: view.current.y }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const drag = dragging.current
        if (drag) {
          const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
          if (moved > 3) {
            adjusted.current = true
            view.current.x = drag.viewX + (event.clientX - drag.x)
            view.current.y = drag.viewY + (event.clientY - drag.y)
            repaint()
          }
          return
        }
        const point = toGraph(event.clientX, event.clientY)
        pointer.current = point
        const found = starAt(graph, point.x, point.y, 14 / view.current.scale)
        if (found !== hover) setHover(found)
      }}
      onPointerUp={(event) => {
        const drag = dragging.current
        dragging.current = null
        if (!drag) return
        const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
        if (moved > 4) return
        const point = toGraph(event.clientX, event.clientY)
        const found = starAt(graph, point.x, point.y, 14 / view.current.scale)
        if (found !== null) navigate(`/components/${graph.stars[found].slug}`)
      }}
      onPointerLeave={() => {
        dragging.current = null
        setHover(null)
      }}
      onWheel={(event) => {
        const scale = Math.max(0.3, Math.min(3, view.current.scale * Math.exp(-event.deltaY * 0.0015)))
        adjusted.current = true
        view.current.scale = scale
        repaint()
      }}
    >
      <canvas ref={canvasRef} className="block size-full" />

      {!settled && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-line bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] px-3 py-1.5 shadow-[var(--shadow-tile)] backdrop-blur-md">
          <Text as="span" size="caption" tone="soft" className="text-[12px]">
            Settling {graph.stars.length} components into what imports what…
          </Text>
        </div>
      )}

      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[280px] flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-[color-mix(in_oklab,var(--color-surface)_94%,transparent)] px-3.5 py-2.5 shadow-[var(--shadow-float)] backdrop-blur-md">
          <Text as="span" size="body" weight="bold" className="font-mono text-[13px]">
            {hovered.name}
          </Text>
          <Text as="span" size="caption" tone="soft" className="text-[12px]">
            {hovered.group} · {kB(sizes[hovered.name]?.gzip ?? 0)} gzipped
          </Text>
          <span className="mt-1 flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2 rounded-full bg-accent-strong" />
              <Text as="span" size="caption" className="text-[12px]">
                {broughtCount === 0 ? 'Brings nothing with it' : `Brings ${broughtCount} component${broughtCount === 1 ? '' : 's'} with it`}
              </Text>
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2 rounded-full bg-ink" />
              <Text as="span" size="caption" className="text-[12px]">
                {userCount === 0 ? 'Nothing imports it' : `Used by ${userCount} component${userCount === 1 ? '' : 's'}`}
              </Text>
            </span>
          </span>
        </div>
      )}

      <VisuallyHidden>
        <p>
          A picture of the library&apos;s imports. Every component in it, with what it depends on, is listed on the
          components page.
        </p>
      </VisuallyHidden>
    </div>
  )
}
