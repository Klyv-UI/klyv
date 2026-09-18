'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'
import { Switch } from '../Switch'

export type SnakeGameSpeed = 'slow' | 'normal' | 'fast'

export interface SnakeGameProps {
  /** Cells across. */
  columns?: number
  /** Cells down. */
  rows?: number
  /** Speed of the first game. The picker changes it after that. */
  defaultSpeed?: SnakeGameSpeed
  /** Start with solid walls. Off, the snake wraps to the opposite edge. */
  defaultWalls?: boolean
  /** Where the high score is kept in localStorage. Pass null to keep it for the session only. */
  storageKey?: string | null
  /** Called when a game ends. */
  onGameOver?: (score: number) => void
  /** Accessible name for the board. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

interface Point {
  x: number
  y: number
}

type Status = 'ready' | 'running' | 'paused' | 'over'

const TICK: Record<SnakeGameSpeed, number> = { slow: 180, normal: 120, fast: 75 }
const DIRECTIONS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
}

const token = (element: Element, name: string, fallback: string) => getComputedStyle(element).getPropertyValue(name).trim() || fallback

function readHigh(key: string | null) {
  if (!key) return 0
  try {
    return Number(window.localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

/**
 * Snake, in real time on a canvas: eat, grow, and do not run into yourself.
 *
 * The game advances on a fixed tick from an accumulator, not once per frame, so
 * its speed is the same on a 60 Hz laptop and a 120 Hz phone. Turns are
 * buffered — up to three, and never straight back on yourself — which is what
 * makes a quick down-left at a corner register as two turns instead of losing
 * the second one to the next tick.
 *
 * Arrows or WASD steer, Space pauses, and a swipe steers on touch. The game
 * pauses itself when the tab is hidden or the board loses focus, since a snake
 * that dies while you read another tab is a bug, not a challenge. Under reduced
 * motion it still plays — the movement is the game — but the food does not
 * pulse and death does not flash.
 */
export function SnakeGame({
  columns = 20,
  rows = 14,
  defaultSpeed = 'normal',
  defaultWalls = true,
  storageKey = 'klyv-snake-high-score',
  onGameOver,
  label = 'Snake',
  className,
}: SnakeGameProps) {
  const reduced = usePrefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('ready')
  const [speed, setSpeed] = useState(defaultSpeed)
  const [walls, setWalls] = useState(defaultWalls)
  const [score, setScore] = useState(0)
  const [high, setHigh] = useState(0)
  const [unsupported, setUnsupported] = useState(false)
  const [message, setMessage] = useState('')
  const swipe = useRef<Point | null>(null)
  const game = useRef({ snake: [] as Point[], dir: { x: 1, y: 0 }, queue: [] as Point[], food: { x: 0, y: 0 }, deadAt: 0 })

  useEffect(() => setHigh(readHigh(storageKey)), [storageKey])

  const placeFood = useCallback(() => {
    const g = game.current
    const free: Point[] = []
    for (let y = 0; y < rows; y += 1)
      for (let x = 0; x < columns; x += 1) if (!g.snake.some((part) => part.x === x && part.y === y)) free.push({ x, y })
    if (free.length) g.food = free[Math.floor(Math.random() * free.length)]
    return free.length > 0
  }, [columns, rows])

  const draw = useCallback(
    (time = 0) => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return setUnsupported(true)
      const box = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.round(box.width * dpr)
      const height = Math.round(box.height * dpr)
      if (canvas.width !== width || canvas.height !== height) [canvas.width, canvas.height] = [width, height]
      const cell = width / columns
      const g = game.current
      const flash = !reduced && g.deadAt && time - g.deadAt < 240
      context.fillStyle = token(canvas, flash ? '--color-danger' : '--color-surface-sunken', 'Canvas')
      context.fillRect(0, 0, width, height)
      context.fillStyle = token(canvas, '--color-line', 'GrayText')
      for (let y = 0; y < rows; y += 1)
        for (let x = 0; x < columns; x += 1) if ((x + y) % 2) context.fillRect(x * cell, y * cell, cell, cell)
      // Food pulses gently; under reduced motion it sits still.
      const pulse = reduced ? 0 : Math.sin(time / 180) * 0.08
      context.fillStyle = token(canvas, '--color-danger', 'CanvasText')
      context.beginPath()
      context.arc((g.food.x + 0.5) * cell, (g.food.y + 0.5) * cell, cell * (0.32 + pulse), 0, Math.PI * 2)
      context.fill()
      const body = token(canvas, '--color-accent-strong', 'Highlight')
      const head = token(canvas, '--color-ink', 'CanvasText')
      g.snake.forEach((part, index) => {
        context.fillStyle = index === 0 ? head : body
        const inset = index === 0 ? cell * 0.06 : cell * 0.1
        context.beginPath()
        context.roundRect(part.x * cell + inset, part.y * cell + inset, cell - inset * 2, cell - inset * 2, cell * 0.25)
        context.fill()
      })
    },
    [columns, rows, reduced],
  )

  const reset = useCallback(() => {
    const y = Math.floor(rows / 2)
    const x = Math.floor(columns / 3)
    game.current = { snake: [{ x, y }, { x: x - 1, y }, { x: x - 2, y }], dir: { x: 1, y: 0 }, queue: [], food: { x: 0, y: 0 }, deadAt: 0 }
    placeFood()
    setScore(0)
    setStatus('ready')
    draw()
  }, [columns, rows, placeFood, draw])

  useEffect(() => reset(), [reset, walls])

  const finish = useCallback(
    (final: number, text: string) => {
      game.current.deadAt = performance.now()
      setStatus('over')
      setHigh((best) => {
        const next = Math.max(best, final)
        if (storageKey && next > best)
          try {
            window.localStorage.setItem(storageKey, String(next))
          } catch {
            /* Storage can be full or blocked; the score still shows for this session. */
          }
        return next
      })
      setMessage(`${text} Score ${final}.`)
      onGameOver?.(final)
    },
    [storageKey, onGameOver],
  )

  const tick = useCallback(() => {
    const g = game.current
    if (g.queue.length) g.dir = g.queue.shift()!
    let head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y }
    const outside = head.x < 0 || head.y < 0 || head.x >= columns || head.y >= rows
    if (outside && walls) return finish(g.snake.length - 3, 'Hit the wall.')
    if (outside) head = { x: (head.x + columns) % columns, y: (head.y + rows) % rows }
    const eating = head.x === g.food.x && head.y === g.food.y
    // The tail moves out of the way this tick unless the snake is growing.
    const body = eating ? g.snake : g.snake.slice(0, -1)
    if (body.some((part) => part.x === head.x && part.y === head.y)) return finish(g.snake.length - 3, 'Ran into yourself.')
    g.snake = [head, ...body]
    if (eating) {
      const points = g.snake.length - 3
      setScore(points)
      if (!placeFood()) return finish(points, 'The board is full. You win.')
      if (points % 5 === 0) setMessage(`Score ${points}.`)
    }
  }, [columns, rows, walls, placeFood, finish])

  // Fixed-step loop: frames accumulate time, and the game advances one tick per TICK ms.
  useEffect(() => {
    if (status !== 'running') {
      let frame = 0
      const settle = (time: number) => {
        draw(time)
        if (status === 'over' && time - game.current.deadAt < 260) frame = requestAnimationFrame(settle)
      }
      frame = requestAnimationFrame(settle)
      return () => cancelAnimationFrame(frame)
    }
    let frame = 0
    let last = performance.now()
    let carried = 0
    const step = TICK[speed]
    const loop = (time: number) => {
      carried += Math.min(250, time - last)
      last = time
      while (carried >= step && game.current.deadAt === 0) {
        tick()
        carried -= step
      }
      draw(time)
      if (game.current.deadAt === 0) frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [status, speed, tick, draw])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setStatus((current) => (current === 'running' ? 'paused' : current))
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const turn = (direction: Point) => {
    const g = game.current
    const last = g.queue[g.queue.length - 1] ?? g.dir
    // Never straight back into the neck, and never the same way twice in the buffer.
    if ((direction.x === -last.x && direction.y === -last.y) || (direction.x === last.x && direction.y === last.y)) {
      if (status !== 'running' && status !== 'over') setStatus('running')
      return
    }
    if (g.queue.length < 3) g.queue.push(direction)
    if (status === 'ready' || status === 'paused') setStatus('running')
  }

  const togglePause = () => {
    if (status === 'over') {
      reset()
      return
    }
    const next = status === 'running' ? 'paused' : 'running'
    setStatus(next)
    setMessage(next === 'paused' ? 'Paused.' : 'Playing.')
    // Resuming from the button hands the keys back to the board.
    if (next === 'running') canvasRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const direction = DIRECTIONS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    if (direction) {
      event.preventDefault()
      if (status === 'over') return
      return turn(direction)
    }
    if (event.key === ' ' || event.key === 'p' || event.key === 'P' || event.key === 'Enter') {
      event.preventDefault()
      togglePause()
    }
  }

  const onPointerUp = (event: PointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return togglePause()
    if (status === 'over') return
    turn(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) })
  }

  const overlay =
    status === 'ready' ? 'Press an arrow key or swipe to start' : status === 'paused' ? 'Paused — Space to resume' : status === 'over' ? `Game over · ${score}` : null

  return (
    <div className={cn('flex w-full max-w-[560px] flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Speed"
          size="sm"
          value={speed}
          onValueChange={setSpeed}
          options={[
            { value: 'slow', label: 'Slow' },
            { value: 'normal', label: 'Normal' },
            { value: 'fast', label: 'Fast' },
          ]}
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={walls} onChange={(event) => setWalls(event.target.checked)} />
          Walls
        </label>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          role="application"
          aria-roledescription="game board"
          aria-label={`${label}, ${columns} by ${rows}. Arrow keys or WASD steer, Space pauses. Score ${score}.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setStatus((current) => (current === 'running' ? 'paused' : current))}
          onPointerDown={(event) => (swipe.current = { x: event.clientX, y: event.clientY })}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
          className="block w-full touch-none rounded-[var(--radius-tile)] border border-line outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          style={{ aspectRatio: `${columns} / ${rows}` }}
        />
        {unsupported ? (
          <p className="absolute inset-0 m-0 flex items-center justify-center p-6 text-center text-[13px] font-medium text-ink-soft">
            This browser cannot draw on a canvas, so the game cannot be shown.
          </p>
        ) : (
          overlay && (
            <p className="pointer-events-none absolute inset-x-0 top-1/2 m-0 -translate-y-1/2 text-center">
              <span className="rounded-full bg-surface px-3 py-1.5 text-[12px] font-bold text-ink shadow-[var(--shadow-float)]">{overlay}</span>
            </p>
          )
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <dl className="m-0 flex gap-5">
          {[
            ['Score', score],
            ['Best', Math.max(high, score)],
          ].map(([term, detail]) => (
            <div key={term} className="flex flex-col gap-1">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{term}</dt>
              <dd className="m-0 text-[15px] font-extrabold leading-none text-ink tabular">{detail}</dd>
            </div>
          ))}
        </dl>
        <Button size="sm" variant="outline" onClick={() => {
            if (status === 'over' || status === 'ready') {
              reset()
              canvasRef.current?.focus()
            } else togglePause()
          }}
        >
          {status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : 'New game'}
        </Button>
      </div>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
