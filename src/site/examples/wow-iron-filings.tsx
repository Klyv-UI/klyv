import { useRef, useState } from 'react'
import {
  Button,
  IronFilings,
  SegmentedControl,
  Slider,
  Switch,
  Text,
  type IronFilingsHandle,
  type IronFilingsMagnet,
  type IronFilingsTone,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- hero */

function IronFilingsHeroExample() {
  const card = useRef<IronFilingsHandle>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <IronFilings ref={card} label="Iron filings between two bar magnets" filings={4200} aspectRatio={16 / 9} />
      <Text size="caption" tone="faint">
        The two north ends face each other, so the filings between them lie every which way at the dashed ring: the
        neutral point, where the two fields cancel. Turn one magnet round with its grip and the gap fills with lines
        running straight across.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- playground */

type Arrangement = 'repel' | 'attract' | 'single' | 'needle'

const ARRANGEMENTS: Record<Arrangement, IronFilingsMagnet[]> = {
  repel: [
    { id: 'a', x: 0.3, y: 0.5, angle: 0 },
    { id: 'b', x: 0.7, y: 0.5, angle: 180 },
  ],
  attract: [
    { id: 'a', x: 0.3, y: 0.5, angle: 0 },
    { id: 'b', x: 0.7, y: 0.5, angle: 0 },
  ],
  single: [{ id: 'a', x: 0.5, y: 0.5, angle: 0 }],
  needle: [
    { id: 'a', x: 0.36, y: 0.5, angle: 0 },
    { id: 'b', x: 0.74, y: 0.34, angle: 90, poles: 'point', length: 0.3, label: 'Disc magnet' },
  ],
}

function IronFilingsPlaygroundExample() {
  const card = useRef<IronFilingsHandle>(null)
  const [arrangement, setArrangement] = useState<Arrangement>('attract')
  const [magnets, setMagnets] = useState<IronFilingsMagnet[]>(ARRANGEMENTS.attract)
  const [count, setCount] = useState(3200)
  const [strength, setStrength] = useState(10)
  const [lines, setLines] = useState(true)
  const [shading, setShading] = useState(false)
  const [tone, setTone] = useState<IronFilingsTone>('ink')

  const choose = (value: Arrangement) => {
    setArrangement(value)
    setMagnets(ARRANGEMENTS[value].map((magnet) => ({ ...magnet, strength: strength / 10 })))
  }
  const strengthen = (value: number) => {
    setStrength(value)
    setMagnets((current) => current.map((magnet, index) => (index === 0 ? { ...magnet, strength: value / 10 } : magnet)))
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Arrangement"
        size="sm"
        value={arrangement}
        onValueChange={choose}
        options={[
          { value: 'attract', label: 'North to south' },
          { value: 'repel', label: 'North to north' },
          { value: 'single', label: 'One bar' },
          { value: 'needle', label: 'Bar and disc' },
        ]}
      />
      <IronFilings
        ref={card}
        magnets={magnets}
        onMagnetsChange={setMagnets}
        filings={count}
        showFieldLines={lines}
        showStrength={shading}
        tone={tone}
        controls={false}
        label="Iron filings playground"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Filings · {count.toLocaleString('en-GB')}
          </Text>
          <Slider min={500} max={8000} step={100} value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            First magnet’s strength · {(strength / 10).toFixed(1)}×
          </Text>
          <Slider min={2} max={30} value={strength} onChange={(event) => strengthen(Number(event.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={lines} onChange={(event) => setLines(event.target.checked)} />
          Field lines
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={shading} onChange={(event) => setShading(event.target.checked)} />
          Strength shading
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={tone === 'accent'} onChange={(event) => setTone(event.target.checked ? 'accent' : 'ink')} />
          Accent filings
        </label>
        <Button size="sm" variant="outline" onClick={() => card.current?.shake()} className="ml-auto">
          Shake the card
        </Button>
      </div>
      <Text size="caption" tone="faint">
        Make the first magnet three times stronger and the neutral point in “North to north” slides towards the weaker
        one: it sits where the two fields are equal, not halfway.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- figures */

function IronFilingsFiguresExample() {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <IronFilings
          defaultMagnets={[{ id: 'bar', x: 0.5, y: 0.5, angle: 0, length: 0.42 }]}
          filings={2200}
          showFieldLines
          interactive={false}
          controls={false}
          aspectRatio={4 / 3}
          label="Field of a single bar magnet"
        />
        <Text size="caption" tone="soft">
          A textbook figure: one bar, filings and traced lines, nothing to drag.
        </Text>
      </div>
      <div className="flex flex-col gap-2">
        <IronFilings
          defaultMagnets={[{ id: 'disc', x: 0.5, y: 0.5, angle: -90, poles: 'point', length: 0.36 }]}
          filings={1800}
          showFilings={false}
          showFieldLines
          showStrength
          tone="accent"
          interactive={false}
          controls={false}
          aspectRatio={4 / 3}
          label="Field of a point dipole, shaded by strength"
        />
        <Text size="caption" tone="soft">
          A point dipole, B = (3r̂(m·r̂) − m)/r³, as lines over its strength. The shading falls off as 1/r³.
        </Text>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'iron-filings': {
    description:
      'Iron filings on a card over magnets you can drag and turn. The field is the sum of the magnets’ poles — a bar is two opposite point poles near its ends, the model a school magnet is taught with, and a small disc can be a true point dipole — and each of a few thousand filings turns towards the field where it lies with a torque proportional to the sine of the angle between them, overshooting slightly and settling. After the card is disturbed the filings also creep up the gradient of |B|, so they tuft at the poles. Field lines are traced separately by fourth-order Runge–Kutta from rings round each pole, the neutral points where like poles cancel are found and marked, and the status says whether two magnets attract or repel.',
    sections: [
      {
        title: 'Like poles, facing',
        description: 'Drag a magnet, or turn it by the round grip beyond its north end. Shake the card to scatter the filings and watch them comb back into line.',
        Content: IronFilingsHeroExample,
        bare: true,
        note: motionNote('the filings are drawn already lying along the field, and re-drawn aligned the instant a magnet moves or the card is shaken. There is no turning or drift.'),
      },
      {
        title: 'Every parameter',
        description: 'Controlled magnets, with the arrangement, count, strength, layers and tone set from outside. Each magnet is a button: arrow keys move it, [ and ] turn it.',
        Content: IronFilingsPlaygroundExample,
      },
      {
        title: 'As a figure',
        description: 'Not interactive and without controls: a still diagram that is still the real field.',
        Content: IronFilingsFiguresExample,
      },
      rationale(
        'Magnetism is taught with a photograph of filings or a hand-drawn set of loops, and neither can be moved to see what the field does next.',
        'The field of a pole pair is two lines of maths, filings are a torque and a damper, and together they make the picture a classroom makes — neutral points and all — that answers a drag.',
        'Physics and engineering teaching, science pages, explorable explanations, and hero moments that should reward a poke.',
        ['Canvas 2D', 'Theme tokens', 'ToggleGroup', 'Switch', 'Button'],
      ),
    ],
    props: [
      { name: 'magnets', type: 'IronFilingsMagnet[]', description: 'Controlled magnets: { id, x, y, angle, strength?, poles?, length?, label? }. Positions are fractions of the frame; angle is degrees clockwise from pointing right.' },
      { name: 'defaultMagnets', type: 'IronFilingsMagnet[]', defaultValue: 'two bars, north facing north', description: 'Magnets for uncontrolled use.' },
      { name: 'onMagnetsChange', type: '(magnets: IronFilingsMagnet[]) => void', description: 'Called when a magnet is dragged, turned or moved with the keyboard.' },
      { name: 'filings', type: 'number', defaultValue: '3200', description: 'Number of filings, up to 12,000.' },
      { name: 'showFilings', type: 'boolean', defaultValue: 'true', description: 'Draw the filings.' },
      { name: 'showFieldLines', type: 'boolean', defaultValue: 'false', description: 'Draw field lines traced by RK4 from the poles.' },
      { name: 'showStrength', type: 'boolean', defaultValue: 'false', description: 'Shade the frame by |B|.' },
      { name: 'interactive', type: 'boolean', defaultValue: 'true', description: 'Magnets can be dragged, turned and moved with the keyboard.' },
      { name: 'tone', type: "'ink' | 'accent'", defaultValue: "'ink'", description: 'Filing colour.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze the filings; lines and shading still follow the magnets.' },
      { name: 'aspectRatio', type: 'number', defaultValue: '1.6', description: 'Width over height of the frame.' },
      { name: 'label', type: 'string', description: 'Accessible name. Without it the canvas is decorative and hidden.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Show the layer toggles, a pause switch and the shake button.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
      { name: 'ref', type: 'IronFilingsHandle', description: '{ shake() } — scatter the filings so they re-align, from code or a button.' },
    ],
  },
}
