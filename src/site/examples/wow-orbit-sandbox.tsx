import { useRef, useState } from 'react'
import {
  Button,
  OrbitSandbox,
  SegmentedControl,
  Slider,
  Switch,
  Text,
  type OrbitCollisionMode,
  type OrbitSandboxHandle,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

function OrbitHeroExample() {
  return (
    <div className="flex w-full flex-col gap-3">
      <OrbitSandbox preset="solar" label="A star with four planets and a moon" />
      <Text size="caption" tone="faint">
        Drag out from empty space and let go. Try a short drag near a planet for a moon of your own, or a long one to watch something escape.
      </Text>
    </div>
  )
}

const COLLISIONS: { value: OrbitCollisionMode; label: string }[] = [
  { value: 'merge', label: 'Merge' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'off', label: 'Pass through' },
]

function OrbitPhysicsExample() {
  const sandbox = useRef<OrbitSandboxHandle>(null)
  const [collisions, setCollisions] = useState<OrbitCollisionMode>('merge')
  const [gravity, setGravity] = useState(100)
  const [softening, setSoftening] = useState(25)
  const [vectors, setVectors] = useState(true)
  const [paused, setPaused] = useState(false)
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl label="Collisions" size="sm" value={collisions} onValueChange={setCollisions} options={COLLISIONS} />
      <OrbitSandbox
        ref={sandbox}
        preset="binary"
        gravity={gravity / 100}
        softening={softening / 100}
        collisions={collisions}
        showVectors={vectors}
        showBarycentre
        paused={paused}
        onPausedChange={setPaused}
        controls={false}
        label="Binary star sandbox"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            G · {(gravity / 100).toFixed(2)}
          </Text>
          <Slider min={25} max={200} value={gravity} onChange={(event) => setGravity(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Softening ε · {(softening / 100).toFixed(2)}
          </Text>
          <Slider min={0} max={300} value={softening} onChange={(event) => setSoftening(Number(event.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={vectors} onChange={(event) => setVectors(event.target.checked)} />
          Velocities
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
          Paused
        </label>
        <Button size="sm" variant="outline" onClick={() => sandbox.current?.add({ x: -44, y: -9, vx: 7, vy: 0, mass: 60, tone: 'danger', label: 'Rogue star' })}>
          Send a rogue star through
        </Button>
        <Button size="sm" variant="ghost" onClick={() => sandbox.current?.reset()}>
          Reset
        </Button>
        <Button size="sm" variant="ghost" onClick={() => sandbox.current?.clear()}>
          Clear
        </Button>
      </div>
      <Text size="caption" tone="faint">
        The cross is the centre of mass. Merges and bounces conserve momentum, so it only moves when something new arrives carrying its own. Changing G
        mid-orbit is a real change to the universe: watch the planet’s orbit swell or shrink.
      </Text>
    </div>
  )
}

function OrbitEightExample() {
  const sandbox = useRef<OrbitSandboxHandle>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <OrbitSandbox ref={sandbox} preset="figure-eight" controls={false} trails={18} label="Three equal masses on a figure-eight orbit" />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => sandbox.current?.reset()}>
          Start again
        </Button>
        <Text size="caption" tone="faint">
          Three equal masses, one curve. Nudge it with a launch and the choreography comes apart.
        </Text>
      </div>
    </div>
  )
}

export const demos: ExampleModule = {
  'orbit-sandbox': {
    description:
      'An n-body gravity sandbox. Drag anywhere to place a body: the drag is its velocity, and while you aim, the dashed path is the whole system copied and run forward through the same integrator, so what is drawn is what will happen, collisions included. Gravity is Newtonian with Plummer softening, integrated with velocity Verlet at a fixed step. Verlet is symplectic, so orbits stay closed rather than spiralling, and the readout shows total energy drifting by around a hundred-thousandth of a per cent. Bodies merge (conserving mass and momentum, radius from mass^⅓) or bounce elastically. Trails are kept in world space, so they stay on their orbits as you pan, zoom or follow a body. Presets include Chenciner and Montgomery’s figure-eight three-body orbit from Simó’s published initial conditions, which comes apart within one lap if the integrator is wrong.',
    sections: [
      {
        title: 'Fling a planet',
        description: 'Drag from empty space to launch. Shift-drag or “Drag pans” moves the view, scroll or pinch zooms, and clicking a body selects it for Follow.',
        Content: OrbitHeroExample,
        bare: true,
        note: motionNote(
          'nothing runs by itself. The scene is traced ahead and drawn as complete orbits, and Step and a time scrubber move the bodies along them. Launching still shows the predicted path, and a new trace starts from the launch.',
        ),
      },
      {
        title: 'The physics, from code',
        description: 'G, softening and the collision rule are props; the handle adds bodies, resets and clears.',
        Content: OrbitPhysicsExample,
      },
      {
        title: 'Three bodies, one curve',
        description:
          'The figure-eight choreography: three equal masses chasing each other round one curve, a solution to the three-body problem found in 1993 and proved in 2000. It stays an eight lap after lap here, which is only possible if the integrator is right.',
        Content: OrbitEightExample,
      },
      rationale(
        'Orbital demos usually animate ellipses along fixed paths, which cannot respond to anything, or step naive Euler physics, where every orbit spirals outwards within a minute.',
        'Velocity Verlet costs the same as Euler and keeps energy bounded, so a sandbox stays a sandbox. Running the aim forward through the same code makes the preview honest, and presets with known answers let anyone check the physics.',
        'Physics teaching, science and space landing pages, onboarding toys, and any page where a reader should play with a system rather than watch a video of it.',
        ['nbody.ts (velocity Verlet)', 'Button', 'IconButton', 'SegmentedControl', 'Slider', 'Switch', 'Theme tokens'],
      ),
    ],
    props: [
      { name: 'bodies', type: 'OrbitBodyInput[]', description: 'Starting bodies { x, y, vx?, vy?, mass?, radius?, tone?, label? } in world units. Overrides preset.' },
      { name: 'preset', type: "'solar' | 'binary' | 'figure-eight' | 'slingshot'", defaultValue: "'solar'", description: 'The arrangement to start from. The scene picker changes it after.' },
      { name: 'gravity', type: 'number', defaultValue: '1', description: 'The gravitational constant G. Presets are built for it.' },
      { name: 'softening', type: 'number', defaultValue: '0.25', description: 'Plummer softening length ε in world units.' },
      { name: 'collisions', type: "'merge' | 'bounce' | 'off'", defaultValue: "'merge'", description: 'Touching bodies merge, bounce elastically, or pass through.' },
      { name: 'trails', type: 'boolean | number', defaultValue: 'true', description: 'Fading world-space trails: true for 20 units of simulated time, or a length.' },
      { name: 'timeScale', type: 'number', defaultValue: '1', description: 'Simulated time per real second, relative to the default. Seeds the speed slider.' },
      { name: 'paused', type: 'boolean', description: 'Controlled pause. Omit to let the play button own it.' },
      { name: 'onPausedChange', type: '(paused: boolean) => void', description: 'Called when the play button or the space key toggles.' },
      { name: 'showVectors', type: 'boolean', defaultValue: 'false', description: 'Draw each body’s velocity as an arrow.' },
      { name: 'showBarycentre', type: 'boolean', defaultValue: 'false', description: 'Mark the centre of mass.' },
      { name: 'launchMass', type: 'number', defaultValue: '1', description: 'Mass of a body you launch. Seeds the mass slider.' },
      { name: 'label', type: 'string', description: 'Accessible name for the drawing. Without it the canvas is decorative.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Show the transport, scene picker, switches and sliders.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
      { name: 'ref', type: 'OrbitSandboxHandle', description: '{ add(body), reset(), clear() }: drive it from code or from your own buttons.' },
    ],
  },
}
