import { useRef, useState } from 'react'
import { Button, FallingSand, SegmentedControl, Slider, Switch, Text, type FallingSandHandle, type FallingSandMaterial } from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- hero */

function SandHeroExample() {
  const sand = useRef<FallingSandHandle>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <FallingSand
        ref={sand}
        seedText={'Built grain\nby grain'}
        controls={false}
        label="Sand box with a headline made of packed sand. Drag to pour sand onto it."
        className="h-[420px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => sand.current?.pour(4)}>
          Pour sand on it
        </Button>
        <Button size="sm" variant="outline" onClick={() => sand.current?.pour(4, 'water')}>
          Pour water
        </Button>
        <Button size="sm" variant="outline" onClick={() => sand.current?.drop(0.5, 0.12, 'sand')}>
          Drop a handful
        </Button>
        <Button size="sm" variant="ghost" onClick={() => sand.current?.reset()}>
          Rebuild the words
        </Button>
      </div>
      <Text size="caption" tone="faint">
        The letters are packed sand: they stay put until something moving touches them, then shed grains from that point. Switch the
        accent — sand, water and steam all take their colour from it.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- playground */

const POUR_OPTIONS: { value: 'off' | FallingSandMaterial; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'sand', label: 'Sand' },
  { value: 'water', label: 'Water' },
  { value: 'oil', label: 'Oil' },
]

function SandPlaygroundExample() {
  const sand = useRef<FallingSandHandle>(null)
  // Pouring by default, because a playground that opens as an empty black box
  // looks broken rather than blank: the falling stream says what to do with it.
  const [pour, setPour] = useState<'off' | FallingSandMaterial>('sand')
  const [speed, setSpeed] = useState(2)
  const [cellSize, setCellSize] = useState(4)
  const [paused, setPaused] = useState(false)
  return (
    <div className="flex w-full flex-col gap-4">
      <FallingSand
        ref={sand}
        pour={pour === 'off' ? false : pour}
        speed={speed}
        cellSize={cellSize}
        paused={paused}
        onPausedChange={setPaused}
        defaultBrush="wood"
        label="Falling sand playground"
        className="h-[460px]"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Steps per frame · {speed}
          </Text>
          <Slider min={1} max={6} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Cell size · {cellSize}px
          </Text>
          <Slider min={2} max={10} value={cellSize} onChange={(event) => setCellSize(Number(event.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl label="Pour from the top" size="sm" value={pour} onValueChange={setPour} options={POUR_OPTIONS} />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
          Paused
        </label>
      </div>
      <Text size="caption" tone="faint">
        Try a wooden shelf, oil poured over it, then fire. Or a stone basin filled with water, and fire dropped in: it boils into steam,
        and the steam rains back down. Changing the cell size rebuilds the grid.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- smaller */

function SandNotFoundExample() {
  const sand = useRef<FallingSandHandle>(null)
  return (
    <div className="flex w-full flex-col gap-3 sm:max-w-[520px]">
      <FallingSand
        ref={sand}
        seedText="404"
        cellSize={5}
        controls={false}
        label="Not found. The number 404 in packed sand."
        className="h-[240px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Text size="label" weight="bold" className="mr-auto">
          This page has been swept away
        </Text>
        <Button size="sm" variant="outline" onClick={() => sand.current?.drop(0.5, 0.08, 'water')}>
          Knock it down
        </Button>
        <Button size="sm" variant="ghost" onClick={() => sand.current?.reset()}>
          Put it back
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'falling-sand': {
    description:
      'A falling-sand cellular automaton on a typed-array grid, drawn one pixel per cell and scaled up without smoothing. Each material has its own rule: sand falls and piles by trying its lower diagonals, water and oil run sideways by a dispersion rate until they find their level, oil floats because water sinks through it, fire lights its neighbours by their flammability and burns out into smoke, and steam rises and condenses into water. A headline can be the sand: it is drawn in the theme font straight into the grid as packed sand, a static material that crumbles only where something moving touches it, so the words hold until they are disturbed. The scan direction alternates every row and every step, which stops piles drifting to one side, and each step scans only the rectangle that changed, so a settled pile costs nothing.',
    sections: [
      {
        title: 'A headline made of sand',
        description: 'Drag across the words, or pour onto them. They come apart only where they are touched.',
        Content: SandHeroExample,
        bare: true,
        note: motionNote(
          'the automaton is run to rest off screen and one settled frame is shown. Painting, dropping and pouring still work; each shows where everything comes to rest, not the fall.',
        ),
      },
      {
        title: 'Every material',
        description: 'The picker is a radio group and the brush a slider; arrow keys move a marker in the box and Enter drops material at it.',
        Content: SandPlaygroundExample,
      },
      {
        title: 'A smaller use',
        description: 'A not-found page whose number can be knocked down and put back.',
        Content: SandNotFoundExample,
        bare: true,
      },
      rationale(
        'A headline that reacts usually means a canned animation that plays the same way every time and ignores the reader.',
        'A falling-sand automaton is a handful of local rules that produce piles, pools and fires nobody scripted, and it is cheap because nothing that has settled is simulated.',
        'Launch pages, playful empty and error states, and teaching pages about emergence and cellular automata.',
        ['SegmentedControl', 'Slider', 'Button', 'Theme tokens'],
      ),
    ],
    props: [
      { name: 'seedText', type: 'string', description: 'A headline drawn into the grid in the theme font; `\\n` for a second line.' },
      { name: 'seedMaterial', type: "'packed' | 'sand'", defaultValue: "'packed'", description: 'Packed sand holds its shape until touched; sand falls at once.' },
      {
        name: 'materials',
        type: 'FallingSandMaterial[]',
        defaultValue: "['sand', 'water', 'oil', 'wood', 'stone', 'fire', 'steam', 'empty']",
        description: "Materials offered in the picker, in order. 'empty' is the eraser; 'packed' and 'smoke' are also available.",
      },
      { name: 'palette', type: 'Partial<Record<FallingSandMaterial, string>>', description: 'Colour overrides as any CSS colour. `empty` is the background.' },
      { name: 'brush', type: 'FallingSandMaterial', description: 'Controlled brush material.' },
      { name: 'defaultBrush', type: 'FallingSandMaterial', defaultValue: 'first of materials', description: 'Uncontrolled starting brush.' },
      { name: 'onBrushChange', type: '(material: FallingSandMaterial) => void', description: 'Called when the picker changes the brush.' },
      { name: 'brushSize', type: 'number', description: 'Controlled brush radius, in cells.' },
      { name: 'defaultBrushSize', type: 'number', defaultValue: '4', description: 'Uncontrolled starting brush radius, in cells.' },
      { name: 'onBrushSizeChange', type: '(size: number) => void', description: 'Called when the slider changes the brush radius.' },
      { name: 'pour', type: 'boolean | FallingSandMaterial', defaultValue: 'false', description: 'A source that drips from the top without stopping.' },
      { name: 'speed', type: 'number', defaultValue: '2', description: 'Automaton steps per frame, 1–6.' },
      { name: 'cellSize', type: 'number', defaultValue: '4', description: 'CSS pixels per cell. The grid is capped at 150,000 cells.' },
      { name: 'paused', type: 'boolean', description: 'Controlled pause. Painting still shows; nothing moves.' },
      { name: 'defaultPaused', type: 'boolean', defaultValue: 'false', description: 'Uncontrolled starting pause state.' },
      { name: 'onPausedChange', type: '(paused: boolean) => void', description: 'Called when the pause button toggles.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Show the material picker, brush slider and buttons.' },
      { name: 'label', type: 'string', defaultValue: "'Falling sand'", description: 'Accessible name for the sand box.' },
      { name: 'ref', type: 'FallingSandHandle', description: '{ reset(), pour(seconds?, material?), drop(x?, y?, material?) } — drive it from code or a button.' },
      { name: 'className', type: 'string', description: 'Merged last. A height here is shared between the box and the controls.' },
    ],
  },
}
