import { useRef, useState } from 'react'
import {
  Badge,
  Button,
  FluidCanvas,
  ReactionDiffusion,
  REACTION_DIFFUSION_PRESETS,
  SegmentedControl,
  Slider,
  Switch,
  Text,
  type FluidCanvasHandle,
  type FluidCanvasQuality,
  type ReactionDiffusionHandle,
  type ReactionDiffusionPreset,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- FluidCanvas */

function FluidHeroExample() {
  const fluid = useRef<FluidCanvasHandle>(null)
  const [status, setStatus] = useState('starting')
  return (
    <div className="flex w-full flex-col gap-3">
      <FluidCanvas
        ref={fluid}
        quality="high"
        onStatusChange={setStatus}
        className="h-[440px] rounded-[var(--radius-card)] border border-line"
      >
        <div className="pointer-events-none flex h-full flex-col items-start justify-end gap-3 p-8 sm:p-10">
          <Badge tone="neutral">Klyv 4.0</Badge>
          <Text as="h3" size="display" weight="extrabold" leading="tight" className="max-w-[520px] tracking-[-0.03em]">
            Interfaces with a current running through them
          </Text>
          <Text tone="soft" className="max-w-[440px]">
            Move the pointer, or drag with a few fingers. Leave it alone and it keeps drifting on its own.
          </Text>
          <div className="pointer-events-auto mt-2 flex flex-wrap gap-2">
            <Button>Start building</Button>
            <Button variant="white" onClick={() => fluid.current?.splat()}>
              Stir it
            </Button>
          </div>
        </div>
      </FluidCanvas>
      <Text size="caption" tone="faint" aria-live="polite">
        Status: {status}. Switch the theme or accent: the dye already on screen changes colour with it.
      </Text>
    </div>
  )
}

const TOKEN_SETS: Record<string, 'accent' | string[]> = {
  accent: 'accent',
  status: ['var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', 'var(--color-accent)'],
  ink: ['var(--color-ink)', 'var(--color-ink-soft)', 'var(--color-accent)', 'var(--color-ink-faint)'],
}

function FluidControlsExample() {
  const fluid = useRef<FluidCanvasHandle>(null)
  const [quality, setQuality] = useState<FluidCanvasQuality>('medium')
  const [palette, setPalette] = useState('accent')
  const [dissipation, setDissipation] = useState(4)
  const [curl, setCurl] = useState(24)
  const [radius, setRadius] = useState(22)
  const [glow, setGlow] = useState(50)
  const [idle, setIdle] = useState(true)
  const [paused, setPaused] = useState(false)
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl
          label="Quality"
          size="sm"
          value={quality}
          onValueChange={setQuality}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
        <SegmentedControl
          label="Colours"
          size="sm"
          value={palette}
          onValueChange={setPalette}
          options={[
            { value: 'accent', label: 'From accent' },
            { value: 'status', label: 'Status tokens' },
            { value: 'ink', label: 'Ink' },
          ]}
        />
      </div>
      <FluidCanvas
        ref={fluid}
        quality={quality}
        colors={TOKEN_SETS[palette]}
        dissipation={dissipation / 10}
        curl={curl}
        splatRadius={radius / 100}
        glow={glow / 100}
        idle={idle}
        paused={paused}
        captureTouch
        label="Fluid simulation playground"
        className="h-[340px] rounded-[var(--radius-card)] border border-line"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Fade · {(dissipation / 10).toFixed(1)}/s
          </Text>
          <Slider min={0} max={40} value={dissipation} onChange={(event) => setDissipation(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Curl · {curl}
          </Text>
          <Slider min={0} max={50} value={curl} onChange={(event) => setCurl(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Splat radius · {(radius / 100).toFixed(2)}
          </Text>
          <Slider min={5} max={80} value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Glow · {glow}%
          </Text>
          <Slider min={0} max={100} value={glow} onChange={(event) => setGlow(Number(event.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={idle} onChange={(event) => setIdle(event.target.checked)} />
          Idle drift
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
          Paused
        </label>
        <Button size="sm" variant="outline" onClick={() => fluid.current?.splat()}>
          Stir
        </Button>
      </div>
    </div>
  )
}

function FluidCardExample() {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
      <FluidCanvas quality="low" glow={0} dissipation={0.6} className="h-[220px] rounded-[var(--radius-card)] border border-line">
        <div className="pointer-events-none flex h-full flex-col justify-between p-5">
          <Badge tone="neutral">Pro plan</Badge>
          <div>
            <Text size="heading" weight="extrabold">
              €24<span className="text-[14px] font-semibold text-ink-soft"> / month</span>
            </Text>
            <Text size="caption" tone="soft">
              Low quality: a 64-cell grid, no bloom. Still fluid, cheap enough for a card.
            </Text>
          </div>
        </div>
      </FluidCanvas>
      <FluidCanvas
        quality="medium"
        colors={['var(--color-accent)']}
        curl={40}
        splatRadius={0.12}
        className="h-[220px] rounded-[var(--radius-card)] border border-line"
      >
        <div className="pointer-events-none flex h-full flex-col justify-end p-5">
          <Text size="label" weight="bold">
            One colour, high curl
          </Text>
          <Text size="caption" tone="soft">
            A single token and strong vorticity: fine, smoke-like filaments.
          </Text>
        </div>
      </FluidCanvas>
    </div>
  )
}

/* ---------------------------------------------------------------- ReactionDiffusion */

const PRESET_OPTIONS: { value: ReactionDiffusionPreset; label: string }[] = [
  { value: 'coral', label: 'Coral' },
  { value: 'mitosis', label: 'Mitosis' },
  { value: 'fingerprints', label: 'Fingerprints' },
  { value: 'maze', label: 'Maze' },
  { value: 'spots', label: 'Spots' },
  { value: 'worms', label: 'Worms' },
]

function ReactionHeroExample() {
  const dish = useRef<ReactionDiffusionHandle>(null)
  const [preset, setPreset] = useState<ReactionDiffusionPreset>('coral')
  const [emboss, setEmboss] = useState(60)
  return (
    <div className="flex w-full flex-col gap-4">
      <ReactionDiffusion
        ref={dish}
        seedText={'Grown,\nnot drawn'}
        preset={preset}
        emboss={emboss / 100}
        className="h-[400px] rounded-[var(--radius-card)] border border-line"
      />
      <SegmentedControl label="Pattern" size="sm" value={preset} onValueChange={setPreset} options={PRESET_OPTIONS} />
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Emboss lighting · {emboss}%
          </Text>
          <Slider min={0} max={100} value={emboss} onChange={(event) => setEmboss(Number(event.target.value))} />
        </label>
        <Button size="sm" variant="outline" onClick={() => dish.current?.reset()}>
          Regrow the headline
        </Button>
      </div>
      <Text size="caption" tone="faint">
        Switch patterns while it grows: the feed and kill rates glide to the new pair, so one pattern turns into the next.
      </Text>
    </div>
  )
}

function ReactionLabExample() {
  const dish = useRef<ReactionDiffusionHandle>(null)
  const [preset, setPreset] = useState<ReactionDiffusionPreset>('mitosis')
  const [feed, setFeed] = useState(REACTION_DIFFUSION_PRESETS.mitosis.feed * 10000)
  const [kill, setKill] = useState(REACTION_DIFFUSION_PRESETS.mitosis.kill * 10000)
  const [speed, setSpeed] = useState(12)
  const [paused, setPaused] = useState(false)
  const choose = (value: ReactionDiffusionPreset) => {
    setPreset(value)
    setFeed(REACTION_DIFFUSION_PRESETS[value].feed * 10000)
    setKill(REACTION_DIFFUSION_PRESETS[value].kill * 10000)
  }
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl label="Start from" size="sm" value={preset} onValueChange={choose} options={PRESET_OPTIONS} />
      <ReactionDiffusion
        ref={dish}
        feed={feed / 10000}
        kill={kill / 10000}
        speed={speed}
        paused={paused}
        emboss={0.35}
        label="Reaction–diffusion dish. Drag to paint chemical B."
        className="h-[320px] rounded-[var(--radius-card)] border border-line"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Feed · {(feed / 10000).toFixed(4)}
          </Text>
          <Slider min={100} max={900} value={feed} onChange={(event) => setFeed(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Kill · {(kill / 10000).toFixed(4)}
          </Text>
          <Slider min={450} max={700} value={kill} onChange={(event) => setKill(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Steps per frame · {speed}
          </Text>
          <Slider min={1} max={32} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
          Paused
        </label>
        <Button size="sm" variant="outline" onClick={() => dish.current?.seed()}>
          Drop a seed
        </Button>
        <Button size="sm" variant="ghost" onClick={() => dish.current?.reset()}>
          Clear the dish
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'fluid-canvas': {
    description:
      'A real-time fluid simulation to put behind content: Jos Stam’s stable fluids on the GPU, as GPU Gems chapter 38 lays them out. Each frame the velocity field gets vorticity confinement, a Jacobi pressure solve that makes it divergence-free, and self-advection; dye rides along in half-float textures that ping-pong between frames. Pointers and every touch point inject velocity and dye in colours derived from the accent, and an idle drift keeps a hero from ever going still. The dye stores palette weights rather than RGB, so a theme or accent change recolours what is already on screen.',
    sections: [
      {
        title: 'Hero background',
        description: 'Hover or drag across the panel — the headline and buttons sit on top and the fluid still stirs under them.',
        Content: FluidHeroExample,
        bare: true,
        note: motionNote('a few splats are simulated off screen into a still frame, and a click adds one and shows the settled result.'),
      },
      {
        title: 'Every parameter',
        description: 'Quality sets the grid and dye resolution; colours can be any tokens. Touch drags stir here instead of scrolling.',
        Content: FluidControlsExample,
      },
      { title: 'Smaller surfaces', description: 'Two cheaper settings for cards and tiles.', Content: FluidCardExample },
      rationale(
        'Hero backgrounds are usually a looping video or a gradient: heavy, or static, and neither answers the reader.',
        'A GPU solver at a modest grid costs a few milliseconds a frame, reacts to every pointer, and takes its colour from the theme instead of a file.',
        'Landing heroes, empty states worth lingering on, launch pages and interactive section breaks.',
        ['ShaderCanvas conventions', 'gl-sim ping-pong helper', 'Theme tokens'],
      ),
    ],
    props: [
      { name: 'colors', type: "'accent' | string[]", defaultValue: "'accent'", description: 'Up to four CSS colours or tokens, or a set derived from the accent.' },
      { name: 'dissipation', type: 'number', defaultValue: '0.4', description: 'How fast the dye fades, per second.' },
      { name: 'curl', type: 'number', defaultValue: '24', description: 'Vorticity confinement strength; 0 is laminar.' },
      { name: 'splatRadius', type: 'number', defaultValue: '0.22', description: 'Splat size as a fraction of the shorter side.' },
      { name: 'quality', type: "'low' | 'medium' | 'high'", defaultValue: "'medium'", description: 'Simulation grid, dye resolution and pressure iterations.' },
      { name: 'glow', type: 'number', defaultValue: '0.5', description: 'Bloom strength, 0–1. Off at low quality.' },
      { name: 'idle', type: 'boolean', defaultValue: 'true', description: 'Gentle random splats after a few seconds untouched.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze on the current frame.' },
      { name: 'captureTouch', type: 'boolean', defaultValue: 'false', description: 'Touch drags stir instead of scrolling the page.' },
      { name: 'label', type: 'string', description: 'Accessible name. Without it the canvas is decorative and hidden.' },
      { name: 'onStatusChange', type: "(status: 'starting' | 'running' | 'unsupported') => void", description: 'Called when it starts or falls back.' },
      { name: 'ref', type: 'FluidCanvasHandle', description: '{ splat(x?, y?) } — stir from code, or from a button as a keyboard route.' },
      { name: 'children', type: 'ReactNode', description: 'Content drawn on top.' },
    ],
  },

  'reaction-diffusion': {
    description:
      'Gray–Scott reaction–diffusion on the GPU: two chemicals in float textures, one feeding and one consuming the other, stepped a dozen times a frame until coral, fingerprints, mazes or dividing cells emerge. A headline can be the seed — it is drawn in the theme font into a mask, and a raised kill rate outside the letters keeps the pattern growing inside the words, so they stay readable. The pointer paints chemical B, presets glide across the feed/kill map instead of jumping, and concentration is coloured on a ramp from surface through accent to ink, with optional emboss lighting.',
    sections: [
      {
        title: 'A headline that grows',
        description: 'Watch the letters fill in, then switch patterns while it grows. Drag across the dish to paint more.',
        Content: ReactionHeroExample,
        bare: true,
        note: motionNote('the pattern is grown off screen in chunks and shown as a finished still; a click seeds more and shows it grown.'),
      },
      {
        title: 'The feed/kill map',
        description: 'Start from a preset and nudge feed and kill: small moves cross into very different patterns.',
        Content: ReactionLabExample,
      },
      rationale(
        'Generative texture usually means a baked image or a noise shader, and neither grows, responds or carries a message.',
        'Gray–Scott is two lines of maths that produce endlessly varied organic form, and seeding it with text turns a headline into the pattern.',
        'Launch pages, science and biotech brands, generative art sections, and loading moments that reward watching.',
        ['gl-sim ping-pong helper', 'SegmentedControl', 'Slider', 'Button'],
      ),
    ],
    props: [
      { name: 'preset', type: "'coral' | 'mitosis' | 'fingerprints' | 'maze' | 'spots' | 'worms'", defaultValue: "'coral'", description: 'A feed/kill pair; changes morph smoothly.' },
      { name: 'feed', type: 'number', description: 'Feed rate, overriding the preset. 0.01–0.1.' },
      { name: 'kill', type: 'number', description: 'Kill rate, overriding the preset. 0.045–0.07.' },
      { name: 'speed', type: 'number', defaultValue: '12', description: 'Simulation steps per frame.' },
      { name: 'seedText', type: 'string', description: 'Text drawn into the seed in the theme font; `\\n` for a second line.' },
      { name: 'contain', type: 'boolean', defaultValue: 'true', description: 'With seedText, keep the pattern inside the letters.' },
      { name: 'emboss', type: 'number', defaultValue: '0.6', description: 'Pseudo-3D lighting, 0–1.' },
      { name: 'brushSize', type: 'number', defaultValue: '0.03', description: 'Paint brush radius as a fraction of the shorter side.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze on the current frame.' },
      { name: 'label', type: 'string', description: 'Accessible name. Defaults to the seed text, else the canvas is decorative.' },
      { name: 'ref', type: 'ReactionDiffusionHandle', description: '{ reset(), seed(x?, y?) } — reseed or drop B from code or a button.' },
      { name: 'children', type: 'ReactNode', description: 'Content drawn on top.' },
    ],
  },
}
