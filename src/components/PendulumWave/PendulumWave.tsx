'use client'

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { tokenRgb, useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import type { IconComponent } from '../../lib/types'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { SegmentedControl } from '../SegmentedControl'
import { Slider } from '../Slider'
import {
  buildRig,
  chimePitches,
  closingSpread,
  cycleMarks,
  describePhase,
  maxAmplitude,
  PendulumTimeline,
  releaseState,
  STEP,
  stepRig,
  type PendulumPhase,
} from './pendulums'
import { drawFront, drawSide, FALLBACK, TRAIL, TRAIL_EVERY, type PendulumScene } from './draw'

export type PendulumWaveView = 'side' | 'front'

export interface PendulumWaveHandle {
  /** Pull every bob back to the release line and start the cycle again. */
  reset: () => void
  /** Start swinging. Ignored under reduced motion. */
  start: () => void
  /** Stop, holding the current moment. */
  stop: () => void
}

export interface PendulumWaveProps {
  /** Number of pendulums, 2–48. */
  count?: number
  /** Seconds for the pattern to go through every figure and come back to one line. */
  cycle?: number
  /** Swings the slowest pendulum makes per cycle; each next one makes one more. Defaults to the cycle in seconds, so the slowest swings once a second. */
  baseCycles?: number
  /** Controlled release angle of the longest pendulum, in degrees. The rest are pulled back level with it. */
  amplitude?: number
  /** Uncontrolled starting release angle. Defaults to `tuning`, where the cycle closes exactly. */
  defaultAmplitude?: number
  /** Called when the release-angle slider moves. */
  onAmplitudeChange?: (degrees: number) => void
  /** The release angle the strings are cut for, in degrees. Released from anything else, the row no longer returns to a perfect line. 0 is the small-angle textbook cut. */
  tuning?: number
  /** Amplitude decay rate per second. 0 swings for ever; 0.01 loses about 45% of the swing in a minute. */
  damping?: number
  /** Controlled view: the apparatus from the side, or the row from above, where the waves read best. */
  view?: PendulumWaveView
  /** Uncontrolled starting view. */
  defaultView?: PendulumWaveView
  /** Called when the view control changes. */
  onViewChange?: (view: PendulumWaveView) => void
  /** Fading after-images of the last third of a second. */
  trails?: boolean
  /** Offer the chime: a soft sine ping as each bob passes the bottom, at its own frequency moved up by octaves. */
  sound?: boolean
  /** Start muted. Sound only ever begins from a click on the sound button. */
  defaultMuted?: boolean
  /** Controlled swinging state. */
  playing?: boolean
  /** Uncontrolled starting state. */
  defaultPlaying?: boolean
  /** Called when the play button, or the handle, starts or stops it. */
  onPlayingChange?: (playing: boolean) => void
  /** Under reduced motion, the moment drawn as a still, as a fraction of the cycle. Defaults to the row forming one full wave. */
  stillPhase?: number
  /** Accessible name. Without it the drawing is decorative and hidden; the status line still announces the figures. */
  label?: string
  /** Show the transport, view, cycle ruler and release-angle controls. */
  controls?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/** Everything the loop keeps between frames, outside React. */
interface Sim extends PendulumScene {
  timeline: PendulumTimeline | null
  /** Chime pitch of each pendulum, Hz. */
  pitches: Float64Array
  /** Simulated seconds since the last after-image. */
  ghostClock: number
  ratio: number
  /** Frame time not yet stepped, seconds. */
  carry: number
  last: number
  frame: number
  running: boolean
  visible: boolean
  phaseKey: string
  progress: number
  progressAt: number
  announcedAt: number
  announcedKey: string
  announceTimer: number
}

const SpeakerIcon: IconComponent = ({ size = 16, strokeWidth = 2, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M2.5 6h2.5l3.5-3v10l-3.5-3h-2.5z" />
    <path d="M11 5.5a3.5 3.5 0 010 5M12.8 3.6a6 6 0 010 8.8" />
  </svg>
)

const MutedIcon: IconComponent = ({ size = 16, strokeWidth = 2, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M2.5 6h2.5l3.5-3v10l-3.5-3h-2.5z" />
    <path d="M11 6l3.5 4M14.5 6L11 10" />
  </svg>
)

const seconds = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * The Harvard pendulum-wave demonstration: a row of pendulums whose lengths are cut
 * so that in one cycle each makes exactly one more swing than the last. Released
 * together, they fan out, snake into travelling waves, split into two, three and
 * four rows, dissolve into what looks like chaos, and come back to one straight
 * line at the end of the cycle — and do it again.
 *
 * Nothing about the pattern is animated. Each bob is a pendulum integrated from its
 * own equation of motion (see `pendulums.ts`); the figures are what those periods
 * do to each other. The ruler under it knows where the figures fall only because
 * they follow from the tuning, and a large release angle — which makes a real
 * pendulum run slow — visibly breaks them, as it would on the real apparatus.
 *
 * Paused, the cycle slider scrubs through the run by replaying the physics from
 * stored states. Reduced motion never starts the loop: it draws the chosen moment
 * as a still, and the same slider explores the rest of the cycle by hand.
 */
export const PendulumWave = forwardRef<PendulumWaveHandle, PendulumWaveProps>(function PendulumWave(
  {
    count = 15,
    cycle = 60,
    baseCycles,
    amplitude: amplitudeProp,
    defaultAmplitude,
    onAmplitudeChange,
    tuning = 12,
    damping = 0,
    view: viewProp,
    defaultView = 'side',
    onViewChange,
    trails = true,
    sound = true,
    defaultMuted = true,
    playing: playingProp,
    defaultPlaying = true,
    onPlayingChange,
    stillPhase,
    label,
    controls = true,
    className,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const id = useId()
  const [internalAmplitude, setInternalAmplitude] = useState(defaultAmplitude ?? tuning)
  const amplitude = amplitudeProp ?? internalAmplitude
  const [internalView, setInternalView] = useState<PendulumWaveView>(defaultView)
  const view = viewProp ?? internalView
  const [internalPlaying, setInternalPlaying] = useState(defaultPlaying)
  const wantsPlaying = playingProp ?? internalPlaying
  const playing = wantsPlaying && !reduced
  const [muted, setMuted] = useState(defaultMuted)
  const [phase, setPhase] = useState<PendulumPhase>(() => describePhase(0, count))
  const [progress, setProgress] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  const rig = useMemo(
    () => buildRig({ count, cycle, baseCycles: baseCycles ?? Math.round(cycle), amplitude, tuning, damping }),
    [count, cycle, baseCycles, amplitude, tuning, damping],
  )
  const spread = useMemo(() => closingSpread(rig), [rig])
  const ceiling = useMemo(() => Math.max(2, Math.floor(maxAmplitude(rig))), [rig])
  const marks = useMemo(() => cycleMarks(rig.count), [rig.count])
  const still = stillPhase ?? 1 / Math.max(1, rig.count - 1)

  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const audio = useRef<{ context: AudioContext; master: GainNode; voices: number } | null>(null)
  const sim = useRef<Sim>({
    rig: null,
    state: null,
    timeline: null,
    pitches: new Float64Array(0),
    ghosts: new Float32Array(0),
    ghostHead: 0,
    ghostCount: 0,
    ghostClock: 0,
    palette: FALLBACK,
    width: 0,
    height: 0,
    ratio: 1,
    fit: null,
    carry: 0,
    last: 0,
    frame: 0,
    running: false,
    visible: true,
    phaseKey: '',
    progress: -1,
    progressAt: 0,
    announcedAt: -Infinity,
    announcedKey: '',
    announceTimer: 0,
  })
  // Past a tenth of a swing off at the end of the cycle the figures no longer form as
  // named, so their names are qualified rather than stated.
  const detuned = spread > 0.1
  const live = useRef({ playing, muted, view, trails, reduced, still, detuned })
  live.current = { playing, muted, view, trails, reduced, still, detuned }

  const setPlaying = useCallback(
    (next: boolean) => {
      if (playingProp === undefined) setInternalPlaying(next)
      onPlayingChange?.(next)
    },
    [playingProp, onPlayingChange],
  )

  const setAmplitude = (next: number) => {
    if (amplitudeProp === undefined) setInternalAmplitude(next)
    onAmplitudeChange?.(next)
  }

  const setView = (next: PendulumWaveView) => {
    if (viewProp === undefined) setInternalView(next)
    onViewChange?.(next)
  }

  /* ------------------------------------------------------------ drawing */

  const draw = useCallback(() => {
    const s = sim.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !s.rig || !s.state || s.width < 2 || s.height < 2) return
    context.setTransform(s.ratio, 0, 0, s.ratio, 0, 0)
    context.clearRect(0, 0, s.width, s.height)
    const { view: current, trails: ghosts } = live.current
    if (current === 'front') drawFront(context, s, ghosts)
    else drawSide(context, s, ghosts)
  }, [])

  /**
   * Where we are in the cycle, pushed to the readouts. The clock and progress line
   * are written straight to the DOM every frame; React state — the slider, the
   * figure's name — changes only when it has something new to say, and the status
   * line speaks only on arriving at a figure, and no more than every 1.5 seconds.
   */
  const report = useCallback((mode: 'play' | 'seek') => {
    const s = sim.current
    const { rig: current, state } = s
    if (!current || !state) return
    const now = performance.now()
    const cycleSteps = Math.max(1, Math.round(current.cycle / STEP))
    const within = state.steps === 0 ? 0 : ((state.steps - 1) % cycleSteps) + 1
    const completed = state.steps === 0 ? 0 : Math.floor((state.steps - 1) / cycleSteps)
    const u = within / cycleSteps
    if (clockRef.current) clockRef.current.textContent = `${(within * STEP).toFixed(1)} s of ${seconds(current.cycle)} s${completed > 0 ? ` · cycle ${completed + 1}` : ''}`
    if (barRef.current) barRef.current.style.width = `${u * 100}%`
    const next = describePhase(u, current.count)
    if (next.key !== s.phaseKey) {
      s.phaseKey = next.key
      setPhase(next)
    }
    const say = () => {
      s.announcedKey = next.key
      s.announcedAt = performance.now()
      setAnnouncement(live.current.detuned ? `Where the tuned row would form ${next.name}.` : `${capital(next.name)}. ${next.detail}`)
    }
    clearTimeout(s.announceTimer)
    if (!s.announcedKey) s.announcedKey = next.key // the first moment is shown, not spoken
    else if (next.key !== s.announcedKey) {
      // Playing: speak on arriving at a figure. Scrubbing: the slider's value text is
      // read as it moves, so the status waits until the hand has settled.
      if (mode === 'play') {
        if (next.figure && now - s.announcedAt > 1500) say()
      } else s.announceTimer = window.setTimeout(say, 700)
    }
    const permille = Math.round(u * 1000)
    if (permille !== s.progress && (mode === 'seek' || now - s.progressAt > 80)) {
      s.progress = permille
      s.progressAt = now
      setProgress(permille)
    }
  }, [])

  const seekSteps = useCallback(
    (steps: number) => {
      const s = sim.current
      if (!s.timeline || !s.state) return
      s.timeline.seek(s.state, steps)
      s.carry = 0
      s.ghostCount = 0
      s.ghostClock = 0
      draw()
      report('seek')
    },
    [draw, report],
  )

  /* ---------------------------------------------------------------- audio */

  const ping = useCallback((index: number, strength: number) => {
    const node = audio.current
    const s = sim.current
    if (!node || live.current.muted || !s.visible || document.hidden || node.voices > 28) return
    const pitch = s.pitches[index]
    if (!pitch) return
    const { context } = node
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const peak = Math.max(0.0002, Math.min(0.2, 1.6 / (s.rig?.count ?? 15)) * strength)
    oscillator.type = 'sine'
    oscillator.frequency.value = pitch
    // A 10 ms rise and an exponential fall: no click at either end.
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)
    oscillator.connect(gain).connect(node.master)
    oscillator.start(now)
    oscillator.stop(now + 0.75)
    node.voices++
    oscillator.onended = () => {
      node.voices--
      oscillator.disconnect()
      gain.disconnect()
    }
  }, [])

  const toggleSound = () => {
    const next = !muted
    setMuted(next)
    if (!next && !audio.current) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Context) return
      const context = new Context()
      const master = context.createGain()
      master.gain.value = 0.35
      master.connect(context.destination)
      audio.current = { context, master, voices: 0 }
    }
    if (!next) void audio.current?.context.resume()
  }

  useEffect(
    () => () => {
      clearTimeout(sim.current.announceTimer)
      const node = audio.current
      audio.current = null
      if (node) void node.context.close()
    },
    [],
  )

  /* --------------------------------------------------------------- loop */

  const tick = useCallback(
    (now: number) => {
      const s = sim.current
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60
      s.last = now
      const { rig: current, state } = s
      if (current && state) {
        const chime = audio.current && !live.current.muted ? ping : undefined
        s.carry += dt
        let budget = 64
        while (s.carry >= STEP && budget-- > 0) {
          stepRig(current, state, chime)
          s.carry -= STEP
          s.ghostClock += STEP
          if (s.ghostClock >= TRAIL_EVERY) {
            s.ghostClock -= TRAIL_EVERY
            s.ghosts.set(state.theta, s.ghostHead * current.count)
            s.ghostHead = (s.ghostHead + 1) % TRAIL
            s.ghostCount = Math.min(TRAIL, s.ghostCount + 1)
          }
        }
        if (budget <= 0) s.carry = 0
      }
      draw()
      report('play')
      if (live.current.playing && s.visible && !document.hidden) s.frame = requestAnimationFrame(tick)
      else {
        s.running = false
        s.last = 0
        report('seek')
      }
    },
    [draw, report, ping],
  )

  const start = useCallback(() => {
    const s = sim.current
    if (s.running || !live.current.playing || !s.visible || document.hidden) return
    s.running = true
    s.last = 0
    s.frame = requestAnimationFrame(tick)
  }, [tick])

  const halt = useCallback(() => {
    const s = sim.current
    cancelAnimationFrame(s.frame)
    s.running = false
    s.last = 0
  }, [])

  /* ------------------------------------------------------------ effects */

  // A new rig — count, cycle, release or tuning changed. Keep the same moment of the
  // cycle, replayed with the new strings, so dragging the release angle while parked
  // at the end of the cycle shows the line come apart.
  useEffect(() => {
    const s = sim.current
    const previous = s.rig && s.state ? { steps: s.state.steps, cycleSteps: Math.max(1, Math.round(s.rig.cycle / STEP)) } : null
    s.rig = rig
    s.timeline = new PendulumTimeline(rig)
    s.state = releaseState(rig, s.state ?? undefined)
    s.pitches = chimePitches(rig)
    if (s.ghosts.length !== TRAIL * rig.count) s.ghosts = new Float32Array(TRAIL * rig.count)
    s.fit = null
    s.phaseKey = ''
    const u = previous
      ? previous.steps <= previous.cycleSteps
        ? previous.steps / previous.cycleSteps
        : (previous.steps % previous.cycleSteps) / previous.cycleSteps
      : live.current.reduced
        ? live.current.still
        : 0
    seekSteps(u * Math.round(rig.cycle / STEP))
  }, [rig, seekSteps])

  // Reduced motion never runs the loop; a run that has barely begun shows the chosen
  // still instead. (The preference arrives an effect after mount, by which time a frame
  // or two may already have stepped — hence "barely", not "not at all".)
  useEffect(() => {
    if (!reduced) return
    halt()
    const s = sim.current
    if (s.state && s.rig && s.state.steps * STEP < 0.5) seekSteps(still * Math.round(s.rig.cycle / STEP))
  }, [reduced, still, halt, seekSteps])

  useEffect(() => {
    if (playing) start()
    else halt()
  }, [playing, start, halt])

  // Canvas size and colours, and a repaint when the view or theme changes.
  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return
    const resize = () => {
      const s = sim.current
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      s.width = stage.clientWidth
      s.height = stage.clientHeight
      s.ratio = ratio
      s.fit = null
      const width = Math.max(1, Math.round(s.width * ratio))
      const height = Math.max(1, Math.round(s.height * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      s.palette = {
        ink: tokenRgb(stage, '--color-ink', FALLBACK.ink),
        soft: tokenRgb(stage, '--color-ink-soft', FALLBACK.soft),
        faint: tokenRgb(stage, '--color-ink-faint', FALLBACK.faint),
        line: tokenRgb(stage, '--color-line-strong', FALLBACK.line),
        accent: tokenRgb(stage, '--color-accent', FALLBACK.accent),
        surface: tokenRgb(stage, '--color-surface', FALLBACK.surface),
      }
      draw()
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(stage)
    return () => observer?.disconnect()
  }, [themeVersion, draw])

  useEffect(() => {
    sim.current.fit = null
    draw()
  }, [view, trails, draw])

  // Park the loop off screen and in hidden tabs.
  useEffect(() => {
    const stage = stageRef.current
    const s = sim.current
    const wake = () => {
      if (s.visible && !document.hidden) start()
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            s.visible = entry.isIntersecting
            wake()
          })
    if (stage) observer?.observe(stage)
    document.addEventListener('visibilitychange', wake)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', wake)
      cancelAnimationFrame(s.frame)
      s.running = false
    }
  }, [start])

  useImperativeHandle(
    ref,
    () => ({
      reset: () => seekSteps(0),
      start: () => setPlaying(true),
      stop: () => setPlaying(false),
    }),
    [seekSteps, setPlaying],
  )

  /* ---------------------------------------------------------------- view */

  const cycleSteps = Math.max(1, Math.round(rig.cycle / STEP))
  const scrubTo = (permille: number) => seekSteps((permille / 1000) * cycleSteps)
  const phaseName = detuned ? `${phase.name}, if in tune` : phase.name
  const valueText = `${((progress / 1000) * rig.cycle).toFixed(1)} of ${seconds(rig.cycle)} seconds: ${phaseName}`
  const spreadText =
    spread < 0.01 ? 'the cycle closes exactly' : `the row ends ${spread < 0.095 ? spread.toFixed(2) : spread.toFixed(1)} of a swing off a line`
  const where = view === 'side' ? 'from the side' : 'from above'

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div ref={stageRef} className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-sunken">
        <canvas
          ref={canvasRef}
          role={label ? 'img' : undefined}
          aria-label={label ? `${label}: ${rig.count} pendulums on a ${seconds(rig.cycle)}-second cycle, seen ${where}.` : undefined}
          aria-hidden={label ? undefined : true}
          className="absolute inset-0 size-full"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink shadow-[var(--shadow-tile)]">
            <span className={cn('size-1.5 rounded-full', phase.figure && !detuned ? 'bg-accent-strong' : 'bg-line-strong')} />
            {phaseName}
          </span>
          <span ref={clockRef} className="rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] tabular-nums text-ink-faint" />
        </div>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
          <span ref={barRef} className="block h-full w-0 bg-accent-strong" />
        </span>
      </div>

      {controls ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!reduced ? (
              <Button size="sm" variant={playing ? 'outline' : 'accent'} onClick={() => setPlaying(!wantsPlaying)} className="min-w-[76px]">
                {playing ? 'Pause' : 'Play'}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => seekSteps(0)}>
              Release again
            </Button>
            <SegmentedControl
              label="View"
              size="sm"
              value={view}
              onValueChange={setView}
              options={[
                { value: 'side', label: 'Side' },
                { value: 'front', label: 'From above' },
              ]}
            />
            {sound ? (
              <IconButton
                icon={muted ? MutedIcon : SpeakerIcon}
                label="Chime"
                aria-pressed={!muted}
                selected={!muted}
                size="xs"
                tone="plain"
                className="ml-auto"
                onClick={toggleSound}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="flex flex-wrap justify-between gap-2 text-[12px] font-semibold text-ink-soft">
              <span id={`${id}-cycle`}>Where in the cycle</span>
              <span className="font-normal text-ink-faint">{capital(phaseName)}</span>
            </span>
            <div aria-hidden="true" className="relative mx-2 h-4">
              {marks.map((mark, index) => (
                <span key={index} className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${mark.at * 100}%` }}>
                  {mark.label ? <span className="font-mono text-[10px] leading-none text-ink-faint">{mark.label}</span> : null}
                  <span className={cn('mt-0.5 w-px', mark.kind === 'waves' ? 'h-1 bg-line-strong' : 'h-1.5 bg-ink-faint')} />
                </span>
              ))}
            </div>
            <Slider
              min={0}
              max={1000}
              value={progress}
              aria-labelledby={`${id}-cycle`}
              aria-describedby={`${id}-ruler`}
              aria-valuetext={valueText}
              onChange={(event) => scrubTo(Number(event.target.value))}
            />
            <span id={`${id}-ruler`} className="text-[11px] leading-snug text-ink-faint">
              Numbers mark where the bobs gather into that many rows; short ticks, where the row forms one, two and three full waves.
              {reduced ? ' Drag to move through the cycle.' : ''}
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="flex flex-wrap justify-between gap-2 text-[12px] font-semibold text-ink-soft">
              Release angle
              <span className="font-normal tabular-nums text-ink-faint">
                {Math.round(rig.amplitude)}° · {spreadText}
              </span>
            </span>
            <Slider
              min={1}
              max={ceiling}
              value={Math.min(ceiling, Math.round(rig.amplitude))}
              aria-valuetext={`${Math.round(rig.amplitude)} degrees; strings cut for ${Math.round(tuning)}; ${spreadText}`}
              onChange={(event) => setAmplitude(Number(event.target.value))}
            />
          </label>
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
})
