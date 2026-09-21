import { useEffect, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Field,
  LightCaster,
  RainGlass,
  SegmentedControl,
  Slider,
  Switch,
  Text,
  type LightCasterLayer,
  type LightCasterLight,
  type RainGlassHandle,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

const card = 'rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]'

/* ------------------------------------------------------------------ LightCaster */

const METRICS = [
  ['Monthly revenue', '$48,210', '+12.4%'],
  ['Active seats', '1,284', '+86'],
  ['Churn', '1.9%', '−0.3 pts'],
  ['Open tickets', '37', '−11'],
  ['NPS', '62', '+4'],
  ['Uptime', '99.98%', '30 days'],
]

function LampGrid() {
  const [lights, setLights] = useState<LightCasterLight[]>([{ id: 'lamp', x: 0.5, y: 0.08, label: 'Desk lamp', radius: 900 }])
  const [ambient, setAmbient] = useState(42)
  const [softness, setSoftness] = useState(14)
  const [reach, setReach] = useState(900)
  const [follow, setFollow] = useState(false)
  const [sway, setSway] = useState(true)
  const [layer, setLayer] = useState<LightCasterLayer>('over')
  const lamp = lights[0]!
  return (
    <div className="flex w-full flex-col gap-4">
      <LightCaster
        lights={lights.map((light) => ({ ...light, radius: reach }))}
        onLightsChange={setLights}
        ambient={ambient / 100}
        softness={softness}
        layer={layer}
        followPointer={follow}
        motion={sway ? 'sway' : 'none'}
        className="grid h-[420px] grid-cols-2 content-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface-sunken p-8 sm:grid-cols-3 sm:gap-6 sm:p-12"
      >
        {METRICS.map(([label, value, delta]) => (
          <div key={label} data-occluder className={card}>
            <Text size="caption" tone="faint" weight="semibold">
              {label}
            </Text>
            <Text size="heading" className="mt-1">
              {value}
            </Text>
            <Badge tone="neutral" className="mt-2">
              {delta}
            </Badge>
          </div>
        ))}
      </LightCaster>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={`Ambient light: ${ambient}%`}>
          <Slider min={0} max={90} value={ambient} onChange={(event) => setAmbient(Number(event.target.value))} />
        </Field>
        <Field label={`Lamp size (penumbra): ${softness}px`}>
          <Slider min={0} max={40} value={softness} onChange={(event) => setSoftness(Number(event.target.value))} />
        </Field>
        <Field label={`Reach: ${reach}px`}>
          <Slider min={200} max={1400} step={20} value={reach} onChange={(event) => setReach(Number(event.target.value))} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <SegmentedControl
          label="Layer"
          size="sm"
          value={layer}
          onValueChange={setLayer}
          options={[
            { value: 'over', label: 'Over the content' },
            { value: 'under', label: 'Floor only' },
          ]}
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
          Follow the pointer
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={sway} onChange={(event) => setSway(event.target.checked)} />
          Lamp sways
        </label>
        <Text size="caption" tone="faint">
          Lamp at {Math.round(lamp.x * 100)}% × {Math.round(lamp.y * 100)}%. Drag it, or focus it and use the arrow keys.
        </Text>
      </div>
    </div>
  )
}

function ColouredLights() {
  return (
    <LightCaster
      defaultLights={[
        { id: 'warm', x: 0.18, y: 0.3, color: 'var(--color-danger)', label: 'Red light', intensity: 1.1 },
        { id: 'cool', x: 0.82, y: 0.7, color: 'var(--color-accent)', label: 'Accent light', intensity: 1.1 },
      ]}
      ambient={0.3}
      softness={10}
      className="flex h-[320px] items-center justify-center gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-8"
    >
      {['Plan', 'Build', 'Ship'].map((word, index) => (
        <div
          key={word}
          data-occluder
          className={`${card} grid size-24 place-items-center ${index === 1 ? 'translate-y-6' : '-translate-y-4'}`}
        >
          <Text size="heading">{word}</Text>
        </div>
      ))}
    </LightCaster>
  )
}

const HOURS = [
  ['VI', 'left-[6%] top-1/2 -translate-y-1/2'],
  ['IX', 'left-[24%] top-[12%]'],
  ['XII', 'left-1/2 top-[6%] -translate-x-1/2'],
  ['III', 'right-[24%] top-[12%]'],
  ['VI', 'right-[6%] top-1/2 -translate-y-1/2'],
  ['IX', 'right-[24%] bottom-[12%]'],
  ['XII', 'left-1/2 bottom-[6%] -translate-x-1/2'],
  ['III', 'left-[24%] bottom-[12%]'],
]

function Sundial() {
  return (
    <LightCaster
      defaultLights={[{ id: 'sun', x: 0.5, y: 0.02, label: 'Sun', color: 'color-mix(in oklab, var(--color-warning) 45%, white)' }]}
      motion="orbit"
      speed={0.6}
      ambient={0.5}
      softness={22}
      layer="under"
      className="relative h-[340px] rounded-[var(--radius-card)] border border-line bg-surface-muted"
    >
      <div
        data-occluder
        className="absolute left-1/2 top-1/2 grid h-10 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[var(--radius-6)] border border-line bg-surface font-mono text-[12px] font-semibold text-ink-soft shadow-[var(--shadow-tile)]"
      >
        gnomon
      </div>
      {HOURS.map(([hour, place], index) => (
        <div
          key={`${hour}-${index}`}
          data-occluder
          className={`absolute ${place} rounded-[var(--radius-6)] border border-line bg-surface px-2.5 py-1 font-mono text-[12px] font-bold text-ink shadow-[var(--shadow-tile)]`}
        >
          {hour}
        </div>
      ))}
    </LightCaster>
  )
}

/* ------------------------------------------------------------------ RainGlass */

type SceneChoice = 'city' | 'bokeh' | 'canvas'

/** A “photo” for the custom-background demo, painted in code: a dusk ridge line lit in the accent. */
function useRidgeCanvas() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const target = document.createElement('canvas')
    target.width = 960
    target.height = 540
    const context = target.getContext('2d')
    if (!context) return
    const read = (name: string) => {
      const probe = document.createElement('span')
      probe.style.color = `var(${name})`
      document.body.append(probe)
      const colour = getComputedStyle(probe).color
      probe.remove()
      return colour
    }
    const accent = read('--color-accent')
    const warning = read('--color-warning')
    const ink = read('--color-ink')
    const sky = context.createLinearGradient(0, 0, 0, 540)
    sky.addColorStop(0, ink)
    sky.addColorStop(0.55, accent)
    sky.addColorStop(1, warning)
    context.fillStyle = sky
    context.fillRect(0, 0, 960, 540)
    context.globalAlpha = 0.85
    context.fillStyle = warning
    context.beginPath()
    context.arc(640, 300, 70, 0, Math.PI * 2)
    context.fill()
    for (let layer = 0; layer < 3; layer++) {
      context.globalAlpha = 0.55 + layer * 0.2
      context.fillStyle = ink
      context.beginPath()
      context.moveTo(0, 540)
      for (let x = 0; x <= 960; x += 24) {
        const y = 330 + layer * 60 + Math.sin(x / (90 - layer * 20) + layer * 2) * (40 - layer * 8) + Math.sin(x / 31) * 8
        context.lineTo(x, y)
      }
      context.lineTo(960, 540)
      context.fill()
    }
    context.globalAlpha = 1
    setCanvas(target)
  }, [])
  return canvas
}

function RainHero() {
  const glass = useRef<RainGlassHandle>(null)
  const [scene, setScene] = useState<SceneChoice>('city')
  const [intensity, setIntensity] = useState(55)
  const [dropSize, setDropSize] = useState(100)
  const [fog, setFog] = useState(75)
  const [paused, setPaused] = useState(false)
  const ridge = useRidgeCanvas()
  const background = scene === 'canvas' ? (ridge ?? 'bokeh') : scene
  return (
    <div className="flex w-full flex-col gap-4">
      <RainGlass
        ref={glass}
        background={background}
        intensity={intensity / 100}
        dropSize={dropSize / 100}
        fog={fog / 100}
        paused={paused}
        label="Rain running down a fogged window, with city lights blurred behind it"
        className="h-[440px] rounded-[var(--radius-card)] border border-line"
      >
        <div className="pointer-events-none flex h-full items-end p-6">
          <div className="pointer-events-auto flex max-w-[340px] flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface/85 p-4 shadow-[var(--shadow-float)] backdrop-blur-md">
            <Text size="caption" tone="faint" weight="semibold" className="uppercase tracking-wider">
              Tonight · Lisbon
            </Text>
            <Text size="heading">Rain until 21:00, 11°</Text>
            <Text size="caption" tone="soft">
              Drag across the glass to wipe the fog, or clear it from the keyboard.
            </Text>
            <div className="flex gap-2">
              <Button size="sm" variant="accent" onClick={() => glass.current?.wipeBand(0.35)}>
                Wipe a band
              </Button>
              <Button size="sm" variant="ghost" onClick={() => glass.current?.wipe()}>
                Clear all fog
              </Button>
            </div>
          </div>
        </div>
      </RainGlass>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={`Intensity: ${intensity}%`}>
          <Slider min={0} max={100} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
        </Field>
        <Field label={`Drop size: ${(dropSize / 100).toFixed(2)}×`}>
          <Slider min={50} max={180} step={5} value={dropSize} onChange={(event) => setDropSize(Number(event.target.value))} />
        </Field>
        <Field label={`Fog: ${fog}%`}>
          <Slider min={0} max={100} value={fog} onChange={(event) => setFog(Number(event.target.value))} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <SegmentedControl
          label="Behind the glass"
          size="sm"
          value={scene}
          onValueChange={setScene}
          options={[
            { value: 'city', label: 'City at night' },
            { value: 'bokeh', label: 'Bokeh' },
            { value: 'canvas', label: 'Your own canvas' },
          ]}
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
          Pause the rain
        </label>
      </div>
    </div>
  )
}

function Drizzle() {
  return (
    <RainGlass background="bokeh" intensity={0.18} dropSize={0.7} fog={0.35} className="h-[220px] rounded-[var(--radius-card)] border border-line">
      <div className="flex h-full flex-col items-start justify-center gap-1 p-8">
        <Text size="caption" weight="bold" tone="soft" className="uppercase tracking-wider">
          Quiet hours
        </Text>
        <Text size="heading" className="max-w-[380px] rounded-[var(--radius-6)] bg-surface/70 px-2 py-1 backdrop-blur-sm">
          Notifications are paused until 08:00
        </Text>
      </div>
    </RainGlass>
  )
}

function Downpour() {
  return (
    <RainGlass background="city" intensity={1} dropSize={1.5} fog={0.95} fogReturn={6} className="h-[220px] rounded-[var(--radius-card)] border border-line" />
  )
}

/* ------------------------------------------------------------------ module */

export const demos: ExampleModule = {
  'light-caster': {
    description:
      'Real light and shadow over real elements. It measures the boxes of the content it wraps, casts a 2D visibility polygon from each light against their edges, and multiplies the result onto the page, so shadows start at a card’s edge and fall away from the lamp. The penumbra comes from sampling each light across its body, coloured lights add as light does, and every light has a handle you can drag or move with the arrow keys.',
    sections: [
      {
        title: 'A lamp over a dashboard',
        description: 'Drag the lamp, or tab to it and use the arrow keys (Shift for bigger steps). The cards are the occluders.',
        Content: LampGrid,
        note: motionNote('the lamp stops swaying and stays where you put it; dragging and the arrow keys still move it.'),
      },
      {
        title: 'Two coloured lights',
        description: 'Red and accent light add where both reach, and each card’s shadow is tinted by the light it blocks.',
        Content: ColouredLights,
      },
      {
        title: 'A sundial',
        description: 'The sun orbits the gnomon and the hour blocks; with the light under the content, only the floor darkens.',
        Content: Sundial,
        note: motionNote('the sun holds still at noon; drag it to move the shadows.'),
      },
      rationale(
        'Glows that follow the pointer brighten a patch and know nothing about the layout, so they read as a filter rather than light.',
        'Measuring real elements and casting visibility polygons gives shadows that start at edges and respond to layout, scroll and resize.',
        'Product heroes, feature grids, empty states and playful dashboards where a light the reader can move invites them to look.',
        ['canvas 2D', 'ResizeObserver', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The content; its elements are the occluders.' },
      { name: 'lights', type: 'LightCasterLight[]', description: 'Controlled lights: id, x and y (0–1), color, intensity, radius, label.' },
      { name: 'defaultLights', type: 'LightCasterLight[]', defaultValue: 'one lamp', description: 'Lights for uncontrolled use.' },
      { name: 'onLightsChange', type: '(lights) => void', description: 'Called when a light is dragged, nudged or follows the pointer.' },
      { name: 'ambient', type: 'number', defaultValue: '0.42', description: 'Light in the shadows, 0–1. Darker on dark themes.' },
      { name: 'softness', type: 'number', defaultValue: '14', description: 'Size of the light in pixels; sets the penumbra width.' },
      { name: 'samples', type: 'number', defaultValue: '6', description: 'Jittered positions per light, 1–8.' },
      { name: 'layer', type: "'over' | 'under'", defaultValue: 'over', description: 'Light the content itself, or only the floor beneath it.' },
      { name: 'occluders', type: 'string', defaultValue: '[data-occluder]', description: 'Selector for shadow casters; falls back to direct children.' },
      { name: 'followPointer', type: 'boolean', defaultValue: 'false', description: 'The first light follows the pointer.' },
      { name: 'motion', type: "'none' | 'sway' | 'orbit'", defaultValue: 'none', description: 'Motion of the lights on their own; off under reduced motion.' },
      { name: 'speed', type: 'number', defaultValue: '1', description: 'Multiplier for motion.' },
      { name: 'showHandles', type: 'boolean', defaultValue: 'true', description: 'Show the draggable, focusable light handles.' },
    ],
  },

  'rain-glass': {
    description:
      'Rain on a window pane, simulated rather than looped. Drops spawn, grow, merge and slide in stick–slip runs that leave trails of beads and wipe the fog; a WebGL shader turns each drop into a lens over the background, with a highlight and a dark rim, above a fogged layer that slowly returns. It refracts an image — a picture you pass or a city or bokeh scene drawn in code — not the live page. Drag to wipe the glass like a finger.',
    sections: [
      {
        title: 'A window at night',
        description: 'Drag across the pane to wipe it. The buttons are the keyboard route to the same thing.',
        Content: RainHero,
        note: motionNote('the rain is simulated ahead of time and shown as a still pane; wiping the fog still works.'),
      },
      { title: 'Drizzle behind a banner', description: 'Bokeh, light rain and a thin fog.', Content: Drizzle },
      { title: 'Downpour', description: 'Big drops, heavy fog that comes back in six seconds.', Content: Downpour },
      rationale(
        'Rain effects are usually a looping video or streaks drawn over a page, with no refraction and nothing to touch.',
        'A drop simulation feeding a lens shader gives drops that merge, run and clear the fog, and the glass responds to a finger.',
        'Weather and travel products, ambient heroes, focus or sleep screens and anywhere a calm, tactile surface sets a mood.',
        ['WebGL', 'canvas 2D', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'background', type: "'city' | 'bokeh' | string | HTMLCanvasElement", defaultValue: 'city', description: 'What is refracted: a built-in scene, an image URL or a canvas. Never the live page.' },
      { name: 'intensity', type: 'number', defaultValue: '0.5', description: 'How hard it rains, 0–1.' },
      { name: 'dropSize', type: 'number', defaultValue: '1', description: 'Multiplier for drop size.' },
      { name: 'fog', type: 'number', defaultValue: '0.75', description: 'Fog strength, 0–1.' },
      { name: 'fogReturn', type: 'number', defaultValue: '14', description: 'Seconds for wiped glass to fog over again.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze the rain; wiping still works.' },
      { name: 'wipe', type: 'boolean', defaultValue: 'true', description: 'Pointer drags wipe the fog. Sets touch-action: none.' },
      { name: 'label', type: 'string', description: 'Names the pane as an image; without it the canvas is hidden.' },
      { name: 'onStatusChange', type: '(status) => void', description: 'starting, running or unsupported.' },
      { name: 'ref', type: 'RainGlassHandle', description: 'wipe() and wipeBand(at) for a keyboard route to wiping.' },
    ],
  },
}
