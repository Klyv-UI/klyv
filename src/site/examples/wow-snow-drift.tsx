import { useRef, useState } from 'react'
import {
  Badge,
  Button,
  Field,
  SegmentedControl,
  Slider,
  SnowDrift,
  Switch,
  Text,
  type SnowDriftHandle,
  type SnowDriftTone,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

const card = 'rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]'

const PLANS = [
  ['Starter', '€0', 'For trying it out'],
  ['Team', '€24', 'Per seat, per month'],
  ['Scale', '€60', 'With SSO and audit logs'],
]

/* ------------------------------------------------------------------ hero */

function SnowHero() {
  const snow = useRef<SnowDriftHandle>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <SnowDrift
        ref={snow}
        depth={6}
        className="flex h-[460px] flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface-sunken p-8 sm:p-10"
      >
        <div className="flex flex-col items-start gap-3">
          <Badge tone="neutral">Winter release</Badge>
          <Text as="h3" size="display" weight="extrabold" leading="tight" className="max-w-[520px] tracking-[-0.03em]">
            Pricing that stays put
          </Text>
          <Text tone="soft" className="max-w-[440px]">
            Sweep the pointer across a pile to blow it back into the air. The links and buttons under the snow still work.
          </Text>
        </div>
        <div className="mt-auto grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map(([name, price, note]) => (
            <div key={name} data-snow className={card}>
              <Text size="caption" tone="faint" weight="semibold">
                {name}
              </Text>
              <Text size="heading" className="mt-1">
                {price}
              </Text>
              <Text size="caption" tone="soft">
                {note}
              </Text>
              <Button size="sm" variant="outline" className="mt-3">
                Choose {name}
              </Button>
            </div>
          ))}
        </div>
      </SnowDrift>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => snow.current?.gust()}>
          Blow it off
        </Button>
        <Button size="sm" variant="ghost" onClick={() => snow.current?.clear()}>
          Clear the snow
        </Button>
        <Text size="caption" tone="faint">
          Snow lands on the heading and on each card, slides off their edges and piles up on the floor.
        </Text>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ playground */

function SnowPlayground() {
  const snow = useRef<SnowDriftHandle>(null)
  const [intensity, setIntensity] = useState(140)
  const [wind, setWind] = useState(15)
  const [melt, setMelt] = useState(25)
  const [maxDepth, setMaxDepth] = useState(36)
  const [tone, setTone] = useState<SnowDriftTone>('snow')
  const [accumulate, setAccumulate] = useState(true)
  const [interactive, setInteractive] = useState(true)
  const [paused, setPaused] = useState(false)
  const [open, setOpen] = useState(false)
  return (
    <div className="flex w-full flex-col gap-4">
      <SnowDrift
        ref={snow}
        intensity={intensity}
        wind={wind / 100}
        melt={melt / 100}
        maxDepth={maxDepth}
        tone={tone}
        accumulate={accumulate}
        interactive={interactive}
        paused={paused}
        label="Snow settling on three cards and the floor beneath them"
        className="flex h-[380px] items-start gap-4 rounded-[var(--radius-card)] border border-line bg-surface-sunken p-6 pt-20 sm:gap-6 sm:p-10 sm:pt-24"
      >
        <div data-snow className={`${card} w-40`}>
          <Text size="label" weight="bold">
            Short
          </Text>
          <Text size="caption" tone="soft">
            A narrow ledge.
          </Text>
        </div>
        <div data-snow className={`${card} mt-16 flex-1`}>
          <Text size="label" weight="bold">
            Lower and wider
          </Text>
          <Text size="caption" tone="soft">
            Snow sliding off the short card lands here.
          </Text>
          {open && (
            <Text size="caption" tone="soft" className="mt-2">
              This card grew, so its neighbours were measured again. Its own snow rode down with it.
            </Text>
          )}
        </div>
        <div data-snow className={`${card} mt-6 w-32`}>
          <Text size="label" weight="bold">
            Corner
          </Text>
          <Text size="caption" tone="soft">
            Rounded, so snow slips off.
          </Text>
        </div>
      </SnowDrift>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={`Flakes per second: ${intensity}`}>
          <Slider min={0} max={400} step={10} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
        </Field>
        <Field label={`Wind: ${(wind / 100).toFixed(2)}`}>
          <Slider min={-100} max={100} value={wind} onChange={(event) => setWind(Number(event.target.value))} />
        </Field>
        <Field label={`Melt: ${(melt / 100).toFixed(2)} px/s`}>
          <Slider min={0} max={300} step={5} value={melt} onChange={(event) => setMelt(Number(event.target.value))} />
        </Field>
        <Field label={`Deepest pile: ${maxDepth}px`}>
          <Slider min={4} max={80} value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <SegmentedControl
          label="Tone"
          size="sm"
          value={tone}
          onValueChange={setTone}
          options={[
            { value: 'snow', label: 'Snow' },
            { value: 'accent', label: 'Accent' },
            { value: 'ink', label: 'Ash' },
          ]}
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={accumulate} onChange={(event) => setAccumulate(event.target.checked)} />
          Settle
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={interactive} onChange={(event) => setInteractive(event.target.checked)} />
          Pointer gusts
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
          Paused
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)} aria-pressed={open}>
          {open ? 'Close the middle card' : 'Open the middle card'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => snow.current?.gust()}>
          Gust
        </Button>
        <Button size="sm" variant="ghost" onClick={() => snow.current?.clear()}>
          Clear
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ opt-in surfaces */

function SnowOptIn() {
  return (
    <SnowDrift
      selector="[data-snow]"
      intensity={60}
      wind={-0.3}
      depth={10}
      maxDepth={22}
      className="grid h-[280px] place-items-center rounded-[var(--radius-card)] border border-line bg-surface p-6"
    >
      <div data-snow className={`${card} w-full max-w-[340px]`}>
        <Text size="label" weight="bold">
          Only this card collects snow
        </Text>
        <Text size="caption" tone="soft" className="mt-1">
          With <code className="font-mono">selector=&quot;[data-snow]&quot;</code> the heading and button inside it are
          not surfaces, and a card’s top edge is higher than anything in it anyway. A left wind drifts the pile right to
          left.
        </Text>
        <Button size="sm" className="mt-3">
          Still clickable
        </Button>
      </div>
    </SnowDrift>
  )
}

/* ------------------------------------------------------------------ module */

export const demos: ExampleModule = {
  'snow-drift': {
    description:
      'Snow that falls on the page’s own elements. Like LightCaster it reads the layout: the elements a selector finds are measured with getBoundingClientRect and kept current with ResizeObservers, on scroll and on DOM changes, and their top edges become the ground of a heightfield with a column every two pixels. Flakes fall through curl noise (Bridson et al., 2007) with drag and flutter; one that lands adds to its column, and a thermal-erosion pass (Musgrave et al., 1989) lets any slope steeper than snow’s angle of repose slide, so piles become drifts and slough off a card’s edge onto the floor. Piles melt and are capped. A pointer sweep gusts the air and throws settled snow back up; nothing is captured, so everything underneath stays clickable.',
    sections: [
      {
        title: 'On a real page',
        description: 'A heading and three cards. Let it build for a few seconds, then sweep the pointer across a pile.',
        Content: SnowHero,
        bare: true,
        note: motionNote(
          'nothing falls. The snow is computed as already settled, relaxed to its angle of repose, and drawn as a still; a “Let it snow” button settles another layer at once.',
        ),
      },
      {
        title: 'Every parameter',
        description:
          'Open the middle card to watch the ground re-measured. Push the wind to either side and the drifts lean with it; turn melt up and the piles sink.',
        Content: SnowPlayground,
      },
      { title: 'Choosing surfaces', description: 'A selector limits where snow can settle.', Content: SnowOptIn },
      rationale(
        'Seasonal snow on a site is usually a GIF or a particle layer that falls straight through the page and knows nothing about what is on it.',
        'Settling on the real elements is what makes it read as weather rather than a screensaver, and a 1D heightfield with thermal erosion is cheap enough to run beside any page.',
        'Seasonal landing pages, holiday campaigns, empty states and playful error pages, over content that must stay usable.',
        ['LightCaster’s layout measuring', 'Button', 'Theme tokens'],
      ),
    ],
    props: [
      { name: 'selector', type: 'string', defaultValue: "'[data-snow], h1, h2, h3, img, button'", description: 'Elements whose top edges are the ground. Falls back to direct children.' },
      { name: 'intensity', type: 'number', defaultValue: '110', description: 'Flakes per second across the region.' },
      { name: 'wind', type: 'number', defaultValue: '0.12', description: 'Steady wind, −1 (left) to 1 (right). Also stirs the turbulence.' },
      { name: 'accumulate', type: 'boolean', defaultValue: 'true', description: 'Let flakes settle. Off, they fall past everything.' },
      { name: 'melt', type: 'number', defaultValue: '0.25', description: 'How fast piles sink, in pixels a second.' },
      { name: 'depth', type: 'number', defaultValue: '0', description: 'Snow already settled when it first appears, in pixels.' },
      { name: 'maxDepth', type: 'number', defaultValue: '36', description: 'The deepest a pile can get, in pixels.' },
      { name: 'tone', type: "'snow' | 'accent' | 'ink'", defaultValue: "'snow'", description: 'Colour, read from theme tokens.' },
      { name: 'interactive', type: 'boolean', defaultValue: 'true', description: 'Pointer sweeps gust the air and blow settled snow up.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze falling flakes. Settled snow stays.' },
      { name: 'label', type: 'string', description: 'Accessible name. Without it the snow is decorative and hidden.' },
      { name: 'ref', type: 'SnowDriftHandle', description: '{ gust(), clear() } — blow the snow up, or remove it, from code or a button.' },
      { name: 'children', type: 'ReactNode', description: 'The content it snows on.' },
      { name: 'className', type: 'string', description: 'Merged last. Layout classes here lay out the children directly.' },
    ],
  },
}
