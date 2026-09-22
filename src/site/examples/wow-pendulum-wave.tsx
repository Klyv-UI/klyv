import { useRef, useState } from 'react'
import { Button, PendulumWave, SegmentedControl, Slider, Switch, Text, type PendulumWaveHandle } from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

function PendulumHeroExample() {
  return (
    <div className="flex w-full flex-col gap-3">
      <PendulumWave cycle={30} label="Pendulum wave" className="mx-auto max-w-[760px]" />
      <Text size="caption" tone="faint">
        A thirty-second cycle: the slowest pendulum swings thirty times, the fastest forty-four. Switch to the view from above to watch the row
        split into rows and waves, and turn the chime on to hear it — each bob pings at its own frequency, so the figures are chords and
        arpeggios.
      </Text>
    </div>
  )
}

function PendulumLabExample() {
  const wave = useRef<PendulumWaveHandle>(null)
  const [count, setCount] = useState('15')
  const [cycle, setCycle] = useState(40)
  const [tuning, setTuning] = useState(12)
  const [damping, setDamping] = useState(0)
  const [trails, setTrails] = useState(true)
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl
          label="Pendulums"
          size="sm"
          value={count}
          onValueChange={setCount}
          options={[
            { value: '9', label: '9' },
            { value: '15', label: '15' },
            { value: '24', label: '24' },
          ]}
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={trails} onChange={(event) => setTrails(event.target.checked)} />
          Trails
        </label>
        <Button size="sm" variant="outline" onClick={() => wave.current?.reset()}>
          Pull them all back
        </Button>
      </div>
      <PendulumWave
        ref={wave}
        count={Number(count)}
        cycle={cycle}
        tuning={tuning}
        damping={damping / 1000}
        trails={trails}
        defaultView="front"
        label="Pendulum wave playground"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Cycle · {cycle} s
          </Text>
          <Slider min={20} max={90} step={5} value={cycle} onChange={(event) => setCycle(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Strings cut for · {tuning}°
          </Text>
          <Slider min={0} max={20} value={tuning} onChange={(event) => setTuning(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Damping · {(damping / 1000).toFixed(3)}/s
          </Text>
          <Slider min={0} max={30} value={damping} onChange={(event) => setDamping(Number(event.target.value))} />
        </label>
      </div>
      <Text size="caption" tone="faint">
        Pause, drag the cycle to its very end, then move the release angle: at the angle the strings were cut for the bobs sit in one line;
        either side of it the line bows into a curve, because a pendulum’s period grows with its swing and the short strings start at the
        widest angles.
      </Text>
    </div>
  )
}

function PendulumTwinExample() {
  const side = useRef<PendulumWaveHandle>(null)
  const above = useRef<PendulumWaveHandle>(null)
  const [playing, setPlaying] = useState(false)
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PendulumWave ref={side} cycle={24} count={12} playing={playing} controls={false} sound={false} label="Twelve pendulums from the side" />
        <PendulumWave ref={above} cycle={24} count={12} playing={playing} controls={false} sound={false} view="front" label="The same twelve from above" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={playing ? 'outline' : 'accent'} onClick={() => setPlaying(!playing)} className="min-w-[76px]">
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            side.current?.reset()
            above.current?.reset()
          }}
        >
          Release both
        </Button>
      </div>
    </div>
  )
}

export const demos: ExampleModule = {
  'pendulum-wave': {
    description:
      'The Harvard pendulum-wave demonstration. The strings are cut so that in one cycle pendulum n makes exactly N + n swings — L = g(T/2π)² with T = cycle/(N + n), corrected for the angle each is released from — so the row fans out, snakes into travelling waves, splits into two, three and four rows, dissolves, and returns to a single line when the cycle ends. Each bob is integrated from the real pendulum equation, θ″ = −(g/L)·sin θ, with RK4 at a fixed step, not drawn from a sine; that is why a wide release visibly detunes the pattern, as it would on the real thing. A ruler names where in the cycle you are, the cycle can be scrubbed by replaying the physics from stored states, and an optional chime pings each bob at its own frequency.',
    sections: [
      {
        title: 'One line, fifteen periods',
        description: 'Press play and wait for the figures: a fan, one wave, two, then rows, chaos, and the line again at thirty seconds.',
        Content: PendulumHeroExample,
        bare: true,
        note: motionNote('the loop never starts. The row is drawn as a still at the moment it forms one full wave, and the cycle slider moves through every other figure by hand.'),
      },
      {
        title: 'Cycle, count, tuning and damping',
        description: 'Change how many pendulums, how long the cycle is, which release angle the strings are cut for, and how fast the swing dies away.',
        Content: PendulumLabExample,
      },
      {
        title: 'Two views, one clock',
        description: 'The same twelve pendulums seen from the side and from above, driven by one controlled play state and one reset.',
        Content: PendulumTwinExample,
      },
      rationale(
        'Periodicity, phase and beating are usually taught with a sine plot, which states the result instead of showing it arise.',
        'Fifteen real pendulums with nothing coupling them produce every figure from one tuning rule, so the explanation and the picture are the same thing — and a physics integrator means the detuning is real too.',
        'Physics and maths teaching pages, science-museum and lab sites, loading moments worth watching, and anywhere a page is about rhythm or timing.',
        ['Canvas 2D', 'Button', 'IconButton', 'SegmentedControl', 'Slider', 'Theme tokens'],
      ),
    ],
    props: [
      { name: 'count', type: 'number', defaultValue: '15', description: 'Number of pendulums, 2–48.' },
      { name: 'cycle', type: 'number', defaultValue: '60', description: 'Seconds for the pattern to go through every figure and come back to one line.' },
      { name: 'baseCycles', type: 'number', defaultValue: 'cycle', description: 'Swings the slowest pendulum makes per cycle; each next one makes one more.' },
      { name: 'amplitude', type: 'number', description: 'Controlled release angle of the longest pendulum, in degrees. The rest are pulled back level with it.' },
      { name: 'defaultAmplitude', type: 'number', defaultValue: 'tuning', description: 'Uncontrolled starting release angle.' },
      { name: 'onAmplitudeChange', type: '(degrees: number) => void', description: 'Called when the release-angle slider moves.' },
      { name: 'tuning', type: 'number', defaultValue: '12', description: 'The release angle the strings are cut for, in degrees. 0 is the small-angle textbook cut.' },
      { name: 'damping', type: 'number', defaultValue: '0', description: 'Amplitude decay rate per second; 0.01 loses about 45% of the swing in a minute.' },
      { name: 'view', type: "'side' | 'front'", description: 'Controlled view: the apparatus from the side, or the row from above.' },
      { name: 'defaultView', type: "'side' | 'front'", defaultValue: "'side'", description: 'Uncontrolled starting view.' },
      { name: 'onViewChange', type: "(view: 'side' | 'front') => void", description: 'Called when the view control changes.' },
      { name: 'trails', type: 'boolean', defaultValue: 'true', description: 'Fading after-images of the last third of a second.' },
      { name: 'sound', type: 'boolean', defaultValue: 'true', description: 'Offer the chime: a soft sine ping as each bob passes the bottom.' },
      { name: 'defaultMuted', type: 'boolean', defaultValue: 'true', description: 'Start muted. Sound only ever begins from a click on the sound button.' },
      { name: 'playing', type: 'boolean', description: 'Controlled swinging state.' },
      { name: 'defaultPlaying', type: 'boolean', defaultValue: 'true', description: 'Uncontrolled starting state.' },
      { name: 'onPlayingChange', type: '(playing: boolean) => void', description: 'Called when the play button, or the handle, starts or stops it.' },
      { name: 'stillPhase', type: 'number', defaultValue: '1 / (count − 1)', description: 'Under reduced motion, the moment drawn as a still, as a fraction of the cycle.' },
      { name: 'label', type: 'string', description: 'Accessible name. Without it the drawing is decorative and hidden.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Show the transport, view, cycle ruler and release-angle controls.' },
      { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
      { name: 'ref', type: 'PendulumWaveHandle', description: '{ reset(), start(), stop() } — release again, or drive play from code.' },
    ],
  },
}
