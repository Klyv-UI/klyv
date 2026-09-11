import { useRef, useState } from 'react'
import { ArrowRight, Cloud, CreditCard, Database, Landmark, Pause, Play, Shield, Sparkles, Wallet } from 'lucide-react'
import {
  AnimatedBeam,
  AuroraSurface,
  BorderBeam,
  Button,
  IconTile,
  ParticleField,
  SegmentedControl,
  ShimmerButton,
  Surface,
  Tag,
  Text,
  Waveform,
  type AuroraIntensity,
} from 'citrine'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ----------------------------------------------------------- specimens */

function AuroraExample() {
  const [intensity, setIntensity] = useState<AuroraIntensity>('medium')
  const [paused, setPaused] = useState(false)

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Intensity"
          size="sm"
          value={intensity}
          onValueChange={(value) => setIntensity(value as AuroraIntensity)}
          options={[
            { value: 'soft', label: 'Soft' },
            { value: 'medium', label: 'Medium' },
            { value: 'bold', label: 'Bold' },
          ]}
        />
        <Button size="sm" variant="outline" onClick={() => setPaused((value) => !value)}>
          {paused ? 'Play' : 'Pause'}
        </Button>
      </div>

      <AuroraSurface
        intensity={intensity}
        paused={paused}
        grain
        className="min-h-[240px]"
        contentClassName="flex flex-col items-start gap-3 p-8"
      >
        <Tag size="sm" tone="accent">
          New this month
        </Tag>
        <Text as="h3" size="display" className="max-w-[18ch]">
          Everything you spend, in one place.
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[46ch]">
          The light behind this panel is three blurred gradients on transform loops at co-prime
          durations, so the composite never visibly repeats.
        </Text>
        <Button size="sm">Open the dashboard</Button>
      </AuroraSurface>
    </div>
  )
}

function ParticleExample() {
  return (
    <div className="relative min-h-[220px] w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-app">
      <ParticleField density={7} pull={120} />
      <div className="relative flex min-h-[220px] flex-col items-center justify-center gap-2 p-8 text-center">
        <Text size="subtitle">Move your pointer across the panel</Text>
        <Text size="caption" tone="soft" leading="normal" className="max-w-[44ch]">
          The dots drift on their own and lean towards the pointer inside a 120px radius. Links fade
          with distance, so the mesh thickens where the dots gather.
        </Text>
      </div>
    </div>
  )
}

function BeamExample() {
  const container = useRef<HTMLDivElement>(null)
  const wallet = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const bank = useRef<HTMLDivElement>(null)
  const core = useRef<HTMLDivElement>(null)
  const ledger = useRef<HTMLDivElement>(null)
  const vault = useRef<HTMLDivElement>(null)

  const node = (ref: React.RefObject<HTMLDivElement>, icon: typeof Wallet, label: string) => (
    <div ref={ref} className="relative z-10 flex flex-col items-center gap-1.5">
      <Surface
        variant="floating"
        className="h-12 w-12 items-center justify-center rounded-full border border-line"
      >
        <IconTile icon={icon} tone="muted" size="sm" />
      </Surface>
      <Text size="micro" tone="faint">
        {label}
      </Text>
    </div>
  )

  return (
    <div
      ref={container}
      className="relative flex w-full items-center justify-between gap-6 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-8"
    >
      <div className="flex flex-col gap-8">
        {node(wallet, Wallet, 'Wallet')}
        {node(card, CreditCard, 'Cards')}
        {node(bank, Landmark, 'Bank')}
      </div>

      {node(core, Cloud, 'Core')}

      <div className="flex flex-col gap-8">
        {node(ledger, Database, 'Ledger')}
        {node(vault, Shield, 'Vault')}
      </div>

      <AnimatedBeam containerRef={container} fromRef={wallet} toRef={core} curvature={-34} duration={2.6} />
      <AnimatedBeam containerRef={container} fromRef={card} toRef={core} curvature={0} duration={2.6} delay={0.5} />
      <AnimatedBeam containerRef={container} fromRef={bank} toRef={core} curvature={34} duration={2.6} delay={1} />
      <AnimatedBeam containerRef={container} fromRef={core} toRef={ledger} curvature={-28} duration={2.2} delay={0.8} />
      <AnimatedBeam containerRef={container} fromRef={core} toRef={vault} curvature={28} duration={2.2} delay={1.4} />
    </div>
  )
}

function WaveformExample() {
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0.42)

  return (
    <Surface variant="card" padding="lg" className="w-full max-w-[460px] gap-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="white" onClick={() => setPlaying((value) => !value)}>
          {playing ? <Pause size={14} strokeWidth={2.5} /> : <Play size={14} strokeWidth={2.5} />}
          {playing ? 'Pause' : 'Play'}
        </Button>
        <div className="flex min-w-0 flex-col">
          <Text size="body" truncate>
            Statement summary — September
          </Text>
          <Text size="caption" tone="faint" tabular>
            {Math.round(progress * 100)}% · 2:14
          </Text>
        </div>
      </div>

      <Waveform
        label="Statement summary audio"
        bars={44}
        playing={playing}
        progress={progress}
        height={52}
      />

      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(progress * 100)}
        aria-label="Playback position"
        onChange={(event) => setProgress(Number(event.target.value) / 100)}
        className="w-full accent-[var(--color-accent-strong)]"
      />
    </Surface>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'aurora-surface': {
    description:
      'A container lit from behind by three slowly drifting colour fields. The blur is applied once and never recalculated — only transform animates — which is the difference between a hero that holds 60fps and one that stutters on a laptop.',
    sections: [
      {
        title: 'Example',
        description: 'Change the intensity, or freeze the blobs to see where they actually are.',
        bare: true,
        Content: AuroraExample,
        note: motionNote('the blobs stop where they are; the colour, and so the contrast behind the text, is unchanged.'),
      },
      rationale(
        'A hero needs presence, and the usual answers are an image the design team has to maintain or a video that costs a megabyte and cannot follow the theme.',
        'Three gradients on transform loops cost nothing to ship, take their colours from the tokens, and never visibly repeat because the durations share no factor.',
        'A marketing hero, a sign-in panel, an onboarding step, an empty state that has to feel like a beginning rather than a failure.',
        ['Surface', 'colour tokens', 'CSS keyframes'],
      ),
    ],
    props: [
      { name: 'colors', type: '[string, string, string]', description: 'One colour per blob. Defaults to the accent family.' },
      { name: 'intensity', type: "'soft' | 'medium' | 'bold'", defaultValue: "'medium'", description: 'Opacity, blur and scale together.' },
      { name: 'grain', type: 'boolean', defaultValue: 'false', description: 'Fine noise overlay, so wide gradients do not band.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze the drift without removing the light.' },
      { name: 'contentClassName', type: 'string', description: 'Classes for the content layer above the light.' },
    ],
  },

  'particle-field': {
    description:
      'A drifting constellation on a canvas, linked by proximity and leaning towards the pointer. It is a canvas and not 90 divs because the link pass is quadratic over positions — thousands of distance checks a frame, which is nothing for a typed array and impossible for the DOM.',
    sections: [
      {
        title: 'Example',
        description: 'Absolutely positioned inside a relative container, under the content.',
        bare: true,
        Content: ParticleExample,
        note: motionNote('one frame is painted and the loop never starts — the texture survives, the movement does not.'),
      },
      rationale(
        'Ambient texture behind a hero usually arrives as a looping video or a heavy WebGL scene, both of which cost far more than the effect is worth.',
        'A canvas at a few hundred lines gives the same depth, follows the pointer, and re-scales itself to devicePixelRatio so it stays sharp through a resize.',
        'Behind a sign-in card, an empty dashboard, a marketing section, a loading screen that has to hold attention.',
        ['canvas', 'ResizeObserver', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'density', type: 'number', defaultValue: '6', description: 'Particles per 10,000 square pixels of surface.' },
      { name: 'speed / dotSize', type: 'number / number', defaultValue: '14 / 1.9', description: 'Drift rate in px/s, and dot radius.' },
      { name: 'linked', type: 'boolean', defaultValue: 'true', description: 'Draw lines between nearby particles.' },
      { name: 'pull', type: 'number', defaultValue: '110', description: 'Pointer attraction radius. 0 turns it off.' },
      { name: 'color', type: 'string', defaultValue: "'var(--color-accent-strong)'", description: 'Resolved from the token once, since canvas cannot read a CSS variable.' },
    ],
  },

  'border-beam': {
    description:
      'A light travelling around a border. It is one conic gradient spinning behind an opaque inner surface, so the only part ever visible is the ring — one rotate animation, no masking, and no background-position trick that breaks on rounded corners.',
    sections: [
      {
        title: 'Always, and on hover',
        description: 'Two beams at different delays, so neighbouring cards never march in step.',
        bare: true,
        stack: false,
        Content: () => (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <BorderBeam duration={5} contentClassName="flex flex-col items-start gap-2 p-5">
              <Tag size="sm" tone="accent">
                Recommended
              </Tag>
              <Text size="subtitle">Plus</Text>
              <Text size="caption" tone="soft" leading="normal">
                Runs continuously. Use it on the one card you want chosen.
              </Text>
            </BorderBeam>
            <BorderBeam duration={5} delay={2.5} onHover contentClassName="flex flex-col items-start gap-2 p-5">
              <Tag size="sm">On hover</Tag>
              <Text size="subtitle">Standard</Text>
              <Text size="caption" tone="soft" leading="normal">
                Lights only on hover or focus-within, so a grid of six is not a light show.
              </Text>
            </BorderBeam>
          </div>
        ),
        note: motionNote('the beam holds still and the border reads as a plain accent ring.'),
      },
      {
        title: 'Shapes',
        description: 'The spinning square is sized to the diagonal, so a wide banner works as well as a tile.',
        bare: true,
        Content: () => (
          <div className="flex w-full flex-col gap-3">
            <BorderBeam
              width={2}
              arc={0.14}
              radius="var(--radius-banner)"
              contentClassName="flex items-center justify-between gap-4 p-5"
            >
              <div className="flex flex-col gap-1">
                <Text size="heading">Your limit increase is being reviewed</Text>
                <Text size="caption" tone="soft">
                  Usually under two hours.
                </Text>
              </div>
              <Sparkles size={18} strokeWidth={2.25} className="text-ink-faint" aria-hidden="true" />
            </BorderBeam>
            <BorderBeam
              width={2}
              duration={3.5}
              radius="999px"
              className="self-start"
              contentClassName="px-4 py-2"
            >
              <Text size="caption" weight="bold">
                Processing
              </Text>
            </BorderBeam>
          </div>
        ),
      },
      rationale(
        'Marking one card as the live or recommended one usually means a colour, and colour alone is both easy to miss and unavailable to some readers.',
        'A moving edge is noticed without being loud, and it sits on the border rather than over the content, so nothing inside loses contrast.',
        'The recommended plan, a card that is syncing, an item awaiting review, the focused panel in a wizard.',
        ['conic-gradient', 'Surface', 'radius tokens'],
      ),
    ],
    props: [
      { name: 'width / radius', type: 'number / string', defaultValue: '1.5 / var(--radius-card)', description: 'Border thickness and corner radius.' },
      { name: 'duration / delay', type: 'number / number', defaultValue: '6 / 0', description: 'Seconds per lap, and where in the lap it starts.' },
      { name: 'arc', type: 'number', defaultValue: '0.22', description: 'Fraction of the lap that is lit. Small values read as a comet.' },
      { name: 'colors', type: '[string, string]', description: 'The lit arc, in order.' },
      { name: 'onHover', type: 'boolean', defaultValue: 'false', description: 'Run only while hovered or focused within.' },
    ],
  },

  'shimmer-button': {
    description:
      'A call to action with a sheen sweeping across it and a soft light that follows the pointer. The pointer light is written to CSS custom properties on the element rather than to React state, because a pointer move fires far more often than a frame.',
    sections: [
      {
        title: 'Tones and sizes',
        description: 'The label sits in its own layer, so it stays selectable and legible through both effects.',
        bare: true,
        Content: () => (
          <div className="flex w-full flex-wrap items-center gap-3">
            <ShimmerButton size="lg">
              <Sparkles size={16} strokeWidth={2.5} aria-hidden="true" />
              Upgrade to Plus
            </ShimmerButton>
            <ShimmerButton tone="ink">
              Send money
              <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
            </ShimmerButton>
            <ShimmerButton tone="glass" onHover>
              Sweeps on hover
            </ShimmerButton>
            <ShimmerButton size="sm" tone="glass" glow={false}>
              No glow
            </ShimmerButton>
          </div>
        ),
        note: motionNote('the sweep stops; the pointer light, which is not an animation, still tracks.'),
      },
      rationale(
        'A page usually has one action that matters more than the rest, and the only tools most systems offer are a bigger button or a louder colour.',
        'Movement draws the eye at a size and colour that still belong to the system, and `onHover` exists so the effect can be spent on one control rather than six.',
        'The primary action on a pricing card, an onboarding step, a paywall, an upgrade prompt.',
        ['Button semantics', 'CSS variables', 'colour tokens'],
      ),
    ],
    props: [
      { name: 'tone', type: "'accent' | 'ink' | 'glass'", defaultValue: "'accent'", description: 'Shell, sheen and glow colour together.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", defaultValue: "'md'", description: 'Height and padding.' },
      { name: 'duration', type: 'number', defaultValue: '3', description: 'Seconds between sweeps.' },
      { name: 'onHover', type: 'boolean', defaultValue: 'false', description: 'Sweep only on hover and focus. Paused, not unmounted, so it starts from the left edge.' },
      { name: 'glow', type: 'boolean', defaultValue: 'true', description: 'Pointer-following light across the face.' },
    ],
  },

  'animated-beam': {
    description:
      'A curved connector between two real elements, with light pulsing along it. It takes refs rather than coordinates because the endpoints are live UI: the path re-measures on resize and on any size change to either end, so it survives a breakpoint, a font swap or a node appearing mid-diagram.',
    sections: [
      {
        title: 'An integration diagram',
        description: 'Five beams, staggered by delay, all measured from the real node positions.',
        bare: true,
        Content: BeamExample,
        note: motionNote('the tracks are drawn and the pulses hold still — the diagram still reads correctly.'),
      },
      rationale(
        'Architecture and integration diagrams are normally exported images: they go stale, they cannot be themed, and they carry no text a reader or a search can reach.',
        'Real DOM nodes joined by measured SVG stay live — they reflow, follow the tokens, and the labels are still text.',
        'An integrations page, a "how it works" section, a systems diagram in documentation, a data-flow explainer.',
        ['SVG', 'ResizeObserver', 'stroke-dashoffset', 'Surface', 'IconTile'],
      ),
    ],
    props: [
      { name: 'containerRef / fromRef / toRef', type: 'RefObject<HTMLElement>', description: 'The positioned ancestor, and the two endpoints.' },
      { name: 'curvature', type: 'number', defaultValue: '60', description: 'Bow in pixels, perpendicular to the line. Negative bows the other way.' },
      { name: 'duration / delay / reverse', type: 'number / number / boolean', defaultValue: '3 / 0 / false', description: 'Pulse timing and direction.' },
      { name: 'beamColor / beamLength', type: 'string / number', defaultValue: 'accent / 46', description: 'The lit pulse.' },
      { name: 'pathColor / pathWidth / pathOpacity', type: 'string / number / number', description: 'The dim track underneath.' },
    ],
  },

  waveform: {
    description:
      'The bar visualiser, with a playhead. Given values it draws a real signal; given none it generates a stable envelope from the bar index, so the shape does not reshuffle every time the parent re-renders.',
    sections: [
      {
        title: 'A player',
        description: 'Drag the range: bars behind the playhead stay lit, bars ahead of it dim.',
        bare: true,
        Content: WaveformExample,
        note: motionNote('the bars hold their envelope, and the playhead still reads.'),
      },
      {
        title: 'Static, and as a live level',
        bare: true,
        Content: () => (
          <div className="flex w-full flex-wrap items-end gap-8">
            <div className="flex flex-col gap-2">
              <Text size="caption" tone="faint">
                Static signal
              </Text>
              <Waveform
                label="Recorded clip"
                values={[0.2, 0.5, 0.9, 0.7, 0.4, 0.85, 1, 0.6, 0.3, 0.5, 0.75, 0.4, 0.2, 0.6, 0.9]}
                tone="ink"
                height={40}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Text size="caption" tone="faint">
                Listening
              </Text>
              <Waveform label="Microphone level" bars={16} playing tone="success" height={40} />
            </div>
            <div className="flex flex-col gap-2">
              <Text size="caption" tone="faint">
                Muted
              </Text>
              <Waveform label="Muted input" bars={16} tone="danger" height={40} />
            </div>
          </div>
        ),
      },
      rationale(
        'Anything with audio — a voice note, a recorded call, a read-aloud summary — needs a visual that says both "this is sound" and "you are here in it".',
        'One scaleY keyframe per bar keeps the whole thing on the compositor, so a paused visualiser costs nothing, and the playhead is a plain opacity split rather than a second element.',
        'A voice note in a chat, a recorded support call, a microphone level, an audio summary of a statement.',
        ['colour tokens', 'CSS keyframes'],
      ),
    ],
    props: [
      { name: 'label', type: 'string', description: 'Required. What the bars represent — the component is role="img".' },
      { name: 'values / bars', type: 'number[] / number', defaultValue: '— / 32', description: 'A real signal, 0–1, or a generated envelope of this many bars.' },
      { name: 'playing', type: 'boolean', defaultValue: 'false', description: 'Animate the bars.' },
      { name: 'progress', type: 'number', description: 'Fraction played, 0–1. Bars ahead of it dim.' },
      { name: 'tone / height / barWidth / gap', type: 'string / number / number / number', description: 'Appearance.' },
    ],
  },
}
