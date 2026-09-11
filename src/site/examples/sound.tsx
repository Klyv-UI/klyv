import { useRef, useState } from 'react'
import {
  AudioVisualizer,
  Knob,
  PianoKeys,
  SegmentedControl,
  Surface,
  Text,
  type VisualizerShape,
} from 'citrine'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ----------------------------------------------------------- specimens */

function VisualizerExample() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [shape, setShape] = useState<VisualizerShape>('bars')
  const [source, setSource] = useState<'file' | 'mic'>('mic')

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Shape"
          size="sm"
          value={shape}
          onValueChange={(value) => setShape(value as VisualizerShape)}
          options={[
            { value: 'bars', label: 'Bars' },
            { value: 'radial', label: 'Radial' },
            { value: 'wave', label: 'Wave' },
          ]}
        />
        <SegmentedControl
          label="Source"
          size="sm"
          value={source}
          onValueChange={(value) => setSource(value as typeof source)}
          options={[
            { value: 'mic', label: 'Microphone' },
            { value: 'file', label: 'Audio element' },
          ]}
        />
      </div>

      <Surface variant="card" padding="lg" className="gap-3">
        <AudioVisualizer
          key={`${source}-${shape}`}
          label={source === 'mic' ? 'Microphone input' : 'Audio element'}
          shape={shape}
          microphone={source === 'mic'}
          audioRef={audioRef}
          height={160}
        />
        {source === 'file' && (
          <audio ref={audioRef} controls className="w-full" src="" aria-label="Audio source">
            Your browser cannot play this.
          </audio>
        )}
      </Surface>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        The microphone path asks permission on the first press and is never routed back to the
        speakers — that would be a feedback loop. The element path <em>is</em> connected back, or
        the audio would go silent the moment it entered the graph.
      </Text>
    </div>
  )
}

function PianoExample() {
  const [last, setLast] = useState<number | null>(null)
  const [timbre, setTimbre] = useState<OscillatorType>('triangle')

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Timbre"
        size="sm"
        value={timbre}
        onValueChange={(value) => setTimbre(value as OscillatorType)}
        className="self-start"
        options={[
          { value: 'sine', label: 'Sine' },
          { value: 'triangle', label: 'Triangle' },
          { value: 'square', label: 'Square' },
          { value: 'sawtooth', label: 'Saw' },
        ]}
      />

      <Surface variant="card" padding="lg">
        <PianoKeys keys={12} timbre={timbre} onNote={setLast} />
      </Surface>

      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {last === null
          ? 'Click the keys, or use z x c v b n m for the whites and s d g h j for the blacks.'
          : `MIDI ${last}. Sound is on — turn your volume down first.`}
      </Text>
    </div>
  )
}

function KnobExample() {
  const [gain, setGain] = useState(72)
  const [pan, setPan] = useState(0)
  const [cutoff, setCutoff] = useState(1200)

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg" className="flex-row flex-wrap items-start gap-8">
        <Knob
          label="Gain"
          value={gain}
          onChange={setGain}
          format={(value) => `${Math.round(value)}%`}
        />
        <Knob
          label="Pan"
          value={pan}
          onChange={setPan}
          min={-50}
          max={50}
          origin={0}
          format={(value) =>
            value === 0 ? 'C' : `${value < 0 ? 'L' : 'R'}${Math.abs(Math.round(value))}`
          }
        />
        <Knob
          label="Cutoff"
          value={cutoff}
          onChange={setCutoff}
          min={80}
          max={12000}
          step={20}
          size={92}
          format={(value) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`)}
        />
      </Surface>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        Drag up and down, not around. Shift is fine adjustment, the wheel works, and arrows, Home
        and End all do what they do on any slider. Pan fills out from the centre because its origin
        is 0 rather than its minimum.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'audio-visualizer': {
    description:
      'A real spectrum, from real audio. getByteFrequencyData returns FFT bins, and almost all musical content sits in the bottom quarter of them — drawing all of them gives a spike on the left and a flat line for the rest of the width.',
    sections: [
      {
        title: 'Three shapes, two sources',
        description: 'Press the button to start — browsers refuse to open an AudioContext without a gesture.',
        bare: true,
        Content: VisualizerExample,
        note: motionNote('unchanged — the picture tracks live sound, which the reader is producing.'),
      },
      rationale(
        'Fake visualisers are everywhere and they all look wrong for the same reason: nothing in them is reacting to the actual audio.',
        'One AudioContext and one source node per element, and trimming the bins to the part with content in it, is the whole difference — plus connecting the analyser back to the destination, without which the page goes silent.',
        'A music player, a voice note, a podcast page, a microphone check.',
        ['Web Audio API', 'canvas', 'VisuallyHidden'],
      ),
      {
        title: 'Two things that catch everyone',
        bare: true,
        Content: () => (
          <Text size="caption" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
            `createMediaElementSource` throws if called twice on the same element, so the node is
            kept in a ref rather than rebuilt on re-render. And routing an element through a context
            without connecting to the destination silences it — which is why so many people conclude
            Web Audio has broken their page.
          </Text>
        ),
      },
    ],
    props: [
      { name: 'audioRef / microphone', type: 'RefObject / boolean', description: 'An element to listen to, or the microphone.' },
      { name: 'shape', type: "'bars' | 'radial' | 'wave'", defaultValue: "'bars'", description: 'Spectrum bars, a ring, or the waveform.' },
      { name: 'fftSize', type: 'number', defaultValue: '512', description: 'Power of two. Higher is more bars and more latency.' },
      { name: 'range', type: 'number', defaultValue: '0.55', description: 'Fraction of the spectrum drawn.' },
    ],
  },

  'piano-keys': {
    description:
      'Keys that actually make a sound. Each note is an oscillator with a short attack and an exponential release, created on press and thrown away on the way down — reusing one and changing its frequency makes every note slide into the next.',
    sections: [
      {
        title: 'An octave',
        description: 'Sound is on. z x c v b n m are the white keys; s d g h j are the blacks.',
        bare: true,
        Content: PianoExample,
        note: motionNote('unchanged — the keys light on press either way.'),
      },
      rationale(
        'A gain that jumps straight to 1 clicks, because a discontinuity in amplitude is broadband noise — it is the single reason hand-rolled Web Audio sounds cheap.',
        'A twelve-millisecond ramp removes it completely, and an exponential release that targets a very small number rather than zero avoids the other classic mistake.',
        'A music tool, an onboarding easter egg, a sound settings page, a game.',
        ['Web Audio API', 'Text', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'from / keys', type: 'number / number', defaultValue: '60 / 10', description: 'Lowest MIDI note, and how many white keys.' },
      { name: 'keyboard', type: 'boolean', defaultValue: 'true', description: 'Bind the home row. Skipped while a field has focus.' },
      { name: 'timbre', type: 'OscillatorType', defaultValue: "'triangle'", description: 'Oscillator shape.' },
      { name: 'onNote', type: '(midi: number) => void', description: 'Fires each time a key sounds.' },
    ],
  },

  knob: {
    description:
      'A rotary control you drag, scroll or arrow. The drag is vertical, not circular — following the pointer’s angle means a pixel near the centre is a huge angular change, and the value spikes every time the pointer crosses the middle.',
    sections: [
      {
        title: 'Gain, pan, cutoff',
        description: 'Pan fills out from the centre, because its origin is 0 rather than its minimum.',
        bare: true,
        Content: KnobExample,
        note: motionNote('unchanged — the knob follows the hand, and nothing else here moves.'),
      },
      rationale(
        'A slider is the right control for a value on a line and the wrong one for a value on a dial — and every audio, colour and camera interface reaches for a knob at some point.',
        'Vertical travel is what every hardware-emulating interface settled on, and stopping the sweep at 270 degrees is what makes minimum and maximum distinguishable at all.',
        'An audio tool, a camera or filter control, a settings panel, a synth.',
        ['SVG', 'Text', 'ARIA slider semantics'],
      ),
    ],
    props: [
      { name: 'value / onChange', type: 'number / fn', description: 'Controlled.' },
      { name: 'min / max / step', type: 'number', defaultValue: '0 / 100 / 0', description: 'Range, and the snap. 0 is continuous.' },
      { name: 'origin', type: 'number', description: 'Where the ring fills out from. Set it to the middle for a pan.' },
      { name: 'sweep', type: 'number', defaultValue: '270', description: 'Degrees of travel. The gap at the bottom is deliberate.' },
      { name: 'format', type: '(value) => string', description: 'The readout, and the aria-valuetext.' },
    ],
  },
}
