import { useRef, useState } from 'react'
import {
  Button,
  Ferrofluid,
  SegmentedControl,
  Slider,
  Switch,
  Text,
  type FerrofluidHandle,
  type FerrofluidMagnet,
  type FerrofluidTone,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- hero */

function FerrofluidHeroExample() {
  const drop = useRef<FerrofluidHandle>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <Ferrofluid ref={drop} label="A drop of ferrofluid between the two poles of a magnet" />
      <Text size="caption" tone="faint">
        At rest: the two ends of one horseshoe either side of the drop, whose fields add through it into something close to a
        uniform field, so both rims comb out into spikes. The north pole follows the pointer — take it away and the spikes on
        that side sink; bring it close and the drop tears free of what pins it and runs. Drag the drop itself to throw it.
        Change the accent: the rim light facing the field follows it.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- playground */

function FerrofluidPlaygroundExample() {
  const drop = useRef<FerrofluidHandle>(null)
  const [count, setCount] = useState('2')
  const [tone, setTone] = useState<FerrofluidTone>('ink')
  const [strength, setStrength] = useState(100)
  const [viscosity, setViscosity] = useState(35)
  const [spikes, setSpikes] = useState(19)
  const [paused, setPaused] = useState(false)
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl
          label="Magnets"
          size="sm"
          value={count}
          onValueChange={setCount}
          options={[
            { value: '1', label: 'One' },
            { value: '2', label: 'Two' },
            { value: '3', label: 'Three' },
          ]}
        />
        <SegmentedControl
          label="Fluid"
          size="sm"
          value={tone}
          onValueChange={setTone}
          options={[
            { value: 'ink', label: 'Ink' },
            { value: 'accent', label: 'Accent' },
          ]}
        />
      </div>
      <Ferrofluid
        ref={drop}
        magnets={Number(count)}
        tone={tone}
        strength={strength / 100}
        viscosity={viscosity / 100}
        spikes={spikes}
        paused={paused}
        controls={false}
        label="Ferrofluid playground"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Field strength · {(strength / 100).toFixed(2)}×
          </Text>
          <Slider min={30} max={250} value={strength} onChange={(event) => setStrength(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Viscosity · {(viscosity / 100).toFixed(2)}
          </Text>
          <Slider min={0} max={100} value={viscosity} onChange={(event) => setViscosity(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Lattice sites · {spikes}
          </Text>
          <Slider min={7} max={37} value={spikes} onChange={(event) => setSpikes(Number(event.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => drop.current?.pulse()} disabled={paused}>
          Pulse the field
        </Button>
        <Button size="sm" variant="outline" onClick={() => drop.current?.pulse(2)} disabled={paused}>
          Pulse it hard
        </Button>
        <Button size="sm" variant="ghost" onClick={() => drop.current?.reset()}>
          Reset the drop
        </Button>
        <label className="ml-auto flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
          Paused
        </label>
      </div>
      <Text size="caption" tone="faint">
        Low viscosity rings: the spikes overshoot and wobble for a second before they settle. Lower the field until the spikes
        just stand, then pull the magnet away slowly — they hold on below the field that raised them, then drop together.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- two poles */

const POLES: FerrofluidMagnet[] = [
  { id: 'west', label: 'West pole', x: 0.16, y: 0.5 },
  { id: 'east', label: 'East pole', x: 0.84, y: 0.5 },
]

function FerrofluidPolesExample() {
  const [magnets, setMagnets] = useState<FerrofluidMagnet[]>(POLES)
  const [opposite, setOpposite] = useState(true)
  const shown = magnets.map((magnet, index) => ({ ...magnet, polarity: index === 0 && opposite ? (-1 as const) : (1 as const) }))
  return (
    <div className="flex w-full flex-col gap-4">
      <Ferrofluid magnets={shown} onMagnetsChange={setMagnets} strength={1.3} controls={false} label="Ferrofluid between two poles" />
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={opposite} onChange={(event) => setOpposite(event.target.checked)} />
          Opposite poles
        </label>
        <Button size="sm" variant="ghost" onClick={() => setMagnets(POLES)}>
          Put the poles back
        </Button>
        <Text as="span" size="caption" tone="faint" className="font-mono tabular-nums">
          {shown.map((m) => `${m.polarity === -1 ? 'S' : 'N'} ${Math.round(m.x * 100)},${Math.round(m.y * 100)}`).join(' · ')}
        </Text>
      </div>
      <Text size="caption" tone="faint">
        Controlled: the positions live in this example’s state. Across opposite poles the field runs straight through the drop
        and both sides comb out. Make them alike and their sideways pulls cancel down the middle, so the peaks there stop
        lying over and stand straight up, seen end-on.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  ferrofluid: {
    description:
      'A drop of magnetic fluid that grows Rosensweig spikes towards a magnet. Each magnet is a pole held just above the table, and their fields add as vectors. At every site of a hexagonal lattice in the drop, the square of the field over the critical field (the magnetic Bond number) sets a peak height: flat below one, then a peak growing with the square root of the excess. The instability is subcritical, so peaks jump up at onset and hold on below it. Each peak chases its height on a damped spring and leans over by the in-plane share of the field. Volume is conserved, so the pool shrinks as the spikes rise. The drop is pulled up the field gradient by the Kelvin force, but its contact line pins it until that pull beats the pinning, which is why it sits still under a magnet at arm’s length and runs at a near one. The surface is an implicit field of soft balls and tapered cones, outlined by marching squares with linear interpolation, and lit as liquid metal from the ink and accent tokens.',
    sections: [
      {
        title: 'A drop and a magnet',
        description:
          'Spiked before anyone touches it, because the two poles hold the drop in a field strong enough to beat surface tension. The north pole follows the pointer; the spikes ring and settle wherever it goes.',
        Content: FerrofluidHeroExample,
        bare: true,
        note: motionNote(
          'the settled shape for where the magnets are is drawn as a still. Moving a magnet redraws it, the pulse shows the peak of the surge, and the drop does not creep or fly.',
        ),
      },
      {
        title: 'Every parameter',
        description:
          'Field strength moves the critical distance, viscosity is the springs’ damping, and the lattice sites fix the critical wavelength: more sites, a finer comb. The first magnet follows the pointer; drag the others.',
        Content: FerrofluidPlaygroundExample,
      },
      {
        title: 'Two poles, controlled',
        description: 'Magnet positions as controlled state, with a polarity per magnet. Drag either pole, or focus one and use the arrow keys.',
        Content: FerrofluidPolesExample,
      },
      rationale(
        'A hero that reacts to the pointer is usually a particle field or a gradient following the cursor: pleasant, and the same everywhere.',
        'A magnetic fluid gives the pointer a physical job. It is a field that obeys a threshold, has memory and conserves volume, and people recognise it at once from the real thing.',
        'Landing heroes, hardware and materials brands, empty states worth lingering on, and physics or engineering teaching pages.',
        ['Implicit surfaces', 'Marching squares', 'Theme tokens', 'Button'],
      ),
    ],
    props: [
      { name: 'magnets', type: 'number | FerrofluidMagnet[]', defaultValue: '2', description: 'How many magnets to start with (uncontrolled), or the magnets themselves: { id, x, y, strength?, polarity?, label? }. Two is a horseshoe’s north and south ends either side of the drop, which combs both rims.' },
      { name: 'onMagnetsChange', type: '(magnets: FerrofluidMagnet[]) => void', description: 'Called when a magnet is dragged, follows the pointer or is moved with the arrow keys.' },
      { name: 'strength', type: 'number', defaultValue: '1.3', description: 'Field strength multiplier. At 1 the field reaches critical half the stage’s shorter side from a pole.' },
      { name: 'viscosity', type: 'number', defaultValue: '0.35', description: '0–1. Low rings and wobbles; high settles with no overshoot. Also drags on a thrown drop.' },
      { name: 'spikes', type: 'number', defaultValue: '19', description: 'Lattice sites, 1–60. Sets the spacing, and with it how long the peaks are: fewer sites, a coarser and taller comb. 7, 19 and 37 fill whole hexagonal rings.' },
      { name: 'tone', type: "'ink' | 'accent'", defaultValue: "'ink'", description: 'Fluid colour, kept dark in both themes. The side facing the field always takes an accent rim.' },
      { name: 'interactive', type: 'boolean', defaultValue: 'true', description: 'Pointer and keyboard control. Off, it is a picture driven by props and the ref.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Freeze on the current frame.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Pulse and reset buttons and a readout under the stage.' },
      { name: 'label', type: 'string', defaultValue: "'Ferrofluid'", description: 'Accessible name. An empty string makes it decorative.' },
      { name: 'className', type: 'string', description: 'Merged last. The stage is 16:10 unless given another aspect ratio.' },
      { name: 'ref', type: 'FerrofluidHandle', description: '{ pulse(amount?), reset() }. Surge the field or put the drop back, from code or from a button.' },
    ],
  },
}
