import { useId, useMemo, useState, type ReactNode } from 'react'
import {
  InfiniteZoom,
  InfiniteZoomScene,
  ParallaxPortal,
  ParallaxPortalLayer,
  PopUpCard,
  Slider,
  Text,
  type PopUpCardPiece,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------- helpers */

/** A small seeded generator, so every render draws the same stars. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Labelled({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
      <span className="flex justify-between text-xs font-semibold text-ink-soft">
        {label}
        <span className="font-mono tabular-nums text-ink-faint">{value}</span>
      </span>
      {children}
    </label>
  )
}

/* ---------------------------------------------------------- pop-up card */

const confetti = seeded(7)
const DOTS = Array.from({ length: 34 }, () => ({
  x: confetti() * 100,
  y: confetti() * 100,
  r: 2 + confetti() * 3.5,
  tone: confetti() > 0.5,
}))

function Confetti({ strong = false }: { strong?: boolean }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {DOTS.map((dot, i) => (
        <ellipse
          key={i}
          cx={dot.x}
          cy={dot.y}
          rx={dot.r * 0.35}
          ry={dot.r * 0.55}
          fill={dot.tone ? 'var(--color-accent-strong)' : strong ? 'var(--color-accent-ink)' : 'var(--color-ink-faint)'}
          opacity={strong ? 0.35 : 0.45}
        />
      ))}
    </svg>
  )
}

function Frosting({ fill }: { fill: string }) {
  return (
    <svg className="absolute inset-x-0 top-0 h-5 w-full" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 0h100v4c-3 0-3 5-6 5s-3-4-6-4-3 6-7 6-3-5-6-5-4 4-7 4-3-6-6-6-4 5-7 5-3-4-6-4-3 6-7 6-3-5-6-5-3 4-6 4-4-5-7-5-3 5-6 5-4-4-7-4-3 3-5 3z"
        fill={fill}
      />
    </svg>
  )
}

const BIRTHDAY: PopUpCardPiece[] = [
  {
    id: 'tier-1',
    kind: 'parallel',
    width: 260,
    height: 72,
    depth: 158,
    paper: 'var(--color-accent)',
    label: 'The bottom tier of a cake reads Happy birthday',
    children: (
      <div className="relative h-full w-full">
        <Frosting fill="var(--color-surface)" />
        <p className="absolute inset-x-0 bottom-3 text-center text-[15px] font-extrabold uppercase tracking-[0.2em] text-accent-ink">
          Happy birthday
        </p>
      </div>
    ),
  },
  {
    id: 'tier-2',
    kind: 'parallel',
    width: 196,
    height: 128,
    depth: 120,
    delay: 0.2,
    paper: 'var(--color-accent-soft)',
    children: (
      <div className="relative h-full w-full">
        <Frosting fill="var(--color-accent-strong)" />
        <div className="absolute inset-x-6 top-9 flex justify-between">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="size-2 rounded-full bg-accent-strong" />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'tier-3',
    kind: 'parallel',
    width: 132,
    height: 178,
    depth: 86,
    delay: 0.4,
    paper: 'var(--color-surface)',
    label: 'The top tier carries a big 30',
    children: (
      <div className="relative h-full w-full">
        <Frosting fill="var(--color-accent)" />
        <p className="absolute inset-x-0 top-5 text-center text-[30px] font-extrabold leading-none text-ink">30</p>
      </div>
    ),
  },
  ...[-34, 0, 34].map(
    (x, i): PopUpCardPiece => ({
      id: `candle-${i}`,
      kind: 'parallel',
      x,
      width: 10,
      height: 222,
      depth: 48,
      delay: 0.6 + i * 0.08,
      paper: 'var(--color-surface)',
      label: i === 1 ? 'Three lit candles' : undefined,
      children: (
        <div className="relative h-full w-full">
          <div className="absolute left-1/2 top-0 h-[15px] w-[9px] -translate-x-1/2 rounded-[50%_50%_45%_45%/65%_65%_35%_35%] bg-[radial-gradient(circle_at_50%_70%,#fff6c8,#ffb020_55%,#ff6a1a)]" />
          <div className="absolute inset-x-0 bottom-0 top-[15px] bg-[repeating-linear-gradient(135deg,var(--color-accent-strong)_0_5px,var(--color-surface)_5px_10px)]" />
        </div>
      ),
    }),
  ),
  ...[-1, 1].map(
    (side): PopUpCardPiece => ({
      id: `balloon-${side}`,
      kind: 'v',
      x: side * 150,
      width: 96,
      height: 150,
      glue: 44,
      spine: 66,
      flip: side < 0,
      delay: 0.3,
      paper: 'var(--color-surface)',
      label: side < 0 ? 'Balloons stand up on either side' : undefined,
      children: (
        <svg viewBox="0 0 96 150" className="h-full w-full" aria-hidden="true">
          <path d="M48 150 C44 120 54 104 48 86" stroke="var(--color-ink-faint)" strokeWidth="1.5" fill="none" />
          <ellipse cx="48" cy="48" rx="34" ry="40" fill={side < 0 ? 'var(--color-accent)' : 'var(--color-accent-strong)'} />
          <ellipse cx="36" cy="32" rx="8" ry="12" fill="white" opacity="0.35" />
          <path d="M43 88 L48 82 L53 88 Z" fill={side < 0 ? 'var(--color-accent)' : 'var(--color-accent-strong)'} />
        </svg>
      ),
    }),
  ),
]

function BirthdayInside() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[repeating-conic-gradient(from_0deg_at_50%_110%,color-mix(in_oklab,var(--color-accent)_16%,transparent)_0deg_7deg,transparent_7deg_14deg)]">
      <svg className="absolute inset-x-0 top-0 h-7 w-full" viewBox="0 0 240 14" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 1 Q120 9 240 1" stroke="var(--color-ink-faint)" strokeWidth="0.6" fill="none" />
        {Array.from({ length: 16 }, (_, i) => {
          const x = 4 + i * 15
          const y = 1 + 8 * (1 - ((x - 120) / 120) ** 2) * 0.95
          return <path key={i} d={`M${x} ${y} l7 0 l-3.5 7 z`} fill={i % 2 ? 'var(--color-accent-strong)' : 'var(--color-ink)'} opacity={i % 2 ? 1 : 0.75} />
        })}
      </svg>
      <p className="absolute inset-x-0 top-9 text-center text-[26px] font-extrabold tracking-tight text-ink">Happy 30th, Maya</p>
      <p className="absolute inset-x-0 top-[74px] text-center text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft">
        make a wish
      </p>
    </div>
  )
}

function BirthdayBase() {
  return (
    <div className="relative h-full w-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-ink)_9%,transparent)_1.2px,transparent_1.6px)] [background-size:14px_14px]">
      <p className="absolute inset-x-0 bottom-4 text-center text-[13px] font-semibold italic text-ink-soft">
        With love from everyone at Northwind
      </p>
    </div>
  )
}

function BirthdayCover() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden">
      <Confetti strong />
      <p className="relative text-[11px] font-bold uppercase tracking-[0.35em] text-accent-ink opacity-70">for</p>
      <p className="relative text-[44px] font-extrabold leading-none tracking-tight text-accent-ink">Maya</p>
      <p className="relative mt-2 text-xs font-semibold text-accent-ink opacity-70">click, drag or press Enter to open</p>
    </div>
  )
}

function BirthdayExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <PopUpCard
        label="Birthday card for Maya"
        pieces={BIRTHDAY}
        openOnView
        openAngle={96}
        width={480}
        depth={280}
        cover={<BirthdayCover />}
        inside={<BirthdayInside />}
        base={<BirthdayBase />}
        className="max-w-[640px]"
      />
      <Text size="caption" tone="faint">
        Drag up and down to open and close it, sideways to walk around it.
      </Text>
    </div>
  )
}

const BUILDINGS = [
  { x: -170, w: 58, h: 150, d: 36 },
  { x: -112, w: 46, h: 196, d: 36 },
  { x: -58, w: 60, h: 168, d: 36 },
  { x: 62, w: 52, h: 210, d: 36 },
  { x: 118, w: 60, h: 158, d: 36 },
  { x: 176, w: 50, h: 184, d: 36 },
  { x: -150, w: 70, h: 104, d: 92 },
  { x: -80, w: 58, h: 126, d: 92 },
  { x: 90, w: 64, h: 112, d: 92 },
  { x: 160, w: 60, h: 96, d: 92 },
]

function Windows({ lit }: { lit: number }) {
  const rand = seeded(lit)
  return (
    <div className="grid h-full w-full grid-cols-3 content-start gap-1.5 p-2">
      {Array.from({ length: 30 }, (_, i) => (
        <span
          key={i}
          className="h-2 rounded-[var(--radius-2)]"
          style={{ background: rand() > 0.55 ? 'var(--color-accent)' : 'color-mix(in oklab, var(--color-ink-inverse) 22%, transparent)' }}
        />
      ))}
    </div>
  )
}

const LAUNCH: PopUpCardPiece[] = [
  ...BUILDINGS.map(
    (b, i): PopUpCardPiece => ({
      id: `tower-${i}`,
      kind: 'parallel',
      x: b.x,
      width: b.w,
      height: b.h,
      depth: b.d,
      delay: (i % 6) * 0.1,
      paper: b.d < 50 ? 'color-mix(in oklab, var(--color-ink) 72%, var(--color-surface))' : 'color-mix(in oklab, var(--color-ink) 52%, var(--color-surface))',
      label: i === 0 ? 'A city skyline of paper towers' : undefined,
      children: <Windows lit={i + 3} />,
    }),
  ),
  {
    id: 'rocket',
    kind: 'v',
    width: 84,
    height: 210,
    glue: 30,
    spine: 52,
    delay: 0.35,
    paper: 'var(--color-surface)',
    label: 'A rocket lifting off from the middle of the city',
    children: (
      <svg viewBox="0 0 84 210" className="h-full w-full" aria-hidden="true">
        <path d="M42 8 C62 34 64 70 60 128 L24 128 C20 70 22 34 42 8 Z" fill="var(--color-surface-muted)" stroke="var(--color-ink)" strokeWidth="2" />
        <circle cx="42" cy="62" r="10" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="2" />
        <path d="M24 100 L8 136 L24 128 Z M60 100 L76 136 L60 128 Z" fill="var(--color-accent-strong)" stroke="var(--color-ink)" strokeWidth="2" />
        <path d="M28 128 C30 160 38 176 42 204 C46 176 54 160 56 128 Z" fill="#ff9a2e" opacity="0.9" />
        <path d="M34 128 C36 150 40 160 42 180 C44 160 48 150 50 128 Z" fill="#fff1b8" />
      </svg>
    ),
  },
  {
    id: 'banner',
    kind: 'parallel',
    width: 210,
    height: 58,
    depth: 168,
    delay: 0.55,
    paper: 'var(--color-accent)',
    label: 'A banner reading Northwind 2.0 is live',
    children: (
      <div className="flex h-full w-full flex-col items-center justify-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent-ink opacity-70">Northwind</p>
        <p className="text-xl font-extrabold leading-tight text-accent-ink">2.0 is live</p>
      </div>
    ),
  },
]

function LaunchInside() {
  return (
    <div className="relative h-full w-full bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-accent)_30%,var(--color-surface)),var(--color-surface)_75%)]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 280" aria-hidden="true">
        {Array.from({ length: 40 }, (_, i) => {
          const r = seeded(i + 40)
          return <circle key={i} cx={r() * 480} cy={r() * 150} r={0.8 + r() * 1.4} fill="var(--color-ink)" opacity={0.25} />
        })}
        <circle cx="380" cy="60" r="26" fill="var(--color-accent)" opacity="0.8" />
      </svg>
    </div>
  )
}

function LaunchExample() {
  const [angle, setAngle] = useState(92)
  const [yaw, setYaw] = useState(-18)
  const [pitch, setPitch] = useState(22)
  return (
    <div className="flex w-full flex-col gap-4">
      <PopUpCard
        label="Launch card with a paper city and a rocket"
        pieces={LAUNCH}
        angle={angle}
        onAngleChange={setAngle}
        yaw={yaw}
        pitch={pitch}
        width={480}
        depth={280}
        coverPaper="var(--color-ink)"
        cover={
          <div className="flex h-full w-full items-center justify-center">
            <p className="text-2xl font-extrabold text-ink-inverse">Something launched.</p>
          </div>
        }
        inside={<LaunchInside />}
        base={<div className="h-full w-full bg-[repeating-linear-gradient(90deg,transparent_0_38px,color-mix(in_oklab,var(--color-ink)_8%,transparent)_38px_40px)]" />}
        className="mx-auto max-w-[640px]"
      />
      <div className="flex flex-wrap gap-5">
        <Labelled label="Opening angle" value={`${Math.round(angle)}°`}>
          <Slider min={0} max={180} value={angle} onChange={(event) => setAngle(Number(event.target.value))} />
        </Labelled>
        <Labelled label="Turn" value={`${yaw}°`}>
          <Slider min={-60} max={60} value={yaw} onChange={(event) => setYaw(Number(event.target.value))} />
        </Labelled>
        <Labelled label="Elevation" value={`${pitch}°`}>
          <Slider min={8} max={50} value={pitch} onChange={(event) => setPitch(Number(event.target.value))} />
        </Labelled>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ parallax portal */

function Painting({ seed, className }: { seed: number; className?: string }) {
  const rand = seeded(seed)
  const shapes = Array.from({ length: 7 }, () => ({ x: rand() * 100, y: rand() * 70, r: 8 + rand() * 22, a: rand() }))
  return (
    <div className={`border-[6px] border-[color-mix(in_oklab,var(--color-ink)_78%,var(--color-surface))] bg-surface p-2 shadow-[var(--shadow-float)] ${className ?? ''}`}>
      <svg viewBox="0 0 100 70" className="h-full w-full bg-[color-mix(in_oklab,var(--color-accent)_14%,var(--color-surface))]" aria-hidden="true">
        {shapes.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={i % 3 === 0 ? 'var(--color-accent)' : i % 3 === 1 ? 'var(--color-ink)' : 'var(--color-accent-strong)'}
            opacity={0.25 + s.a * 0.6}
          />
        ))}
        <path d={`M0 ${50 + rand() * 10} Q50 ${30 + rand() * 20} 100 ${48 + rand() * 12} V70 H0 Z`} fill="var(--color-ink)" opacity="0.8" />
      </svg>
    </div>
  )
}

const GALLERY_WALL = 'color-mix(in oklab, var(--color-surface) 88%, var(--color-accent) 12%)'

const GALLERY_WALLS = {
  back: (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: GALLERY_WALL }}>
      <Painting seed={11} className="h-[46%] w-[40%]" />
      <div className="rounded-[var(--radius-2)] bg-surface px-2 py-1 text-[9px] font-semibold text-ink-soft shadow-[var(--shadow-tile)]">
        Room 3 · Light studies, 2026
      </div>
    </div>
  ),
  left: (
    <div className="absolute inset-0 flex items-center justify-around px-8" style={{ background: GALLERY_WALL }}>
      <Painting seed={4} className="h-[34%] w-[26%]" />
      <Painting seed={21} className="h-[40%] w-[30%]" />
    </div>
  ),
  right: (
    <div className="absolute inset-0 flex items-center justify-around px-8" style={{ background: GALLERY_WALL }}>
      <Painting seed={32} className="h-[40%] w-[30%]" />
      <Painting seed={8} className="h-[30%] w-[24%]" />
    </div>
  ),
  floor: (
    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,color-mix(in_oklab,var(--color-ink)_14%,var(--color-surface))_0_46px,color-mix(in_oklab,var(--color-ink)_22%,var(--color-surface))_46px_48px)]">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,color-mix(in_oklab,white_18%,transparent)_55%,transparent)]" />
    </div>
  ),
  ceiling: (
    <div className="absolute inset-0 bg-surface-muted">
      <div className="absolute inset-x-[18%] top-[20%] h-[18%] rounded-[var(--radius-4)] bg-surface shadow-[0_0_40px_color-mix(in_oklab,white_70%,transparent)]" />
      <div className="absolute inset-x-[18%] top-[58%] h-[18%] rounded-[var(--radius-4)] bg-surface shadow-[0_0_40px_color-mix(in_oklab,white_70%,transparent)]" />
    </div>
  ),
}

function Bench() {
  return (
    <svg viewBox="0 0 200 60" className="w-[200px]" aria-hidden="true">
      <rect x="0" y="8" width="200" height="16" rx="3" fill="color-mix(in oklab, var(--color-ink) 70%, var(--color-accent))" />
      <rect x="14" y="24" width="10" height="36" fill="var(--color-ink)" />
      <rect x="176" y="24" width="10" height="36" fill="var(--color-ink)" />
    </svg>
  )
}

function Sculpture() {
  return (
    <svg viewBox="0 0 90 190" className="w-[90px]" aria-hidden="true">
      <path d="M45 6 C75 20 70 60 48 78 C30 94 70 104 60 124 L30 124 C20 104 42 94 26 70 C12 48 20 14 45 6 Z" fill="var(--color-accent)" />
      <rect x="10" y="124" width="70" height="66" fill="var(--color-surface)" stroke="var(--color-line-strong)" />
    </svg>
  )
}

function Plant() {
  return (
    <svg viewBox="0 0 160 220" className="w-[150px]" aria-hidden="true">
      {[-50, -25, 0, 25, 50, -70, 70].map((a, i) => (
        <path
          key={i}
          d="M80 150 C70 110 60 70 80 20 C100 70 90 110 80 150 Z"
          transform={`rotate(${a} 80 150)`}
          fill={i % 2 ? 'color-mix(in oklab, var(--color-accent-strong) 70%, var(--color-ink))' : 'var(--color-accent-strong)'}
        />
      ))}
      <path d="M50 150 H110 L102 220 H58 Z" fill="color-mix(in oklab, var(--color-ink) 80%, var(--color-surface))" />
    </svg>
  )
}

function GalleryExample() {
  return (
    <ParallaxPortal label="A small gallery room behind the page" walls={GALLERY_WALLS} depth={560} className="h-[380px]">
      <ParallaxPortalLayer depth={420} x={0.26}>
        <Sculpture />
      </ParallaxPortalLayer>
      <ParallaxPortalLayer depth={230} x={0.58}>
        <Bench />
      </ParallaxPortalLayer>
      <ParallaxPortalLayer depth={170} x={0.8} y={0} anchor="top">
        <div className="flex flex-col items-center">
          <span className="h-16 w-px bg-ink-faint" />
          <span className="h-5 w-12 rounded-t-full bg-ink" />
          <span className="h-3 w-16 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,white_90%,var(--color-accent)),transparent)]" />
        </div>
      </ParallaxPortalLayer>
      <ParallaxPortalLayer depth={-90} x={0.06} y={1.06}>
        <Plant />
      </ParallaxPortalLayer>
      <ParallaxPortalLayer depth={-60} x={0.88} y={0.2} anchor="center">
        <div className="w-[150px] rounded-[var(--radius-tile)] border border-line bg-surface p-3 shadow-[var(--shadow-window)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Now showing</p>
          <p className="text-sm font-bold text-ink">Light studies</p>
          <p className="text-xs text-ink-soft">Twelve works on paper</p>
        </div>
      </ParallaxPortalLayer>
    </ParallaxPortal>
  )
}

function Stars({ count, seed }: { count: number; seed: number }) {
  const stars = useMemo(() => {
    const rand = seeded(seed)
    return Array.from({ length: count }, () => ({ x: rand() * 400, y: rand() * 250, r: rand() ** 3 * 1.6 + 0.3, o: 0.4 + rand() * 0.6 }))
  }, [count, seed])
  return (
    <>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.o} />
      ))}
    </>
  )
}

function SpaceWindow() {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 400 250" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-neb`} cx="30%" cy="40%" r="60%">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-planet`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--color-accent) 70%, white)" />
          <stop offset="0.55" stopColor="color-mix(in oklab, var(--color-accent) 60%, #123)" />
          <stop offset="1" stopColor="#050810" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="#04060c" />
      <rect width="400" height="250" fill={`url(#${id}-neb)`} />
      <Stars count={160} seed={3} />
      <circle cx="290" cy="170" r="92" fill={`url(#${id}-planet)`} />
      <ellipse cx="290" cy="170" rx="150" ry="18" fill="none" stroke="color-mix(in oklab, var(--color-accent) 50%, white)" strokeOpacity="0.45" strokeWidth="3" transform="rotate(-14 290 170)" />
    </svg>
  )
}

const HULL = 'color-mix(in oklab, var(--color-ink) 18%, var(--color-surface-muted))'
const PANELS = `repeating-linear-gradient(90deg, transparent 0 78px, color-mix(in oklab, var(--color-ink) 20%, transparent) 78px 80px), repeating-linear-gradient(0deg, transparent 0 58px, color-mix(in oklab, var(--color-ink) 14%, transparent) 58px 60px), ${HULL}`

const SHIP_WALLS = {
  back: (
    <div className="absolute inset-0 p-[7%]" style={{ background: PANELS }}>
      <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-banner)] border-[6px] border-[color-mix(in_oklab,var(--color-ink)_60%,var(--color-surface))] shadow-[inset_0_0_30px_black]">
        <SpaceWindow />
        <div className="absolute inset-y-0 left-1/3 w-2 bg-[color-mix(in_oklab,var(--color-ink)_60%,var(--color-surface))]" />
        <div className="absolute inset-y-0 left-2/3 w-2 bg-[color-mix(in_oklab,var(--color-ink)_60%,var(--color-surface))]" />
      </div>
    </div>
  ),
  left: (
    <div className="absolute inset-0" style={{ background: PANELS }}>
      <div className="absolute inset-x-0 top-[62%] h-1 bg-accent shadow-[0_0_14px_var(--color-accent)]" />
    </div>
  ),
  right: (
    <div className="absolute inset-0" style={{ background: PANELS }}>
      <div className="absolute inset-x-0 top-[62%] h-1 bg-accent shadow-[0_0_14px_var(--color-accent)]" />
    </div>
  ),
  floor: (
    <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_10px,color-mix(in_oklab,var(--color-ink)_22%,transparent)_10px_12px),repeating-linear-gradient(90deg,transparent_0_10px,color-mix(in_oklab,var(--color-ink)_22%,transparent)_10px_12px)]" style={{ backgroundColor: HULL }} />
  ),
  ceiling: (
    <div className="absolute inset-0" style={{ background: PANELS }}>
      <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-surface shadow-[0_0_24px_color-mix(in_oklab,white_80%,transparent)]" />
    </div>
  ),
}

function StarshipExample() {
  const [intensity, setIntensity] = useState(0.8)
  const [depth, setDepth] = useState(420)
  return (
    <div className="flex w-full flex-col gap-4">
      <ParallaxPortal label="The bridge of a starship, looking out at a ringed planet" walls={SHIP_WALLS} depth={depth} intensity={intensity} className="h-[340px]">
        <ParallaxPortalLayer depth={Math.round(depth * 0.55)} x={0.5} y={0.46} anchor="center">
          <svg viewBox="0 0 100 100" className="w-[110px] opacity-80 drop-shadow-[0_0_12px_var(--color-accent)]" aria-hidden="true">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-accent)" strokeWidth="1.2" />
            <ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="var(--color-accent)" strokeWidth="1" />
            <ellipse cx="50" cy="50" rx="14" ry="40" fill="none" stroke="var(--color-accent)" strokeWidth="1" />
            <ellipse cx="50" cy="50" rx="30" ry="40" fill="none" stroke="var(--color-accent)" strokeWidth="0.6" />
          </svg>
        </ParallaxPortalLayer>
        <ParallaxPortalLayer depth={70} x={0.5}>
          <div className="flex h-[54px] w-[300px] items-center justify-center gap-2 rounded-t-[var(--radius-card)] bg-[color-mix(in_oklab,var(--color-ink)_70%,var(--color-surface))] px-4">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="h-2 w-5 rounded-full" style={{ background: i % 3 ? 'var(--color-accent)' : 'color-mix(in oklab, var(--color-ink-inverse) 40%, transparent)' }} />
            ))}
          </div>
        </ParallaxPortalLayer>
        <ParallaxPortalLayer depth={-110} x={0.5} y={1.1}>
          <svg viewBox="0 0 220 150" className="w-[220px]" aria-hidden="true">
            <path d="M40 150 V70 C40 20 180 20 180 70 V150 Z" fill="color-mix(in oklab, var(--color-ink) 85%, var(--color-surface))" />
            <path d="M58 150 V78 C58 42 162 42 162 78 V150 Z" fill="color-mix(in oklab, var(--color-ink) 70%, var(--color-accent))" />
          </svg>
        </ParallaxPortalLayer>
      </ParallaxPortal>
      <div className="flex flex-wrap gap-5">
        <Labelled label="Intensity" value={intensity.toFixed(2)}>
          <Slider min={0} max={150} value={Math.round(intensity * 100)} onChange={(event) => setIntensity(Number(event.target.value) / 100)} />
        </Labelled>
        <Labelled label="Room depth" value={`${depth}px`}>
          <Slider min={160} max={900} step={20} value={depth} onChange={(event) => setDepth(Number(event.target.value))} />
        </Labelled>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- infinite zoom */

const SPACE = '#03050b'

function GalaxyArt({ small = false }: { small?: boolean }) {
  const id = useId().replace(/:/g, '')
  const stars = useMemo(() => {
    const rand = seeded(99)
    return Array.from({ length: small ? 160 : 900 }, (_, i) => {
      const arm = i % 2
      const t = rand() ** 0.7 * 3.4
      const angle = t * 1.9 + arm * Math.PI + (rand() - 0.5) * 0.55
      const radius = 4 + t * 13 + (rand() - 0.5) * 5
      return {
        x: 80 + Math.cos(angle) * radius * 1.25,
        y: 50 + Math.sin(angle) * radius * 0.72,
        r: rand() ** 4 * 0.9 + 0.18,
        hot: rand() > 0.72,
      }
    })
  }, [small])
  return (
    <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff8e4" />
          <stop offset="0.35" stopColor="color-mix(in oklab, var(--color-accent) 50%, #ffd9a0)" stopOpacity="0.7" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-haze`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="100" fill={SPACE} />
      <ellipse cx="80" cy="50" rx="70" ry="42" fill={`url(#${id}-haze)`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.hot ? 'color-mix(in oklab, var(--color-accent) 60%, white)' : 'white'} opacity={0.85} />
      ))}
      <ellipse cx="80" cy="50" rx="16" ry="10" fill={`url(#${id}-core)`} />
      {!small && <circle cx="104.8" cy="57.4" r="0.7" fill="#fff3c4" />}
    </svg>
  )
}

function SolarArt() {
  const id = useId().replace(/:/g, '')
  const orbits = [16, 26, 40, 58, 78]
  return (
    <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-sun`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.4" stopColor="#ffd166" />
          <stop offset="1" stopColor="#ff9f1c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="100" fill={SPACE} />
      <Stars count={60} seed={12} />
      {orbits.map((r) => (
        <ellipse key={r} cx="40" cy="50" rx={r} ry={r * 0.42} fill="none" stroke="white" strokeOpacity="0.16" strokeWidth="0.3" />
      ))}
      <circle cx="40" cy="50" r="12" fill={`url(#${id}-sun)`} />
      <circle cx="54" cy="46" r="1" fill="#b9a38a" />
      <circle cx="28" cy="58" r="1.3" fill="#e6c07b" />
      <circle cx="96" cy="60" r="2.2" fill="#2f7fc4" />
      <circle cx="96" cy="60" r="2.3" fill="none" stroke="#5fb7ff" strokeOpacity="0.5" strokeWidth="0.25" />
      <circle cx="72" cy="36" r="2.6" fill="#d9a066" />
      <circle cx="110" cy="42" r="2" fill="#e8d6a8" />
      <ellipse cx="110" cy="42" rx="3.6" ry="0.9" fill="none" stroke="#e8d6a8" strokeWidth="0.3" />
    </svg>
  )
}

function PlanetArt() {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-sea`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#5fb7ff" />
          <stop offset="0.7" stopColor="#1c5fa8" />
          <stop offset="1" stopColor="#0b2446" />
        </radialGradient>
        <radialGradient id={`${id}-night`} cx="15%" cy="20%" r="100%">
          <stop offset="0.55" stopColor="black" stopOpacity="0" />
          <stop offset="1" stopColor="black" stopOpacity="0.75" />
        </radialGradient>
        <clipPath id={`${id}-disc`}>
          <circle cx="80" cy="50" r="44" />
        </clipPath>
      </defs>
      <rect width="160" height="100" fill={SPACE} />
      <Stars count={40} seed={31} />
      <circle cx="80" cy="50" r="46" fill="#5fb7ff" opacity="0.12" />
      <circle cx="80" cy="50" r="44" fill={`url(#${id}-sea)`} />
      <g clipPath={`url(#${id}-disc)`}>
        <path d="M52 22 C66 16 78 24 74 34 C70 44 86 46 84 56 C82 66 64 64 58 56 C50 46 40 30 52 22 Z" fill="#5f9e5a" />
        <path d="M92 60 C104 54 118 60 116 72 C114 84 98 88 92 80 C86 72 84 64 92 60 Z" fill="#6aa760" />
        <path d="M98 20 C108 18 116 26 110 32 C104 36 94 30 98 20 Z" fill="#8bb46d" />
        <path d="M40 40 C60 36 70 44 90 40 M60 70 C80 66 100 74 124 66 M70 18 C84 14 96 20 110 14" stroke="white" strokeOpacity="0.55" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
      <circle cx="80" cy="50" r="44" fill={`url(#${id}-night)`} />
      <circle cx="84.5" cy="55.5" r="0.9" fill="#ffd27a" />
      <circle cx="84.5" cy="55.5" r="2" fill="#ffd27a" opacity="0.3" />
    </svg>
  )
}

function CityArt() {
  const blocks = useMemo(() => {
    const rand = seeded(5)
    const out: { x: number; y: number; w: number; h: number; tone: number }[] = []
    for (let gx = 0; gx < 160; gx += 16) {
      for (let gy = 0; gy < 100; gy += 14) {
        if (gy > 34 && gy < 52) continue
        for (let k = 0; k < 3; k++) {
          out.push({ x: gx + 2 + rand() * 6, y: gy + 2 + rand() * 5, w: 3 + rand() * 5, h: 3 + rand() * 4, tone: rand() })
        }
      }
    }
    return out
  }, [])
  return (
    <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <rect width="160" height="100" fill="#1b2027" />
      <path d="M0 40 C40 36 70 50 100 42 C120 37 140 44 160 40 V48 C140 52 120 45 100 50 C70 58 40 44 0 48 Z" fill="#1f4f7a" />
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.tone > 0.85 ? '#3e6b3f' : b.tone > 0.3 ? '#3a414c' : '#4a525e'} />
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <path key={i} d={`M${i * 16} 0 V100`} stroke="#f5c96a" strokeOpacity="0.25" strokeWidth="0.35" />
      ))}
      <rect x="83.8" y="55.8" width="10.4" height="7.4" fill="#586271" />
      <rect x="85.8" y="57.5" width="6.4" height="4" fill="#ffd27a" />
    </svg>
  )
}

function RoomArt() {
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <rect width="160" height="100" fill="color-mix(in oklab, var(--color-accent) 18%, #efe7da)" />
        <rect y="78" width="160" height="22" fill="#8a6547" />
        <rect y="77" width="160" height="1.4" fill="#6d4e36" />
        <rect x="64" y="19" width="32" height="22" fill="#5b4332" />
        <rect x="66.4" y="20.6" width="27.2" height="18.8" fill="#caa56a" />
        <path d="M34 78 V60 C34 54 38 52 44 52 H116 C122 52 126 54 126 60 V78 Z" fill="color-mix(in oklab, var(--color-accent) 55%, #3b4a5a)" />
        <rect x="30" y="62" width="100" height="16" rx="3" fill="color-mix(in oklab, var(--color-accent) 45%, #2e3a48)" />
        <path d="M140 78 V40 M134 40 H146 L142 30 H138 Z" stroke="#3a3a3a" strokeWidth="1" fill="#ffe7a8" />
        <ellipse cx="140" cy="36" rx="14" ry="10" fill="#ffe7a8" opacity="0.18" />
        <path d="M14 78 L18 64 H26 L30 78 Z" fill="#b86b4b" />
        <path d="M22 64 C12 50 14 40 22 34 C28 42 30 52 22 64 Z M22 64 C30 52 38 50 40 44 C32 44 26 52 22 64 Z" fill="#4f8a4b" />
      </svg>
      <div className="absolute" style={{ left: `${(67.2 / 160) * 100}%`, top: '21.4%', width: '16%', height: '16%' }}>
        <GalaxyArt small />
      </div>
    </div>
  )
}

const POWERS = [
  <InfiniteZoomScene key="galaxy" label="Galaxy" caption="10²¹ m · a spiral of four hundred billion stars" next={{ x: 102.4 / 160, y: 55.6 / 100, size: 0.03 }}>
    <GalaxyArt />
  </InfiniteZoomScene>,
  <InfiniteZoomScene key="solar" label="Solar system" caption="10¹³ m · one star and its planets" next={{ x: 92 / 160, y: 57.5 / 100, size: 0.05 }}>
    <SolarArt />
  </InfiniteZoomScene>,
  <InfiniteZoomScene key="planet" label="Planet" caption="10⁷ m · oceans, weather, lights at night" next={{ x: 80.5 / 160, y: 53 / 100, size: 0.05 }}>
    <PlanetArt />
  </InfiniteZoomScene>,
  <InfiniteZoomScene key="city" label="City" caption="10⁴ m · a river town at dusk" next={{ x: 85.8 / 160, y: 0.575, size: 0.04 }}>
    <CityArt />
  </InfiniteZoomScene>,
  <InfiniteZoomScene key="room" label="Room" caption="10⁰ m · and a picture on the wall" next={{ x: 67.2 / 160, y: 0.214, size: 0.16 }}>
    <RoomArt />
  </InfiniteZoomScene>,
]

function PowersExample() {
  return (
    <InfiniteZoom label="Powers of ten, from a galaxy down to a picture of the same galaxy" autoplay className="h-[420px]">
      {POWERS}
    </InfiniteZoom>
  )
}

function SpeedExample() {
  const [speed, setSpeed] = useState(0.25)
  return (
    <div className="flex w-full flex-col gap-4">
      <InfiniteZoom label="Powers of ten at a chosen speed" autoplay speed={speed} className="h-[300px]">
        {POWERS}
      </InfiniteZoom>
      <Labelled label="Dive speed" value={`${speed.toFixed(2)} scenes/s`}>
        <Slider min={2} max={80} value={Math.round(speed * 100)} onChange={(event) => setSpeed(Number(event.target.value) / 100)} />
      </Labelled>
    </div>
  )
}

/* ------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'pop-up-card': {
    description:
      'A folded card that opens like a pop-up book, with paper standing up in 3D. Every panel is placed by real fold geometry: parallel folds are parallelogram linkages that keep their faces parallel to the pages, and V-folds are spherical linkages whose spine angle is solved in closed form from the opening angle. Shading and the soft shadow on the page come from the same normals, so the paper reads as paper at every angle.',
    sections: [
      {
        title: 'A birthday card',
        description: 'It opens by itself the first time it scrolls into view; the cake tiers, candles and balloons lift in sequence.',
        Content: BirthdayExample,
        note: motionNote('the card opens straight to its final pose, with no tween; dragging and the keys still work.'),
      },
      {
        title: 'Opening angle, turn and elevation',
        description: 'Controlled. A paper city of parallel folds, a V-fold rocket at the gutter and a banner in front.',
        Content: LaunchExample,
      },
      rationale(
        'Greeting, launch and onboarding moments want one delightful object, and most “3D cards” are a flat face on a tilt.',
        'Real pop-up linkages are cheap to solve and read instantly as paper; CSS 3D keeps the panels live DOM, so any content can be printed on them.',
        'Celebration screens, launch announcements, empty states that should feel like a gift.',
        ['Slider', 'Text'],
      ),
    ],
    props: [
      { name: 'pieces', type: 'PopUpCardPiece[]', description: 'Each piece: kind (parallel or v), width, height, depth or glue/spine, x, delay, paper, children and a label.' },
      { name: 'label', type: 'string', description: 'Accessible name of the card, which is a slider for its opening angle.' },
      { name: 'angle / defaultAngle / onAngleChange', type: 'number / number / fn', defaultValue: '— / 0', description: 'Opening angle in degrees, 0 shut to 180 flat.' },
      { name: 'openAngle / openOnView', type: 'number / boolean', defaultValue: '100 / false', description: 'Where a click or Enter opens to, and whether it opens itself on first sight.' },
      { name: 'width / depth', type: 'number / number', defaultValue: '460 / 250', description: 'Card size along the fold and out from it, px.' },
      { name: 'pitch / yaw', type: 'number / number', defaultValue: '24 / -14', description: 'Camera elevation and turn, degrees.' },
      { name: 'cover / inside / base', type: 'ReactNode', description: 'What is printed on the outside, the back page and the base page.' },
      { name: 'paper / coverPaper', type: 'string', defaultValue: 'surface / accent', description: 'Paper colours, any CSS colour.' },
    ],
  },

  'parallax-portal': {
    description:
      'The component frame becomes a window into a room behind the screen. The pointer moves the perspective origin rather than the room — an off-axis projection — so the frame stays put while the room shears behind it, exactly as a real window does when you lean. Props at a negative depth come through the glass and past the frame edge.',
    sections: [
      {
        title: 'A gallery room',
        description: 'Move the pointer over it, or focus it and use the arrow keys. On a phone, a button turns on steering by tilt.',
        Content: GalleryExample,
        note: motionNote('the view holds still at the centre viewpoint; nothing drifts or follows the pointer.'),
      },
      {
        title: 'Starship window, with intensity and depth',
        description: 'The room, the window and the chair are all gradients and SVG; the chair sits in front of the frame.',
        Content: StarshipExample,
      },
      rationale(
        'Hero sections want depth, and the usual answer — layers sliding at different speeds — never looks like a place.',
        'Moving the eye point instead of the scene gives true perspective with no WebGL: two style writes a frame, and it sleeps when idle or off screen.',
        'Landing heroes, product showcases, 404 pages, anywhere a small scene can carry the mood.',
        ['Slider'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name of the view.' },
      { name: 'children', type: 'ParallaxPortalLayer[]', description: 'Props placed by depth (px behind the frame; negative is in front), x and y fractions, and an anchor.' },
      { name: 'walls', type: 'ParallaxPortalWalls', description: 'What is painted on back, floor, ceiling, left and right. Missing surfaces get a lined panel.' },
      { name: 'depth / perspective', type: 'number / number', defaultValue: '520 / 760', description: 'Room depth, and the eye’s distance from the frame, px.' },
      { name: 'intensity', type: 'number', defaultValue: '0.7', description: 'How far the eye may travel, as a fraction of half the frame.' },
      { name: 'idle / tilt / paused', type: 'boolean', defaultValue: 'true / true / false', description: 'Drift when unattended, offer tilt steering on phones, or hold still.' },
    ],
  },

  'infinite-zoom': {
    description:
      'An endless zoom through nested scenes, where each contains the next and the last contains the first. The camera is a single log-scale depth kept modulo the number of scenes, so it loops forever with no numeric drift. Only two or three scenes are mounted at a time, composed with transforms, and each new one crossfades in over its parent’s drawing of it.',
    sections: [
      {
        title: 'Powers of ten',
        description: 'A galaxy, a solar system, a planet, a city, a room — and on the wall, the galaxy. Scroll, drag, pinch, press + and −, or scrub.',
        Content: PowersExample,
        note: motionNote('there is no dive; the buttons, keys and wheel step one whole scene at a time, with no continuous zoom.'),
      },
      {
        title: 'Dive speed',
        description: 'Autoplay is scenes per second along the log scale, so every level takes the same time however big its jump.',
        Content: SpeedExample,
      },
      rationale(
        'Showing scale — of data, of a product, of the universe — usually means a static diagram with arrows.',
        'A log-scale camera over nested scenes makes scale something you travel through, and wrapping by the loop factor makes it endless without growing numbers.',
        'Storytelling pages, onboarding that zooms from overview to detail, playful about pages, education.',
        ['IconButton', 'Slider'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Accessible name of the view.' },
      { name: 'children', type: 'InfiniteZoomScene[]', description: 'Scenes, outermost first. Each has a label, an optional caption and next: the rect (x, y, size fractions) where the next scene sits.' },
      { name: 'autoplay / speed', type: 'boolean / number', defaultValue: 'false / 0.12', description: 'Dive on its own, in scenes per second.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze the camera.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Show the depth indicator, scrub bar and buttons.' },
    ],
  },
}
