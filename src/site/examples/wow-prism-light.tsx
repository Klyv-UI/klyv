import { useRef, useState } from 'react'
import {
  Button,
  PrismLight,
  SegmentedControl,
  Slider,
  Switch,
  Text,
  type PrismLightBeam,
  type PrismLightElement,
  type PrismLightHandle,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

type GlassChoice = 'crown' | 'flint'

const GLASS_OPTIONS: { value: GlassChoice; label: string }[] = [
  { value: 'crown', label: 'Crown' },
  { value: 'flint', label: 'Dense flint' },
]

/* ---------------------------------------------------------------- hero */

function PrismHeroExample() {
  const [glass, setGlass] = useState<GlassChoice>('flint')
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl label="Glass" size="sm" value={glass} onValueChange={setGlass} options={GLASS_OPTIONS} />
      <PrismLight glass={glass} label="A prism splitting a beam of white light" />
      <Text size="caption" tone="faint">
        Switch to crown and the spectrum all but closes up: same prism, same beam, 1.4° of fan instead of 11°, which at this distance is a white line with
        coloured edges. That is the honest difference between the two glasses, and the reason a dispersing prism is made of flint. The beam starts at
        minimum deviation — the symmetric path, where the ray inside the glass runs parallel to the base — and swings a few degrees either side of it
        until you touch something.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------ critical angle */

const TIR_PRISM: PrismLightElement[] = [{ id: 'prism', kind: 'prism', x: 0.42, y: 0.5 }]
const TIR_BEAM: PrismLightBeam = { x: 0.06, y: 0.52, angle: 12, width: 5, light: 532 }

function CriticalAngleExample() {
  const [glass, setGlass] = useState<GlassChoice>('flint')
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl label="Glass" size="sm" value={glass} onValueChange={setGlass} options={GLASS_OPTIONS} />
      <PrismLight glass={glass} defaultElements={TIR_PRISM} defaultBeam={TIR_BEAM} sweep={false} label="A green laser through a prism, near the critical angle" />
      <Text size="caption" tone="faint">
        One wavelength, 532 nm, so one ray. Flint’s critical angle is 34°: the beam meets the second face more steeply than that, reflects off the inside
        and leaves through the base. Crown’s is 41°, so the same beam at the same angle gets out. In crown, take the beam angle below about −1° to reach
        the same point.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------- playground */

type Scene = 'prism' | 'lens' | 'slab' | 'newton' | 'mirror'

const SCENES: Record<Scene, { elements: PrismLightElement[]; beam: PrismLightBeam; note: string }> = {
  prism: {
    elements: [{ id: 'prism', kind: 'prism', x: 0.3, y: 0.46, size: 0.46 }],
    beam: { x: 0.05, y: 0.66, angle: 31, width: 6, light: 'white' },
    note: 'Find minimum deviation turns the beam until the D line bends least; the readout’s minimum is the closed form, 2·asin(n·sin 30°) − 60°, and the two agree.',
  },
  lens: {
    elements: [{ id: 'lens', kind: 'lens', x: 0.42, y: 0.5 }],
    beam: { x: 0.05, y: 0.5, angle: 0, width: 70, light: 'white' },
    note: 'A wide beam is fifteen parallel rays. The edge rays cross the axis short of the centre ones — spherical aberration — and blue focuses nearer than red: chromatic aberration, wider in flint.',
  },
  slab: {
    elements: [{ id: 'slab', kind: 'slab', x: 0.45, y: 0.5, rotation: 35 }],
    beam: { x: 0.05, y: 0.5, angle: 0, width: 8, light: 'white' },
    note: 'Parallel faces undo each other: the beam comes out parallel to how it went in, shifted sideways, and still white. Turn the slab to change the shift.',
  },
  newton: {
    elements: [
      { id: 'first', kind: 'prism', x: 0.25, y: 0.34, size: 0.4, label: 'First prism' },
      { id: 'second', kind: 'prism', x: 0.561, y: 0.549, size: 0.4, rotation: 180, label: 'Second prism' },
    ],
    beam: { x: 0.03, y: 0.5, angle: 21, width: 8, light: 'white' },
    note: 'Newton’s recombination: the second prism is the first turned half round, so its faces are parallel to the first’s and every colour leaves parallel to the white beam that went in. Only the fringes stay coloured.',
  },
  mirror: {
    elements: [
      { id: 'prism', kind: 'prism', x: 0.37, y: 0.46 },
      { id: 'mirror', kind: 'mirror', x: 0.78, y: 0.552, rotation: 60 },
    ],
    beam: { x: 0.05, y: 0.66, angle: 27, width: 6, light: 'white' },
    note: 'A mirror folds the spectrum back over the bench. It reflects every wavelength at the same angle, so the fan keeps its order and its width.',
  },
}

const SCENE_OPTIONS: { value: Scene; label: string }[] = [
  { value: 'prism', label: 'Prism' },
  { value: 'lens', label: 'Lens' },
  { value: 'slab', label: 'Slab' },
  { value: 'newton', label: 'Two prisms' },
  { value: 'mirror', label: 'Mirror' },
]

type LightChoice = 'white' | '450' | '532' | '650'

function BenchPlayground() {
  const [scene, setScene] = useState<Scene>('lens')
  const [elements, setElements] = useState(SCENES.lens.elements)
  const [beam, setBeam] = useState(SCENES.lens.beam)
  const [glass, setGlass] = useState<GlassChoice | 'fixed'>('crown')
  const [rays, setRays] = useState(32)
  const [fresnel, setFresnel] = useState(true)
  const choose = (next: Scene) => {
    setScene(next)
    setElements(SCENES[next].elements)
    setBeam(SCENES[next].beam)
  }
  const light: LightChoice = beam.light === undefined || beam.light === 'white' ? 'white' : (String(beam.light) as LightChoice)
  const width = beam.width ?? 6
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl label="Scene" size="sm" value={scene} onValueChange={choose} options={SCENE_OPTIONS} />
      <PrismLight
        elements={elements}
        onElementsChange={setElements}
        defaultElements={SCENES[scene].elements}
        beam={beam}
        onBeamChange={setBeam}
        defaultBeam={SCENES[scene].beam}
        glass={glass === 'fixed' ? 1.5 : glass}
        rays={rays}
        fresnel={fresnel}
        sweep={false}
        label="Optical bench playground"
      />
      <Text size="caption" tone="faint">
        {SCENES[scene].note}
      </Text>
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl
          label="Glass"
          size="sm"
          value={glass}
          onValueChange={setGlass}
          options={[...GLASS_OPTIONS, { value: 'fixed', label: 'n = 1.5, no dispersion' }]}
        />
        <SegmentedControl
          label="Light"
          size="sm"
          value={light}
          onValueChange={(value) => setBeam({ ...beam, light: value === 'white' ? 'white' : Number(value) })}
          options={[
            { value: 'white', label: 'White' },
            { value: '450', label: '450 nm' },
            { value: '532', label: '532 nm' },
            { value: '650', label: '650 nm' },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Beam width · {width}px
          </Text>
          <Slider min={2} max={80} value={width} onChange={(event) => setBeam({ ...beam, width: Number(event.target.value) })} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Wavelengths sampled · {rays}
          </Text>
          <Slider min={4} max={64} value={rays} onChange={(event) => setRays(Number(event.target.value))} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
        <Switch switchSize="sm" checked={fresnel} onChange={(event) => setFresnel(event.target.checked)} />
        Fresnel reflections
      </label>
    </div>
  )
}

/* -------------------------------------------------------------- banner */

// Composed for the 3:1 strip the same way the default scene is: the prism far
// enough left, and the beam steep enough, that the fan gets the width of the
// banner to open out in — about 100px of spectrum across the whole sweep.
const BANNER_PRISM: PrismLightElement[] = [{ id: 'prism', kind: 'prism', x: 0.36, y: 0.42, size: 0.8 }]
const BANNER_BEAM: PrismLightBeam = { x: 0.05, y: 0.72, angle: 30, width: 6 }

function PrismBannerExample() {
  const bench = useRef<PrismLightHandle>(null)
  const [held, setHeld] = useState<number | null>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <PrismLight
        ref={bench}
        defaultElements={BANNER_PRISM}
        defaultBeam={BANNER_BEAM}
        aspectRatio={3}
        interactive={false}
        controls={false}
        label=""
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setHeld(bench.current?.findMinimumDeviation() ?? null)}>
          Hold at minimum deviation
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            bench.current?.reset()
            setHeld(null)
          }}
        >
          Start the sweep again
        </Button>
        <Text as="span" size="caption" tone="faint" aria-live="polite">
          {held === null ? 'Sweeping on its own.' : `Held at ${held.toFixed(1)}°.`}
        </Text>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'prism-light': {
    description:
      'A 2D optical bench traced one wavelength at a time. White light is thirty-odd rays leaving the source together; each takes its refractive index from Cauchy’s equation for crown or dense flint glass, bends at every face by the vector form of Snell’s law, and splits its energy by the Fresnel equations, so the faint reflection off the first face is there too. Past the critical angle the square root in Snell’s law has no real answer and the tracer reflects instead — total internal reflection is not a special case. Each wavelength is drawn in its CIE 1931 colour, converted to sRGB and added onto a dark bench, so where the rays still coincide they make white and where the glass has pulled them apart they make a spectrum with the real proportions. Prisms, lenses, slabs and mirrors can be dragged and turned, or moved from the keyboard.',
    sections: [
      {
        title: 'White light, split',
        description: 'Drag across the bench to aim the beam, drag the prism’s centre to move it, drag its body to turn it.',
        Content: PrismHeroExample,
        bare: true,
        note: motionNote('there is no idle sweep; the bench is drawn once, as set, and redrawn only when the slider, a drag or a key moves something.'),
      },
      {
        title: 'Past the critical angle',
        description: 'The same prism and the same laser in two glasses. Switch between them and watch where the beam leaves.',
        Content: CriticalAngleExample,
      },
      {
        title: 'Build a bench',
        description: 'Fully controlled: the scene, the elements and the beam live in the page’s state. Each scene demonstrates one piece of optics.',
        Content: BenchPlayground,
      },
      {
        title: 'As a banner',
        description: 'Not interactive, no controls, decorative to assistive technology — driven only through its ref.',
        Content: PrismBannerExample,
        note: motionNote('the banner holds still at its set angle, and the buttons still turn it.'),
      },
      rationale(
        'Spectra on the web are gradients: a rainbow painted on, the same shape whatever the glass or the angle, and nothing to learn from turning it.',
        'Tracing each wavelength separately costs a few hundred line segments a frame, and in return dispersion, minimum deviation, total internal reflection and chromatic aberration all appear without being drawn.',
        'Science and education pages, optics and photography brands, product heroes about light or colour, and explorable explanations.',
        ['Canvas 2D, additive', 'Slider', 'Button', 'Theme tokens'],
      ),
    ],
    props: [
      { name: 'elements', type: 'PrismLightElement[]', description: 'Controlled elements: { id, kind, x, y, rotation?, size?, label? }. kind is prism, lens, slab or mirror.' },
      { name: 'defaultElements', type: 'PrismLightElement[]', defaultValue: 'one prism', description: 'Elements for uncontrolled use; also where reset() returns to.' },
      { name: 'onElementsChange', type: '(elements) => void', description: 'Called when an element is dragged, turned or nudged from the keyboard.' },
      { name: 'beam', type: 'PrismLightBeam', description: 'Controlled beam: { x, y, angle, width?, light? }. light is white or a wavelength in nanometres.' },
      { name: 'defaultBeam', type: 'PrismLightBeam', defaultValue: '{ x: 0.05, y: 0.66, angle: 31, width: 6 }', description: 'Beam for uncontrolled use; also where reset() returns to.' },
      { name: 'onBeamChange', type: '(beam) => void', description: 'Called when the slider, a drag or the source’s handle changes the beam.' },
      { name: 'glass', type: "'crown' | 'flint' | number", defaultValue: "'flint'", description: 'Cauchy constants for dense flint (n_d 1.767, and about twice the spread) or crown (n_d 1.517), or a fixed index with no dispersion.' },
      { name: 'rays', type: 'number', defaultValue: '32', description: 'Wavelengths sampled across 380–700 nm for white light, 3–64.' },
      { name: 'fresnel', type: 'boolean', defaultValue: 'true', description: 'Split each ray at every face by the Fresnel equations, showing the faint partial reflections.' },
      { name: 'interactive', type: 'boolean', defaultValue: 'true', description: 'Pointer and keyboard can move and turn elements and aim the beam.' },
      { name: 'sweep', type: 'boolean', defaultValue: 'true', description: 'Swing the beam ±5°, so the fan moves, until the first touch. Off under reduced motion.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Hold the sweep, or a glide to a new angle, where it is.' },
      { name: 'aspectRatio', type: 'number', defaultValue: '16 / 9', description: 'Width over height of the bench. Positions are fractions, so a scene keeps its shape at any size.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Show the beam-angle slider, Find minimum deviation and Reset.' },
      { name: 'label', type: 'string', defaultValue: "'Optical bench'", description: 'Accessible name; the live deviation is appended. An empty string makes the drawing decorative.' },
      { name: 'ref', type: 'PrismLightHandle', description: '{ reset(), findMinimumDeviation() } — the second returns the angle it found, or null.' },
    ],
  },
}
