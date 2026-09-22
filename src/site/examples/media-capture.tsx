import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioTrimmer,
  BlurHashImage,
  Button,
  CameraCapture,
  CaptionEditor,
  DictationButton,
  Field,
  Magnifier,
  PanoramaViewer,
  PitchTuner,
  ReadAloud,
  SegmentedControl,
  Surface,
  Switch,
  Text,
  Textarea,
  VoiceRecorder,
  decodeBlurHash,
  describePitch,
  detectPitch,
  encodeBlurHash,
  encodeWav,
  serializeCaptions,
  type AudioTrimmerRange,
  type CameraCaptureResult,
  type CaptionEditorCue,
  type PitchTunerReading,
  type VoiceRecorderResult,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Text size="caption" tone="faint">
      {label}: <code className="font-mono text-ink">{value || '—'}</code>
    </Text>
  )
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

/** Samples of `seconds` of sound from a function of time, for demos that must work offline. */
function synthesise(seconds: number, sampleRate: number, wave: (t: number) => number) {
  const samples = new Float32Array(Math.round(seconds * sampleRate))
  for (let i = 0; i < samples.length; i += 1) samples[i] = wave(i / sampleRate)
  return samples
}

/** A 1×1 transparent GIF, for when a canvas cannot be drawn (tests, very old browsers). */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

/* --------------------------------------------------------- camera capture */

function CameraExample() {
  const [photos, setPhotos] = useState<(CameraCaptureResult & { url: string })[]>([])
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), [])
  return (
    <div className="grid w-full gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
      <CameraCapture
        label="Profile photo camera"
        onCapture={(result) => {
          const url = URL.createObjectURL(result.blob)
          urls.current.push(url)
          setPhotos((current) => [{ ...result, url }, ...current].slice(0, 4))
        }}
      />
      <Surface variant="tile" padding="md" className="flex flex-col gap-2">
        <Text size="label" weight="bold">
          Used photos
        </Text>
        {photos.length === 0 ? (
          <Text size="caption" tone="faint" leading="normal">
            Photos you choose to use appear here, with their real size.
          </Text>
        ) : (
          <ul className="flex flex-col gap-2">
            {photos.map((photo) => (
              <li key={photo.url} className="flex items-center gap-2">
                <img src={photo.url} alt="" className="size-10 rounded-[8px] object-cover" />
                <Text size="caption" tone="soft" tabular>
                  {photo.width}×{photo.height} · {kb(photo.blob.size)}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  )
}

/* ---------------------------------------------------------- voice recorder */

function RecorderExample() {
  const [notes, setNotes] = useState<VoiceRecorderResult[]>([])
  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <VoiceRecorder label="Voice note" maxDuration={30} onRecordingComplete={(result) => setNotes((current) => [result, ...current])} />
      <Readout label="last recording" value={notes[0] ? `${notes[0].duration.toFixed(1)}s · ${kb(notes[0].blob.size)} · ${notes[0].mimeType}` : ''} />
    </div>
  )
}

/* ---------------------------------------------------------- caption editor */

const PHRASES: [number, number][] = [
  [0.4, 3.1],
  [3.5, 6.6],
  [7.0, 10.4],
  [10.9, 14.2],
  [14.6, 18.0],
]

/** Something that sounds like phrases of speech: a buzzy voice with syllables, and pauses between. */
function speechLikeWav() {
  const rate = 16000
  const samples = synthesise(19, rate, (t) => {
    const phrase = PHRASES.findIndex(([a, b]) => t >= a && t < b)
    if (phrase === -1) return 0
    const pitch = 130 + phrase * 14 + 18 * Math.sin(t * 2.1)
    const syllable = Math.max(0, Math.sin(t * Math.PI * 4.2)) ** 1.5
    const tone = Math.sin(2 * Math.PI * pitch * t) + 0.5 * Math.sin(4 * Math.PI * pitch * t) + 0.25 * Math.sin(6 * Math.PI * pitch * t)
    return tone * syllable * 0.12
  })
  return encodeWav([samples], rate)
}

const INITIAL_CUES: CaptionEditorCue[] = [
  { id: 'c1', start: 0.4, end: 3.1, text: 'Welcome back to the release notes.' },
  { id: 'c2', start: 3.5, end: 6.6, text: 'This week: faster exports and a new trimmer.' },
  { id: 'c3', start: 6.3, end: 10.4, text: 'Exports now run in the background,' },
  { id: 'c4', start: 10.9, end: 14.2, text: 'so you can keep editing while they finish.' },
]

function CaptionExample() {
  const media = useRef<HTMLAudioElement>(null)
  const [cues, setCues] = useState(INITIAL_CUES)
  const [time, setTime] = useState(0)
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return
    const url = URL.createObjectURL(speechLikeWav())
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [])
  const showing = cues.find((cue) => time >= cue.start && time < cue.end)
  return (
    <div className="flex w-full flex-col gap-4">
      <Surface variant="tile" padding="md" className="flex flex-col gap-2">
        <audio ref={media} src={src} controls aria-label="Release notes episode" className="h-10 w-full" onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} />
        <Text size="body" weight="bold" className="min-h-6 text-center" aria-live="off">
          {showing?.text ?? ' '}
        </Text>
      </Surface>
      <CaptionEditor mediaRef={media} value={cues} onValueChange={setCues} exportName="release-notes" label="Episode captions" />
      <details className="text-[12px]">
        <summary className="cursor-pointer font-semibold text-ink-soft">WebVTT output</summary>
        <pre className="mt-2 overflow-x-auto rounded-[var(--radius-tile)] bg-surface-sunken p-3 font-mono text-[11px] text-ink">{serializeCaptions(cues, 'vtt')}</pre>
      </details>
    </div>
  )
}

/* -------------------------------------------------------- dictation button */

function DictationExample() {
  const field = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('Hi Sam, thanks for the notes. ')
  const [lang, setLang] = useState<'en-US' | 'en-GB' | 'es-ES'>('en-US')
  const [phrases, setPhrases] = useState(0)
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <Field label="Reply">
        <Textarea ref={field} rows={4} value={text} onChange={(event) => setText(event.target.value)} />
      </Field>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DictationButton targetRef={field} lang={lang} onTranscript={() => setPhrases((n) => n + 1)} />
        <SegmentedControl
          label="Dictation language"
          size="sm"
          value={lang}
          onValueChange={setLang}
          options={[
            { value: 'en-US', label: 'English (US)' },
            { value: 'en-GB', label: 'English (UK)' },
            { value: 'es-ES', label: 'Español' },
          ]}
        />
      </div>
      <Readout label="phrases inserted" value={String(phrases)} />
    </div>
  )
}

/* ------------------------------------------------------------- read aloud */

const PASSAGE =
  'The lighthouse keeper climbed the spiral stairs at dusk. One hundred and twelve steps, the same as every night. At the top, she wound the clockwork, trimmed the wick, and watched the first beam sweep across the water.'

function ReadAloudExample() {
  return (
    <Surface variant="card" padding="lg" className="w-full max-w-[560px]">
      <ReadAloud text={PASSAGE} label="Read the story aloud" />
    </Surface>
  )
}

function ReadInPlaceExample() {
  const article = useRef<HTMLDivElement>(null)
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <ReadAloud targetRef={article} label="Read the article aloud" />
      <div ref={article} className="flex flex-col gap-2 text-[14px] leading-relaxed text-ink">
        <p>
          <strong>Offline first.</strong> The app now saves every change on the device and syncs when a connection returns.
        </p>
        <p>Conflicts are rare. When two people edit the same line, both versions are kept and you choose which to keep.</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ pitch tuner */

const STRINGS = [
  { name: 'E2', frequency: 82.41 },
  { name: 'A2', frequency: 110 },
  { name: 'D3', frequency: 146.83 },
  { name: 'G3', frequency: 196 },
  { name: 'B3', frequency: 246.94 },
  { name: 'E4', frequency: 329.63 },
]

function ReferenceTones() {
  const tone = useRef<{ context: AudioContext; oscillator: OscillatorNode } | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const stop = () => {
    tone.current?.oscillator.stop()
    void tone.current?.context.close()
    tone.current = null
    setPlaying(null)
  }
  useEffect(() => stop, [])
  const play = (name: string, frequency: number) => {
    const was = playing
    stop()
    if (was === name || typeof AudioContext === 'undefined') return
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = frequency
    gain.gain.value = 0.15
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    tone.current = { context, oscillator }
    setPlaying(name)
  }
  return (
    <div className="flex flex-col gap-2">
      <Text size="caption" tone="soft" leading="normal">
        No instrument nearby? Play a reference string through your speakers and let the tuner hear it.
      </Text>
      <div role="group" aria-label="Reference tones" className="flex flex-wrap gap-1.5">
        {STRINGS.map((string) => (
          <Button key={string.name} size="sm" variant={playing === string.name ? 'accent' : 'muted'} aria-pressed={playing === string.name} onClick={() => play(string.name, string.frequency)}>
            {string.name}
          </Button>
        ))}
      </div>
    </div>
  )
}

function TunerExample() {
  const [reading, setReading] = useState<PitchTunerReading | null>(null)
  return (
    <div className="grid w-full items-start gap-4 md:grid-cols-[380px_minmax(0,1fr)]">
      <PitchTuner label="Guitar tuner" onPitch={setReading} />
      <div className="flex flex-col gap-3">
        <ReferenceTones />
        <Readout label="onPitch" value={reading ? `${reading.frequency.toFixed(2)} Hz → ${reading.note}${reading.octave} ${reading.cents}¢` : ''} />
      </div>
    </div>
  )
}

/** The detector run on generated waveforms, so its accuracy is visible without a microphone. */
function DetectorSpecimens() {
  const rows = useMemo(() => {
    const rate = 48000
    const cases: { label: string; frequency: number; wave: (phase: number) => number }[] = [
      { label: 'Sine, low E', frequency: 82.41, wave: (p) => Math.sin(p) },
      { label: 'Sawtooth, A 432 tuning', frequency: 432, wave: (p) => ((p / Math.PI) % 2) - 1 },
      { label: 'Strong 2nd harmonic, G3', frequency: 196, wave: (p) => 0.4 * Math.sin(p) + Math.sin(2 * p) + 0.3 * Math.sin(3 * p) },
      { label: 'Sine, 12¢ sharp of C5', frequency: 523.25 * 2 ** (12 / 1200), wave: (p) => Math.sin(p) },
    ]
    return cases.map(({ label, frequency, wave }) => {
      const samples = synthesise(2048 / rate, rate, (t) => 0.5 * wave(2 * Math.PI * frequency * t))
      const found = detectPitch(samples, rate)
      return { label, frequency, found, note: found ? describePitch(found, label.includes('432') ? 432 : 440) : null }
    })
  }, [])
  return (
    <table className="w-full text-left text-[12px]">
      <thead>
        <tr className="text-ink-faint">
          <th className="py-1.5 font-semibold">Signal</th>
          <th className="py-1.5 font-semibold">True</th>
          <th className="py-1.5 font-semibold">Detected</th>
          <th className="py-1.5 font-semibold">Note</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-ink">
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-line">
            <td className="py-1.5 font-semibold">{row.label}</td>
            <td className="py-1.5">{row.frequency.toFixed(2)} Hz</td>
            <td className="py-1.5">{row.found ? `${row.found.toFixed(2)} Hz` : '—'}</td>
            <td className="py-1.5">{row.note ? `${row.note.note}${row.note.octave} ${row.note.cents > 0 ? '+' : ''}${row.note.cents}¢` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ----------------------------------------------------------- audio trimmer */

/** Eight seconds of a small loop: kick on the beat, hats between, a four-note tune. */
function loopWav() {
  const rate = 22050
  const tune = [261.63, 329.63, 392, 523.25]
  let noise = 1
  const samples = synthesise(8, rate, (t) => {
    const beat = t % 0.5
    const kick = beat < 0.18 ? Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-beat * 30)) * beat) * Math.exp(-beat * 14) : 0
    const offbeat = (t + 0.25) % 0.5
    noise = (noise * 16807) % 2147483647
    const hat = offbeat < 0.05 ? ((noise / 2147483647) * 2 - 1) * Math.exp(-offbeat * 90) * 0.35 : 0
    const note = tune[Math.floor(t / 1) % 4]
    const within = t % 1
    const melody = t > 2 ? Math.sin(2 * Math.PI * note * t) * Math.exp(-within * 3) * 0.3 : 0
    return Math.max(-1, Math.min(1, kick * 0.8 + hat + melody))
  })
  return encodeWav([samples], rate)
}

function TrimmerExample() {
  const file = useMemo(() => loopWav(), [])
  const [range, setRange] = useState<AudioTrimmerRange>({ start: 2, end: 6 })
  const [exported, setExported] = useState('')
  return (
    <div className="flex w-full flex-col gap-3">
      <AudioTrimmer
        file={file}
        value={range}
        onValueChange={setRange}
        exportName="loop-clip"
        label="Trim the loop"
        onExport={(wav, at) => setExported(`${kb(wav.size)} WAV, ${(at.end - at.start).toFixed(2)}s`)}
      />
      <Readout label="selection" value={`${range.start.toFixed(2)}s → ${range.end.toFixed(2)}s`} />
      <Readout label="last export" value={exported} />
    </div>
  )
}

/* --------------------------------------------------------- panorama viewer */

/** An equirectangular test scene: sky, sun, hills, a grid every 15° and the compass on the horizon. */
function makePanorama(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const context = canvas.getContext('2d')
  if (!context) return BLANK
  const w = canvas.width
  const h = canvas.height
  const sky = context.createLinearGradient(0, 0, 0, h / 2)
  sky.addColorStop(0, '#1d3b8b')
  sky.addColorStop(0.7, '#5b9be6')
  sky.addColorStop(1, '#f7d9a0')
  context.fillStyle = sky
  context.fillRect(0, 0, w, h / 2)
  const ground = context.createLinearGradient(0, h / 2, 0, h)
  ground.addColorStop(0, '#5f8f3a')
  ground.addColorStop(1, '#23391a')
  context.fillStyle = ground
  context.fillRect(0, h / 2, w, h / 2)

  // The sun, north-east and 20° up.
  context.fillStyle = '#fff4c7'
  context.beginPath()
  context.arc(w * 0.625, h / 2 - (20 / 180) * h, 30, 0, Math.PI * 2)
  context.fill()

  // Hills whose outline wraps seamlessly at the back.
  context.fillStyle = '#3f6b2f'
  context.beginPath()
  context.moveTo(0, h / 2)
  for (let x = 0; x <= w; x += 8) {
    const a = (x / w) * Math.PI * 2
    context.lineTo(x, h / 2 - 28 - 22 * Math.sin(a * 3) - 14 * Math.sin(a * 7 + 1) - 8 * Math.sin(a * 13))
  }
  context.lineTo(w, h / 2)
  context.fill()

  context.strokeStyle = 'rgba(255,255,255,0.28)'
  context.lineWidth = 2
  for (let i = 0; i <= 24; i += 1) {
    context.beginPath()
    context.moveTo((i / 24) * w, 0)
    context.lineTo((i / 24) * w, h)
    context.stroke()
  }
  for (let i = 1; i < 12; i += 1) {
    context.beginPath()
    context.moveTo(0, (i / 12) * h)
    context.lineTo(w, (i / 12) * h)
    context.stroke()
  }
  context.strokeStyle = 'rgba(255,255,255,0.8)'
  context.beginPath()
  context.moveTo(0, h / 2)
  context.lineTo(w, h / 2)
  context.stroke()

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineJoin = 'round'
  const label = (text: string, u: number, size: number, y = h / 2 - 70) => {
    context.font = `800 ${size}px system-ui, sans-serif`
    context.lineWidth = size / 6
    context.strokeStyle = 'rgba(15,23,42,0.75)'
    context.fillStyle = '#ffffff'
    for (const x of [u * w, u * w - w, u * w + w]) {
      context.strokeText(text, x, y)
      context.fillText(text, x, y)
    }
  }
  const points = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
  points.forEach((point, i) => label(point, i / 8, point.length === 1 ? 72 : 44))
  for (let degrees = 0; degrees < 360; degrees += 30) label(`${degrees}°`, (degrees / 360 + 0.5) % 1, 22, h / 2 + 40)
  label('ZENITH', 0.5, 40, 40)
  label('NADIR', 0.5, 40, h - 40)
  return canvas.toDataURL('image/jpeg', 0.9)
}

function PanoramaExample() {
  const [src, setSrc] = useState<string | null>(null)
  const [spin, setSpin] = useState(true)
  useEffect(() => setSrc(makePanorama()), [])
  return (
    <div className="flex w-full flex-col gap-3">
      <label className="flex items-center gap-2 self-start text-[12px] font-semibold text-ink-soft">
        <Switch checked={spin} onChange={(event) => setSpin(event.target.checked)} switchSize="sm" />
        Start with auto-rotate
      </label>
      {src && <PanoramaViewer key={String(spin)} src={src} alt="Test scene: hills under an evening sky, compass points on the horizon" autoRotate={spin} height={380} />}
    </div>
  )
}

/* -------------------------------------------------------------- magnifier */

function boardSvg() {
  const parts: string[] = []
  const labels = ['R12 4.7k', 'C3 100n', 'U2 ATmega', 'D1 1N4148', 'Q4 BC547', 'L1 10µH', 'J3 USB-C', 'Y1 16MHz']
  for (let i = 0; i < 48; i += 1) {
    const x = 40 + (i % 8) * 90
    const y = 50 + Math.floor(i / 8) * 72
    const wide = i % 3 === 0
    parts.push(
      `<rect x="${x}" y="${y}" width="${wide ? 56 : 30}" height="${wide ? 34 : 14}" rx="2" fill="${wide ? '#1f2937' : '#b45309'}"/>`,
      `<text x="${x}" y="${y + (wide ? 44 : 24)}" font-size="5" fill="#ecfccb" font-family="monospace">${labels[i % labels.length]}</text>`,
      `<path d="M${x + 15} ${y + 7}V${y - 18}H${x + 70}" stroke="#facc15" stroke-width="1.2" fill="none" opacity="0.8"/>`,
    )
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480"><rect width="800" height="480" fill="#166534"/><g opacity="0.35" stroke="#bbf7d0" stroke-width="0.4">${Array.from({ length: 40 }, (_, i) => `<path d="M${i * 20} 0V480"/>`).join('')}</g>${parts.join('')}<text x="760" y="468" font-size="4" fill="#dcfce7" text-anchor="end" font-family="monospace">REV C · 2026-09 · MADE FOR KLYV DEMOS</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function MagnifierExample() {
  const src = useMemo(boardSvg, [])
  const [shape, setShape] = useState<'circle' | 'square'>('circle')
  const [zoom, setZoom] = useState<'2' | '3' | '5'>('3')
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <SegmentedControl label="Lens shape" size="sm" value={shape} onValueChange={setShape} options={[{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }]} />
        <SegmentedControl label="Zoom" size="sm" value={zoom} onValueChange={setZoom} options={[{ value: '2', label: '2×' }, { value: '3', label: '3×' }, { value: '5', label: '5×' }]} />
      </div>
      <Magnifier src={src} alt="A circuit board with dozens of labelled components in tiny print" aspectRatio={800 / 480} shape={shape} zoom={Number(zoom)} size={shape === 'circle' ? 170 : 150} />
    </div>
  )
}

/* -------------------------------------------------------- blur hash image */

/** A small landscape, drawn so the demo has a real image to encode. */
function drawScene(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) return null
  const { width: w, height: h } = canvas
  const sky = context.createLinearGradient(0, 0, 0, h * 0.62)
  sky.addColorStop(0, '#f97316')
  sky.addColorStop(0.55, '#fb7185')
  sky.addColorStop(1, '#fde68a')
  context.fillStyle = sky
  context.fillRect(0, 0, w, h)
  context.fillStyle = '#fff7d6'
  context.beginPath()
  context.arc(w * 0.68, h * 0.48, h * 0.12, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#7c2d12'
  context.beginPath()
  context.moveTo(0, h * 0.62)
  context.quadraticCurveTo(w * 0.25, h * 0.3, w * 0.5, h * 0.6)
  context.quadraticCurveTo(w * 0.8, h * 0.4, w, h * 0.62)
  context.lineTo(w, h)
  context.lineTo(0, h)
  context.fill()
  const lake = context.createLinearGradient(0, h * 0.62, 0, h)
  lake.addColorStop(0, '#0e7490')
  lake.addColorStop(1, '#164e63')
  context.fillStyle = lake
  context.fillRect(0, h * 0.7, w, h * 0.3)
  return context
}

function useScene(componentsX: number) {
  return useMemo(() => {
    if (typeof document === 'undefined') return null
    const full = document.createElement('canvas')
    full.width = 480
    full.height = 300
    if (!drawScene(full)) return null
    // Encode a 32-pixel copy: the hash keeps only low frequencies, and cost grows per pixel.
    const small = document.createElement('canvas')
    small.width = 32
    small.height = 20
    const context = small.getContext('2d')
    if (!context) return null
    context.drawImage(full, 0, 0, small.width, small.height)
    const hash = encodeBlurHash(context.getImageData(0, 0, small.width, small.height), componentsX, 3)
    return { hash, src: full.toDataURL('image/png') }
  }, [componentsX])
}

function PlaceholderOnly({ hash }: { hash: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const frame = context.createImageData(32, 20)
    frame.data.set(decodeBlurHash(hash, 32, 20))
    context.putImageData(frame, 0, 0)
  }, [hash])
  return <canvas ref={canvas} width={32} height={20} aria-hidden="true" className="aspect-[8/5] w-full rounded-[var(--radius-card)] bg-surface-sunken" />
}

function BlurHashExample() {
  const [components, setComponents] = useState<'3' | '4' | '6'>('4')
  const scene = useScene(Number(components))
  const [src, setSrc] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  useEffect(() => {
    if (!scene) return
    // Hold the real image back a moment, as a slow network would.
    setSrc(null)
    const timer = setTimeout(() => setSrc(scene.src), 1400)
    return () => clearTimeout(timer)
  }, [scene, round])

  if (!scene) {
    return (
      <Text size="caption" tone="faint">
        This demo draws its image on a canvas, which is not available here.
      </Text>
    )
  }
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl label="Horizontal components" size="sm" value={components} onValueChange={setComponents} options={[{ value: '3', label: '3 × 3' }, { value: '4', label: '4 × 3' }, { value: '6', label: '6 × 3' }]} />
        <Button size="sm" variant="outline" onClick={() => setRound((n) => n + 1)}>
          Load again
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <figure className="flex flex-col gap-1.5">
          <PlaceholderOnly hash={scene.hash} />
          <figcaption className="text-[11px] font-semibold text-ink-faint">Decoded placeholder</figcaption>
        </figure>
        <figure className="flex flex-col gap-1.5">
          {src ? (
            <BlurHashImage key={round} hash={scene.hash} src={src} alt="Sunset over hills and a lake" width={480} height={300} />
          ) : (
            <BlurHashImage key={`wait-${round}`} hash={scene.hash} src={BLANK} alt="" width={480} height={300} />
          )}
          <figcaption className="text-[11px] font-semibold text-ink-faint">BlurHashImage, network slowed</figcaption>
        </figure>
        <figure className="flex flex-col gap-1.5">
          <img src={scene.src} alt="The original sunset image" className="aspect-[8/5] w-full rounded-[var(--radius-card)] object-cover" />
          <figcaption className="text-[11px] font-semibold text-ink-faint">Original</figcaption>
        </figure>
      </div>
      <Readout label="hash" value={`${scene.hash} (${scene.hash.length} characters)`} />
    </div>
  )
}

/* ------------------------------------------------------------------ pages */

export const demos: ExampleModule = {
  'camera-capture': {
    description:
      'Take a photo with the device camera inside the page. The preview is live video from getUserMedia, the front camera is mirrored as a mirror would be, and the still is drawn to a canvas the right way round and handed over as a Blob after Retake or Use. A blocked permission, a missing camera and a camera busy elsewhere each get their own explanation, and the camera is released after use and on unmount.',
    sections: [
      {
        title: 'Example',
        description: 'Start the camera, take a photo, then use it or retake. With more than one camera, a device menu appears.',
        bare: true,
        Content: CameraExample,
      },
      rationale(
        'A file input with capture hands the job to the operating system, which works on phones and does nothing useful on a laptop.',
        'An in-page preview with plain-language permission states and a review step, releasing the camera the moment it is done.',
        'Profile photos, ID and document capture, receipts, visitor check-in, support tickets with a photo.',
        ['Button', 'Select', 'Text', 'getUserMedia', 'canvas'],
      ),
    ],
    props: [
      { name: 'onCapture', type: '(result: CameraCaptureResult) => void', description: '{ blob, width, height } when “Use photo” is pressed.' },
      { name: 'facingMode', type: "'user' | 'environment'", defaultValue: "'user'", description: 'Which camera to ask for first.' },
      { name: 'mirror', type: "boolean | 'auto'", defaultValue: "'auto'", description: 'Mirror the preview; auto mirrors front cameras only.' },
      { name: 'mimeType', type: "'image/jpeg' | 'image/png' | 'image/webp'", defaultValue: "'image/jpeg'", description: 'Format of the still.' },
      { name: 'quality', type: 'number', defaultValue: '0.9', description: 'Encoder quality for jpeg and webp.' },
      { name: 'idealWidth', type: 'number', defaultValue: '1280', description: 'Resolution requested from the camera.' },
      { name: 'label', type: 'string', defaultValue: "'Camera'", description: 'Names the control and the preview.' },
    ],
  },

  'voice-recorder': {
    description:
      'Record a voice note with MediaRecorder. A live level meter — the RMS of the microphone’s waveform, in decibels — shows in the first second that the right input is working. It pauses and resumes, stops by itself at a maximum length, plays the take back, and hands over a Blob with a duration measured while recording, because WebM files often carry none.',
    sections: [
      {
        title: 'Example',
        description: 'Up to thirty seconds. Pause, resume, stop, listen back, discard.',
        bare: true,
        Content: RecorderExample,
        note: motionNote('the level bar steps four times a second instead of streaming, and the recording dot does not pulse.'),
      },
      rationale(
        'A recording that captured silence is only discovered on playback, after the person has already said everything once.',
        'A real input meter up front, honest permission states, and a duration that does not depend on the container’s header.',
        'Voice notes in chat, spoken answers in surveys, support messages, pronunciation practice, dictated field reports.',
        ['Button', 'Text', 'MediaRecorder', 'AnalyserNode'],
      ),
    ],
    props: [
      { name: 'onRecordingComplete', type: '(result: VoiceRecorderResult) => void', description: '{ blob, duration, mimeType } when a recording stops.' },
      { name: 'onDiscard', type: '() => void', description: 'When the recording is thrown away.' },
      { name: 'maxDuration', type: 'number', defaultValue: '120', description: 'Seconds before recording stops by itself.' },
      { name: 'mimeType', type: 'string', description: 'Preferred container; falls back to what the browser supports.' },
      { name: 'label', type: 'string', defaultValue: "'Voice recorder'", description: 'Names the recorder.' },
    ],
  },

  'caption-editor': {
    description:
      'Write and time subtitle cues against the audio or video they belong to. Each start and end can be stamped from the player’s current time, the cue under the playhead is highlighted as it plays, and problems are flagged in place — a cue that ends before it starts, or one that overlaps the last. WebVTT and SRT import from pasted text or a file, and export as a download.',
    sections: [
      {
        title: 'Example',
        description: 'A generated nineteen-second clip. Cue 3 starts before cue 2 ends, so it is flagged. Play it and watch the highlight follow.',
        bare: true,
        Content: CaptionExample,
      },
      rationale(
        'Typing timecodes while scrubbing is how captions end up a second late, and overlaps are usually found by viewers.',
        'Stamping from the player, a live highlight and inline validation make timing visible; one parser handles both common formats.',
        'Video platforms, course authoring, podcast transcripts, accessibility review, localisation of subtitles.',
        ['Input', 'Textarea', 'Button', 'IconButton', 'Text'],
      ),
    ],
    props: [
      { name: 'mediaRef', type: 'RefObject<HTMLMediaElement | null>', description: 'The audio or video being captioned.' },
      { name: 'value / defaultValue', type: 'CaptionEditorCue[]', description: '{ id, start, end, text }, times in seconds.' },
      { name: 'onValueChange', type: '(cues) => void', description: 'After every edit, import, add or delete.' },
      { name: 'exportName', type: 'string', defaultValue: "'captions'", description: 'File name for .vtt and .srt downloads.' },
      { name: 'label', type: 'string', defaultValue: "'Caption editor'", description: 'Names the editor.' },
      { name: 'parseCaptions / serializeCaptions', type: 'functions', description: 'The WebVTT and SRT reader and writer, exported for use elsewhere.' },
    ],
  },

  'dictation-button': {
    description:
      'A microphone button that types what you say into a field, at the caret. It uses the Web Speech API’s recognition, shows the words still being heard as a hint under the button, and only puts finished phrases into the field — through an input event, so a controlled React field updates. Blocked microphones, silence and network failures each get their own message; where recognition does not exist, the button is not shown.',
    sections: [
      {
        title: 'Example',
        description: 'Put the caret anywhere in the reply and dictate. Choose the language first.',
        bare: true,
        Content: DictationExample,
      },
      rationale(
        'Typing long replies on a phone is slow, and system dictation is not available in every field or on every desktop.',
        'Insertion at the caret, final-only updates and an honest unsupported state keep it predictable in a real form.',
        'Support replies, notes, search boxes, form comments, accessibility for people who cannot type comfortably.',
        ['Text', 'SpeechRecognition'],
      ),
    ],
    props: [
      { name: 'targetRef', type: 'RefObject<HTMLInputElement | HTMLTextAreaElement | null>', description: 'The field the words go into.' },
      { name: 'lang', type: 'string', description: 'BCP 47 language; defaults to the page language.' },
      { name: 'continuous', type: 'boolean', defaultValue: 'true', description: 'Keep listening across pauses until pressed again.' },
      { name: 'onTranscript', type: '(text: string) => void', description: 'Each finished phrase, after it is inserted.' },
      { name: 'label', type: 'string', defaultValue: "'Dictate'", description: 'The button’s name.' },
      { name: 'unsupportedMessage', type: 'ReactNode', description: 'Shown instead of the button where recognition is missing; null hides it.' },
    ],
  },

  'read-aloud': {
    description:
      'Reads text aloud with the browser’s own voices and marks each word as it is spoken, driven by the synthesiser’s boundary events. Play, pause and stop; speed and voice can change mid-sentence and it carries on from the current word. Given text, it renders its own copy; given a container, it reads it in place and highlights with the CSS Custom Highlight API.',
    sections: [
      { title: 'Example', description: 'The component renders the passage and highlights it as it reads.', bare: true, Content: ReadAloudExample },
      { title: 'Reading in place', description: 'Pointed at existing markup. Highlighting here needs the CSS Custom Highlight API.', bare: true, Content: ReadInPlaceExample },
      rationale(
        'Readers with dyslexia and people learning a language follow along better when they can see which word is being spoken.',
        'Boundary events keep the highlight exact where timing guesses drift; the Highlight API marks words without rewriting the page.',
        'Articles, lessons, help centres, long-form onboarding, proofreading your own writing by ear.',
        ['Button', 'Select', 'speechSynthesis', 'CSS Highlight API'],
      ),
    ],
    props: [
      { name: 'text', type: 'string', description: 'Text to read; rendered by the component.' },
      { name: 'targetRef', type: 'RefObject<HTMLElement | null>', description: 'Or read the text inside this element.' },
      { name: 'lang', type: 'string', description: 'Picks the default voice; defaults to the page language.' },
      { name: 'defaultRate', type: 'number', defaultValue: '1', description: 'Starting speed.' },
      { name: 'label', type: 'string', defaultValue: "'Read aloud'", description: 'Names the controls.' },
    ],
  },

  'pitch-tuner': {
    description:
      'A chromatic tuner. It listens through the microphone and finds the pitch with the YIN method on the analyser’s raw waveform — not the FFT, whose bins are too coarse at the bottom of a bass — then shows the nearest note, its octave and how many cents off it is on a needle. Concert pitch is adjustable, readings are median-filtered so the needle settles, and the microphone is released on stop and unmount.',
    sections: [
      {
        title: 'Example',
        description: 'Start the tuner, then play a note — or a reference tone through your speakers.',
        bare: true,
        Content: TunerExample,
        note: motionNote('the needle jumps to each reading instead of easing towards it.'),
      },
      { title: 'The detector on known signals', description: 'detectPitch run on generated waveforms, including one whose second harmonic is louder than its fundamental.', bare: true, Content: DetectorSpecimens },
      rationale(
        'Tuning by ear is hard for beginners, and spectrum-peak tuners jump an octave on instruments with strong harmonics.',
        'YIN is accurate to a cent and resists octave errors; median filtering and a slow announcement keep it readable.',
        'Music lessons, practice apps, instrument shops, singing exercises, any page that needs to hear a pitch.',
        ['Button', 'Input', 'Text', 'AnalyserNode'],
      ),
    ],
    props: [
      { name: 'referenceA4 / defaultReferenceA4', type: 'number', defaultValue: '440', description: 'Concert pitch, 400 to 480 Hz.' },
      { name: 'onReferenceA4Change', type: '(hertz: number) => void', description: 'When the reference changes.' },
      { name: 'tolerance', type: 'number', defaultValue: '5', description: 'Cents either side that count as in tune.' },
      { name: 'minFrequency / maxFrequency', type: 'number', defaultValue: '60 / 1500', description: 'The range listened for.' },
      { name: 'onPitch', type: '(reading | null) => void', description: '{ frequency, note, octave, cents } per reading; null on silence.' },
      { name: 'detectPitch / describePitch', type: 'functions', description: 'The detector and note naming, exported.' },
    ],
  },

  'audio-trimmer': {
    description:
      'Cut a clip from an audio file in the browser. The file is decoded with Web Audio and drawn as min/max peaks, the in and out handles are sliders you can drag or nudge with the keys, the selection previews through the speakers, and export writes a WAV straight from the decoded samples — nothing is uploaded.',
    sections: [
      {
        title: 'Example',
        description: 'An eight-second loop generated in the page. Drag the handles, or focus one and use the arrows (Shift for a second), then play or export.',
        bare: true,
        Content: TrimmerExample,
        note: motionNote('the playhead steps four times a second instead of gliding.'),
      },
      rationale(
        'Trimming a recording usually means a desktop editor or uploading the file to a service.',
        'Decoding, drawing and WAV encoding are all possible in the page, and keyboard-operable handles make the cut accessible.',
        'Ringtones, podcast teasers, voice-note clean-up, sample packs, clipping a quote from an interview.',
        ['Button', 'Text', 'AudioContext', 'encodeWav'],
      ),
    ],
    props: [
      { name: 'file', type: 'Blob | null', description: 'The audio to decode.' },
      { name: 'allowPick', type: 'boolean', defaultValue: 'true', description: 'Show a file picker.' },
      { name: 'value / defaultValue', type: 'AudioTrimmerRange', description: '{ start, end } in seconds.' },
      { name: 'onValueChange', type: '(range) => void', description: 'As the handles move.' },
      { name: 'onExport', type: '(wav: Blob, range) => void', description: 'With the trimmed WAV.' },
      { name: 'minLength', type: 'number', defaultValue: '0.1', description: 'Shortest selection, in seconds.' },
      { name: 'height', type: 'number', defaultValue: '96', description: 'Waveform height in pixels.' },
      { name: 'encodeWav', type: '(channels, sampleRate) => Blob', description: 'The 16-bit PCM writer, exported.' },
    ],
  },

  'panorama-viewer': {
    description:
      'A 360° photo you can look around in. A WebGL fragment shader casts a ray for every pixel and samples the equirectangular image at its longitude and latitude, so the view is a true perspective at any tilt — not a flat image slid sideways. Drag or pinch, use the arrow keys, zoom with the wheel or plus and minus. Auto-rotate stops when someone takes over and never runs under reduced motion.',
    sections: [
      {
        title: 'Example',
        description: 'The scene is drawn on a canvas in the page: sky, hills, a 15° grid, and the compass on the horizon.',
        bare: true,
        Content: PanoramaExample,
        note: motionNote('auto-rotate is off and its button is hidden; dragging and the keys still work.'),
      },
      rationale(
        'Panning a flat panorama bends every straight line, and looking up shows a smeared strip instead of the sky.',
        'A per-pixel ray lookup gives a correct projection with no mesh and no seam, in one small shader.',
        'Property tours, venue previews, travel pages, site inspections, museum rooms, real-estate listings.',
        ['IconButton', 'WebGL'],
      ),
    ],
    props: [
      { name: 'src', type: 'string', description: 'An equirectangular image, twice as wide as tall.' },
      { name: 'alt', type: 'string', description: 'What the scene is.' },
      { name: 'initialYaw / initialPitch', type: 'number', defaultValue: '0', description: 'Starting heading and tilt, in degrees.' },
      { name: 'initialFov / minFov / maxFov', type: 'number', defaultValue: '75 / 30 / 100', description: 'Field of view, in degrees.' },
      { name: 'autoRotate', type: 'boolean | number', defaultValue: 'false', description: 'Turn slowly; a number is degrees per second.' },
      { name: 'height', type: 'number', defaultValue: '360', description: 'Viewer height in pixels.' },
    ],
  },

  magnifier: {
    description:
      'A loupe that follows the pointer over an image and shows the region under it enlarged — the same image as a background at the zoom factor, so a large source shows real detail. It stays inside the image, follows a finger while pressed, and moves with the arrow keys when focused.',
    sections: [
      { title: 'Example', description: 'Fine print on a circuit board. Hover, touch, or focus and use the arrows.', bare: true, Content: MagnifierExample },
      rationale(
        'Product and document images carry detail too small to read at page size, and opening a lightbox loses the context.',
        'A lens over the image keeps the whole picture in view while showing the detail, and it needs nothing but the image itself.',
        'Product photos, maps and plans, scanned documents, artwork, circuit and part diagrams.',
        ['img', 'CSS background'],
      ),
    ],
    props: [
      { name: 'src / alt', type: 'string', description: 'The image and its description.' },
      { name: 'zoom', type: 'number', defaultValue: '2.5', description: 'Magnification in the lens.' },
      { name: 'size', type: 'number', defaultValue: '160', description: 'Lens diameter or side, in pixels.' },
      { name: 'shape', type: "'circle' | 'square'", defaultValue: "'circle'", description: 'Lens shape.' },
      { name: 'aspectRatio', type: 'number', description: 'Reserves the image’s space before it loads.' },
    ],
  },

  'blur-hash-image': {
    description:
      'An image that shows a blurred impression of itself while it loads. The BlurHash string — about thirty characters of DCT coefficients in base 83 — is decoded here to a small canvas the browser scales up, and the real image fades in over it (or appears at once under reduced motion). encodeBlurHash is exported too, for making hashes from ImageData.',
    sections: [
      {
        title: 'Example',
        description: 'An image drawn in the page, encoded to a hash, then decoded back. Change the component count and load again.',
        bare: true,
        Content: BlurHashExample,
        note: motionNote('the real image replaces the placeholder without a fade.'),
      },
      rationale(
        'Grey boxes tell people nothing about what is loading, and images that arrive late make the page jump.',
        'A hash small enough to ship in the listing JSON gives the colours and layout instantly; the fixed aspect ratio stops the shift.',
        'Feeds, galleries, product grids, avatars and covers on slow connections, any image-heavy list.',
        ['canvas', 'img'],
      ),
    ],
    props: [
      { name: 'hash', type: 'string', description: 'The BlurHash string.' },
      { name: 'src / alt', type: 'string', description: 'The real image and its description.' },
      { name: 'width / height', type: 'number', description: 'Intrinsic size; sets the aspect ratio.' },
      { name: 'punch', type: 'number', defaultValue: '1', description: 'Placeholder contrast.' },
      { name: 'resolution', type: 'number', defaultValue: '32', description: 'Width the placeholder is decoded at.' },
      { name: 'onLoad', type: '() => void', description: 'When the real image has loaded.' },
      { name: 'encodeBlurHash / decodeBlurHash', type: 'functions', description: 'The encoder and decoder, exported.' },
    ],
  },
}
