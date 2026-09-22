import { useEffect, useMemo, useState } from 'react'
import {
  BpmDetector,
  Button,
  ChessBoard,
  Equalizer,
  Game2048,
  LogPatterns,
  LoudnessMeter,
  RecordMerge,
  SegmentedControl,
  Slider,
  Solitaire,
  SpacedRepetition,
  Text,
  WordGuess,
  spacedRepetitionCard,
  type EqualizerBand,
  type RecordMergeRecord,
  type RecordMergeResult,
  type SpacedRepetitionCard,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- LogPatterns */

/** Seeded, so the first screen is the same on every visit. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

function makeLogLine(random: () => number) {
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)]
  const int = (low: number, high: number) => low + Math.floor(random() * (high - low + 1))
  const ip = () => `10.${int(0, 3)}.${int(0, 255)}.${int(1, 254)}`
  const hex = (length: number) => Array.from({ length }, () => '0123456789abcdef'[int(0, 15)]).join('')
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
  const lines: [number, () => string][] = [
    [30, () => `INFO GET /api/v1/orders/${int(1000, 9999)} 200 ${int(8, 140)}ms`],
    [12, () => `INFO POST /api/v1/checkout 201 ${int(40, 380)}ms`],
    [14, () => `INFO Accepted connection from ${ip()}:${int(40000, 65000)}`],
    [10, () => `INFO User ${int(100, 9999)} signed in from ${ip()}`],
    [9, () => `DEBUG Cache miss for key session:${hex(12)}`],
    [8, () => `INFO Job ${uuid()} finished in ${int(200, 4000)} ms`],
    [5, () => `WARN Retrying request to payments-${int(1, 3)} (attempt ${int(1, 3)} of 3)`],
    [3, () => `WARN Disk usage at ${int(81, 97)}% on /dev/sda${int(1, 2)}`],
    [3, () => `ERROR Failed to connect to db-replica-${int(1, 4)}: timeout after 5000ms`],
    [6, () => `INFO Worker ${pick(['ingest', 'thumbnails', 'billing'])} heartbeat ok`],
  ]
  let roll = random() * lines.reduce((sum, [weight]) => sum + weight, 0)
  for (const [weight, make] of lines) {
    roll -= weight
    if (roll <= 0) return make()
  }
  return lines[0][1]()
}

function LogPatternsExample() {
  const [random] = useState(() => seeded(42))
  const [lines, setLines] = useState<string[]>(() => Array.from({ length: 400 }, () => makeLogLine(random)))
  const [live, setLive] = useState(true)
  const [similarity, setSimilarity] = useState(50)

  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => setLines((current) => [...current, ...Array.from({ length: 1 + Math.floor(random() * 6) }, () => makeLogLine(random))]), 600)
    return () => window.clearInterval(timer)
  }, [live, random])

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant={live ? 'outline' : 'accent'} aria-pressed={live} onClick={() => setLive(!live)}>
          {live ? 'Pause tail' : 'Resume tail'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLines((current) => [...current, ...Array.from({ length: 5000 }, () => makeLogLine(random))])}>
          Add 5,000 lines
        </Button>
        <label className="flex min-w-[220px] flex-1 items-center gap-3 text-[12px] font-semibold text-ink-soft">
          Similarity {similarity}%
          <Slider min={30} max={90} step={5} value={similarity} onChange={(event) => setSimilarity(Number(event.target.value))} className="max-w-[180px]" />
        </label>
      </div>
      <LogPatterns lines={lines} similarity={similarity / 100} label="api-gateway, last hour" />
    </div>
  )
}

/* ---------------------------------------------------------------- RecordMerge */

const CRM: RecordMergeRecord[] = [
  { id: 'C-1001', name: 'Robert Smith', email: 'bob.smith@gmail.com', phone: '(415) 555-0134', address: '12 Oak St Apt 4, San Francisco', company: 'Northwind', updatedAt: '2025-11-02' },
  { id: 'C-1002', name: 'Smith, Bob', email: 'bobsmith+crm@gmail.com', address: 'Apt 4, 12 Oak Street, San Francisco', updatedAt: '2026-03-18' },
  { id: 'C-1003', name: 'Rob Smyth', phone: '+1 415 555 0134', company: 'Northwind Traders', updatedAt: '2026-01-09' },
  { id: 'C-1004', name: 'Amélie Laurent', email: 'amelie@lumen.fr', phone: '+33 1 42 68 53 00', address: '8 Rue de Rivoli, Paris', company: 'Lumen', updatedAt: '2026-02-14' },
  { id: 'C-1005', name: 'Amelie Laurent', email: 'AMELIE@LUMEN.FR', address: '8 rue de Rivoli Paris', company: 'Lumen SAS', updatedAt: '2025-08-30' },
  { id: 'C-1006', name: 'Priya Natarajan', email: 'priya.n@acme.io', phone: '512-555-0199', address: '400 Congress Ave, Austin', company: 'Acme', updatedAt: '2026-04-01' },
  { id: 'C-1007', name: 'Priya Natrajan', email: 'pnatarajan@gmail.com', phone: '(512) 555-0199', updatedAt: '2025-12-12' },
  { id: 'C-1008', name: 'Daniel Okafor', email: 'dan@okafor.dev', phone: '646-555-0110', address: '77 Water St, New York', company: 'Okafor Studio', updatedAt: '2026-05-20' },
  { id: 'C-1009', name: 'Danielle Okafor', email: 'danielle.okafor@hey.com', phone: '646-555-0187', address: '77 Water Street, New York', updatedAt: '2026-05-21' },
  { id: 'C-1010', name: 'Kate Müller', email: 'kate@berlinworks.de', address: 'Torstraße 1, Berlin', company: 'Berlin Works', updatedAt: '2026-03-02' },
  { id: 'C-1011', name: 'Katherine Mueller', email: 'kate@berlinworks.de', phone: '+49 30 555 0100', company: 'Berlin Works GmbH', updatedAt: '2026-06-11' },
  { id: 'C-1012', name: 'Tom Becker', email: 'tom@becker.co', phone: '303-555-0121', address: '1600 Glenarm Pl, Denver', updatedAt: '2026-01-30' },
  { id: 'C-1013', name: 'Hana Sato', email: 'hana.sato@kumo.jp', phone: '+81 3 5555 0101', company: 'Kumo', updatedAt: '2025-10-10' },
  { id: 'C-1014', name: 'Luis Ortega', email: 'luis@ortega.mx', address: 'Av. Reforma 222, CDMX', company: 'Ortega y Asociados', updatedAt: '2026-02-02' },
]

function RecordMergeExample() {
  const [threshold, setThreshold] = useState<'0.75' | '0.8' | '0.9'>('0.8')
  const [results, setResults] = useState<RecordMergeResult[]>([])
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Match threshold"
        size="sm"
        value={threshold}
        onValueChange={setThreshold}
        options={[
          { value: '0.75', label: 'Loose 75%' },
          { value: '0.8', label: 'Default 80%' },
          { value: '0.9', label: 'Strict 90%' },
        ]}
      />
      <RecordMerge records={CRM} threshold={Number(threshold)} onMerge={(result) => setResults((list) => [...list, result])} />
      <div className="flex flex-col gap-1">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          Merge links written
        </Text>
        <Text size="label" tone="soft">
          {results.length ? results.flatMap((result) => result.links.map((link) => `${link.from} → ${link.to}`)).join(' · ') : 'None yet — merge a cluster above.'}
        </Text>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- SpacedRepetition */

const DAY = 86_400_000
const START = Date.UTC(2026, 8, 18, 9)

const DECK: SpacedRepetitionCard[] = [
  ['la manzana', 'the apple'],
  ['el perro', 'the dog'],
  ['la biblioteca', 'the library'],
  ['aprender', 'to learn'],
  ['el mercado', 'the market'],
  ['despacio', 'slowly'],
  ['la llave', 'the key'],
  ['olvidar', 'to forget'],
].map(([front, back], index) => spacedRepetitionCard(`es-${index}`, front, back))

// A few cards already have history, so the forecast and retention have something to show.
const SEEDED: SpacedRepetitionCard[] = [
  ...DECK,
  { ...spacedRepetitionCard('es-8', 'el viaje', 'the journey'), ease: 2.6, interval: 6, repetitions: 2, due: START + 2 * DAY, reviews: 3, passed: 3 },
  { ...spacedRepetitionCard('es-9', 'la ventana', 'the window'), ease: 2.36, interval: 15, repetitions: 3, due: START + 9 * DAY, reviews: 5, passed: 4, lapses: 1 },
  { ...spacedRepetitionCard('es-10', 'caminar', 'to walk'), ease: 2.5, interval: 1, repetitions: 1, due: START + DAY, reviews: 1, passed: 1 },
  { ...spacedRepetitionCard('es-11', 'la cuchara', 'the spoon'), ease: 2.2, interval: 6, repetitions: 2, due: START - DAY, reviews: 4, passed: 3, lapses: 1 },
]

function SpacedRepetitionExample() {
  const [cards, setCards] = useState(SEEDED)
  const [now, setNow] = useState(START)
  const [grading, setGrading] = useState<'buttons' | 'scale'>('buttons')
  const day = Math.round((now - START) / DAY)
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Grading"
          size="sm"
          value={grading}
          onValueChange={setGrading}
          options={[
            { value: 'buttons', label: 'Again · Hard · Good · Easy' },
            { value: 'scale', label: 'SM-2 0–5' },
          ]}
        />
        <Button size="sm" variant="outline" onClick={() => setNow(now + DAY)}>
          Advance one day
        </Button>
        <Text size="label" tone="soft">
          Demo clock: day {day + 1}
        </Text>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setCards(SEEDED)
            setNow(START)
          }}
        >
          Reset deck
        </Button>
      </div>
      <SpacedRepetition key={`${grading}-${day}`} cards={cards} onCardsChange={setCards} now={now} grading={grading} />
    </div>
  )
}

/* ---------------------------------------------------------------- Equalizer */

function EqualizerExample() {
  const [bands, setBands] = useState<EqualizerBand[] | undefined>(undefined)
  return (
    <div className="flex w-full flex-col gap-3">
      <Equalizer onBandsChange={setBands} />
      <Text size="caption" tone="faint" className="font-mono">
        {bands ? bands.map((band) => `${band.type} ${Math.round(band.frequency)}Hz ${band.gain > 0 ? '+' : ''}${band.gain}dB`).join(' · ') : 'onBandsChange reports every edit.'}
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- LoudnessMeter */

function LoudnessExample() {
  const [target, setTarget] = useState<'-14' | '-16' | '-23'>('-14')
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Delivery target"
        size="sm"
        value={target}
        onValueChange={setTarget}
        options={[
          { value: '-14', label: 'Streaming −14' },
          { value: '-16', label: 'Podcast −16' },
          { value: '-23', label: 'EBU R 128 −23' },
        ]}
      />
      <LoudnessMeter target={Number(target)} />
    </div>
  )
}

/* ---------------------------------------------------------------- ChessBoard */

const OPERA_GAME = `[Event "A night at the opera"]
[Site "Paris"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl and Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`

/* ---------------------------------------------------------------- 2048 */

function QuickGame() {
  const [wins, setWins] = useState(0)
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Game2048 size={3} target={64} storageKey={null} onWin={() => setWins(wins + 1)} />
      <Text size="caption" tone="faint">
        {wins ? `Reached 64 ${wins} ${wins === 1 ? 'time' : 'times'}.` : 'A 3×3 board to 64 shows the win screen in a minute or two.'}
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- WordGuess */

function WordGuessExample() {
  const [mode, setMode] = useState<'daily' | 'random'>('daily')
  const [hard, setHard] = useState(false)
  const [last, setLast] = useState('')
  const date = useMemo(() => new Date(), [])
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <SegmentedControl
        label="Word"
        size="sm"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: 'daily', label: 'Daily' },
          { value: 'random', label: 'Random' },
        ]}
      />
      <WordGuess
        key={mode}
        mode={mode}
        date={date}
        hardMode={hard}
        onHardModeChange={setHard}
        onComplete={(result) => setLast(`${result.won ? 'Won' : 'Lost'} in ${result.guesses.length}${result.hardMode ? ' on hard mode' : ''}.`)}
      />
      {last && (
        <Text size="caption" tone="faint">
          onComplete: {last}
        </Text>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- module */

export const demos: ExampleModule = {
  'log-patterns': {
    description:
      'Raw log lines grouped into the templates that printed them, using Drain — the fixed-depth parse tree most log platforms use. Numbers, IPs, hex and UUIDs are masked first; the tree routes each line by its token count and first tokens to a handful of candidate templates, and the line joins the most similar one if enough tokens agree, turning the ones that differ into wildcards. It is incremental: a live tail costs the same per line however long it runs. Open a template to see its variable slots with their most common values and the lines behind it.',
    sections: [
      { title: 'A live tail', description: 'New lines arrive every half second; add five thousand at once to see the chunked parser keep up. Lower the similarity and templates merge.', Content: LogPatternsExample },
      rationale(
        'A busy service prints thousands of lines a minute, and reading them does not scale — but most are a few dozen messages with different ids in them.',
        'Drain is the published, proven way to find those messages, and it is fast and incremental enough to run in the browser on a live stream.',
        'Log explorers, incident timelines, error inboxes and support tools that need “which message spiked?” rather than another scrolling list.',
        ['Input', 'Drain parse tree', 'Disclosure list'],
      ),
    ],
    props: [
      { name: 'lines', type: 'string[]', description: 'Raw lines. Appending is incremental; replacing starts over.' },
      { name: 'similarity', type: 'number', defaultValue: '0.5', description: 'Share of tokens that must agree for a line to join a template.' },
      { name: 'depth', type: 'number', defaultValue: '4', description: 'Tree depth including the root and length layers; 4 routes by the first two tokens.' },
      { name: 'maxChildren', type: 'number', defaultValue: '100', description: 'Branches per node before new tokens fall into the wildcard branch.' },
      { name: 'sampleLines', type: 'number', defaultValue: '40', description: 'Matching lines listed under an open template.' },
      { name: 'label', type: 'string', defaultValue: "'Log patterns'", description: 'Heading for the list.' },
      { name: 'onTemplateSelect', type: '(template | null) => void', description: 'Called when a template is opened or closed.' },
    ],
  },

  'record-merge': {
    description:
      'Duplicate detection and a review flow for merging records. Blocking keys — first initial plus surname Soundex, the normalised email, the last seven phone digits — decide which pairs are compared at all. Each field gets the comparison that suits it: Jaro–Winkler for names after nicknames and “Last, First” are normalised, exact match for normalised emails and phones, and a token-set ratio for addresses. The weighted score links pairs and union–find turns links into clusters. Each cluster shows why it matched; records can be left out, and each field’s surviving value follows a most-recent or most-complete rule until someone picks one by hand.',
    sections: [
      { title: 'Review a CRM export', description: 'Fourteen contacts with the usual mess: nicknames, reordered names, Gmail dots and plus-tags, accents and abbreviated streets.', Content: RecordMergeExample },
      rationale(
        'Duplicate contacts split history, double-send email and inflate counts, and a single fuzzy match on the name either misses most of them or merges strangers.',
        'Real record linkage — blocking, per-field similarity, weighted scoring, transitive clusters and survivorship rules — is what data teams use, and a review step keeps a person in charge of the merge.',
        'CRM and contact hygiene, customer-data imports, vendor lists, and any admin screen that deduplicates people or companies.',
        ['SegmentedControl', 'Badge', 'Button', 'Union–find'],
      ),
    ],
    props: [
      { name: 'records', type: 'RecordMergeRecord[]', description: '{ id, name, email?, phone?, address?, company?, updatedAt }.' },
      { name: 'threshold', type: 'number', defaultValue: '0.8', description: 'Weighted score at which two records are linked.' },
      { name: 'weights', type: 'Partial<{ name, email, phone, address }>', defaultValue: '{ 0.4, 0.25, 0.2, 0.15 }', description: 'Field weights. Only fields both records have are scored.' },
      { name: 'defaultRules', type: "Partial<Record<field, 'recent' | 'complete'>>", description: 'Survivorship rule per field before any hand-picked value.' },
      { name: 'onMerge', type: '({ record, mergedIds, links }) => void', description: 'Called with the surviving record and the merge links.' },
      { name: 'onReject', type: '(ids: string[]) => void', description: 'Called when a cluster is marked as not duplicates.' },
    ],
  },

  'spaced-repetition': {
    description:
      'Flashcards scheduled with SM-2, implemented exactly: intervals of 1 day, then 6, then the previous interval times the ease; the ease adjusted by the published formula and floored at 1.3; a failure resetting the run but not the ease; and any card answered below 4 repeated at the end of the session. Each grade button previews the interval it would set. The deck is controlled data the caller stores, and the clock is a prop, so a schedule can be tested — or demonstrated — without waiting.',
    sections: [
      { title: 'Study a deck', description: 'Grade a few cards, then advance the demo clock to watch them come due. Keys 1–4 grade once the answer is shown.', Content: SpacedRepetitionExample },
      rationale(
        'Reviewing everything every day wastes time on what is known and still forgets the rest; fixed schedules cannot tell the two apart.',
        'SM-2 is short, public and the base of most spaced-repetition tools, and implementing it exactly — with previews, stats and a forecast — makes the scheduling visible and testable.',
        'Onboarding and training, language and certification prep, and product education that should stick.',
        ['Button', 'SM-2 scheduler', 'Forecast bars'],
      ),
    ],
    props: [
      { name: 'cards', type: 'SpacedRepetitionCard[]', description: 'The deck, controlled. Use spacedRepetitionCard(id, front, back) to make new cards.' },
      { name: 'defaultCards', type: 'SpacedRepetitionCard[]', description: 'The deck, uncontrolled.' },
      { name: 'onCardsChange', type: '(cards) => void', description: 'Called with the whole deck after each review.' },
      { name: 'onReview', type: '(before, grade, after) => void', description: 'Called after each scheduled review.' },
      { name: 'now', type: 'number', defaultValue: 'Date.now()', description: 'The clock, in epoch ms. Inject it to test or demo schedules.' },
      { name: 'grading', type: "'buttons' | 'scale'", defaultValue: "'buttons'", description: 'Again/Hard/Good/Easy mapped to 1/3/4/5, or the raw 0–5 scale.' },
      { name: 'forecastDays', type: 'number', defaultValue: '14', description: 'Days in the review forecast.' },
    ],
  },

  equalizer: {
    description:
      'A parametric equaliser applied to real sound. Each band is a BiquadFilterNode — a low shelf, peaks and a high shelf — and the curve is each node’s own getFrequencyResponse, summed in decibels on a log frequency axis, so what is drawn is what is heard. The source is a groove synthesised in code, and its live spectrum sits behind the curve. Drag a handle to set frequency and gain; on the keyboard, arrows move it, Page Up and Page Down (or the wheel) set Q, and Home resets the gain. Presets and bypass are one click.',
    sections: [
      { title: 'Shape the loop', description: 'Press Play loop, then try Telephone and Bass boost with bypass on and off.', Content: EqualizerExample, note: motionNote('the spectrum behind the curve updates four times a second instead of every frame.') },
      rationale(
        'EQ controls that are a row of sliders hide what the filters do together, and curves drawn from hand-rolled formulas drift from what the audio engine actually applies.',
        'Asking the real filter nodes for their response keeps the picture honest, and direct manipulation of frequency, gain and Q is how audio people expect to work.',
        'Audio and video editors, podcast and streaming tools, voice-chat settings and music apps.',
        ['Button', 'Switch', 'Web Audio', 'Slider role'],
      ),
    ],
    props: [
      { name: 'bands', type: 'EqualizerBand[]', description: 'Controlled bands: { id, type, frequency, gain, q }.' },
      { name: 'defaultBands', type: 'EqualizerBand[]', description: 'Uncontrolled bands. Defaults to a low shelf, three peaks and a high shelf.' },
      { name: 'onBandsChange', type: '(bands) => void', description: 'Called on every edit.' },
      { name: 'presets', type: 'EqualizerPreset[]', description: 'Named band sets. Defaults to Flat, Bass boost, Vocal, Air and Telephone.' },
      { name: 'range', type: 'number', defaultValue: '18', description: 'Largest boost or cut on the graph, in dB.' },
      { name: 'height', type: 'number', defaultValue: '260', description: 'Graph height in pixels.' },
      { name: 'label', type: 'string', defaultValue: "'Equaliser curve'", description: 'Accessible name for the graph.' },
    ],
  },

  'loudness-meter': {
    description:
      'Loudness measured to ITU-R BS.1770-4: the two-stage K-weighting filter derived for the actual sample rate, mean-square power over 400 ms momentary and 3 s short-term windows, integrated loudness with the −70 LUFS absolute and −10 LU relative gates, a 4× oversampled true peak, and loudness range per EBU Tech 3342. The signal is measured up front in slices that never block the page, then playback reads the meters at the playhead and the history graph can be scrubbed. The reference tone — 1 kHz at −20 dBFS — reads −20 LUFS, as the standard says it must.',
    sections: [
      { title: 'Measure a mix', description: 'The test music has a quiet intro and a loud chorus, so the short-term line moves and the range is not zero. Measure a file of your own to compare.', Content: LoudnessExample, note: motionNote('the meters update four times a second during playback instead of every frame.') },
      rationale(
        'Peak meters say whether audio clips, not whether it is too loud — and every streaming service and broadcaster now normalises to integrated LUFS.',
        'Implementing the standard rather than an RMS approximation means the numbers match what a platform will measure, gating and true peak included.',
        'Podcast and video upload flows, mastering and QC tools, and any product that must hit a delivery spec.',
        ['SegmentedControl', 'Button', 'BS.1770-4', 'Slider role'],
      ),
    ],
    props: [
      { name: 'defaultSignal', type: "'music' | 'tone'", defaultValue: "'music'", description: 'The generated signal measured first.' },
      { name: 'target', type: 'number', defaultValue: '-14', description: 'Integrated target in LUFS, marked on the meters and graph.' },
      { name: 'peakLimit', type: 'number', defaultValue: '-1', description: 'Highest acceptable true peak in dBTP.' },
      { name: 'allowFiles', type: 'boolean', defaultValue: 'true', description: 'Offer measuring a local file, decoded with decodeAudioData.' },
      { name: 'onAnalysis', type: '(analysis) => void', description: 'Integrated, range, true peak and the momentary and short-term series.' },
    ],
  },

  'bpm-detector': {
    description:
      'Offline tempo detection that shows its working. The audio — a drum loop generated in code, or a decoded file — is rendered through an OfflineAudioContext to one band-limited channel; a short-time Fourier transform turns it into a spectral-flux onset envelope; and autocorrelating that envelope finds the beat period in 60–200 BPM, with a tempo prior and an octave check settling the usual doubling and halving mistakes. A grid fit sets the tempo to a tenth and places the beats, drawn on the waveform. Playback can click along, and Tap checks the answer against your own sense of the beat.',
    sections: [
      { title: 'Detect, then verify', description: 'Each loop is synthesised at its tempo; the detector is never told which. Play with clicks on to hear the beat grid.', Content: () => <BpmDetector />, note: motionNote('the playhead moves four times a second instead of every frame.') },
      rationale(
        'Tempo matters for syncing, editing and matching tracks, and most “BPM detectors” are a tap button or a peak counter that fails on anything but four-on-the-floor.',
        'Spectral flux plus autocorrelation is the standard onset-based method, and drawing the beats on the waveform with a click track makes a wrong answer obvious.',
        'DJ and music tools, video editors that cut to the beat, fitness and dance apps, and audio upload pipelines.',
        ['SegmentedControl', 'Button', 'Switch', 'STFT'],
      ),
    ],
    props: [
      { name: 'loopTempos', type: 'number[]', defaultValue: '[92, 124, 174]', description: 'Tempos offered for the generated drum loop.' },
      { name: 'minBpm', type: 'number', defaultValue: '60', description: 'Slowest tempo considered.' },
      { name: 'maxBpm', type: 'number', defaultValue: '200', description: 'Fastest tempo considered.' },
      { name: 'allowFiles', type: 'boolean', defaultValue: 'true', description: 'Offer analysing a local file.' },
      { name: 'onDetect', type: '({ bpm, confidence, beats }) => void', description: 'Called when an analysis finishes.' },
    ],
  },

  'chess-board': {
    description:
      'A chessboard with every rule: legal moves generated with pins and checks respected, castling rights, en passant, promotion with a choice of piece, and checkmate, stalemate, threefold repetition, the fifty-move rule and insufficient material. Moves are recorded in SAN and can be stepped through; moving from an earlier position starts a new line. Positions load and save as FEN, games import and export as PGN. Drag, click, or use the keyboard — arrows move between squares and Enter picks up and puts down — and every move is announced in words.',
    sections: [
      { title: 'Play', Content: () => <ChessBoard /> },
      { title: 'Loaded from PGN', description: 'Morphy’s Opera Game, imported from PGN. Step back through it with the move list.', Content: () => <ChessBoard defaultPgn={OPERA_GAME} tools={false} label="The Opera Game" /> },
      rationale(
        'Chess boards on the web tend to be pictures with drag-and-drop and no rules, or engines with no accessible board at all.',
        'Full legal-move generation — checked against published perft counts — plus notation, FEN and PGN makes it a real board, and the grid model makes it playable without a mouse or without sight.',
        'Puzzle and training features, community and chat games, and as a reference for a complex, stateful ARIA grid.',
        ['Button', 'IconButton', 'Input', 'Textarea', 'ARIA grid'],
      ),
    ],
    props: [
      { name: 'defaultFen', type: 'string', description: 'Starting position. Defaults to the standard one.' },
      { name: 'defaultPgn', type: 'string', description: 'A game to load instead; wins over defaultFen.' },
      { name: 'defaultOrientation', type: "'w' | 'b'", defaultValue: "'w'", description: 'Which side sits at the bottom.' },
      { name: 'tools', type: 'boolean', defaultValue: 'true', description: 'Show the FEN and PGN tools.' },
      { name: 'label', type: 'string', defaultValue: "'Chess board'", description: 'Accessible name for the board.' },
      { name: 'onMove', type: '(move, fen) => void', description: 'Called after every move with its SAN and the new FEN.' },
      { name: 'onGameEnd', type: '({ outcome, winner }) => void', description: 'Called when a move ends the game.' },
    ],
  },

  'game-2048': {
    description:
      '2048 with tiles that keep their identity from move to move, so slides and merges animate as movement rather than redrawn numbers. A tile merges once per move, spawns are 2 or, one time in ten, 4; reaching the target offers to keep going, and the game ends when no slide or merge is left. Undo keeps twenty moves, and the best score is saved. Arrow keys or W A S D move, swipes work on touch, and each move is announced with what merged and the new score.',
    sections: [
      { title: 'Classic', Content: () => <Game2048 />, note: motionNote('tiles jump to their new places and appear without the pop.') },
      { title: 'A quick board', Content: QuickGame },
      rationale(
        'Most 2048 clones redraw a grid of numbers, so nothing actually slides, and they only work with arrow keys.',
        'Tracking each tile makes the motion real and cheap, and the full rules plus undo, keyboard, swipe and announcements make it a complete small game.',
        'Break screens, onboarding games, 404 pages and as a worked example of animated list identity.',
        ['Button', 'IconButton', 'Web Animations'],
      ),
    ],
    props: [
      { name: 'size', type: 'number', defaultValue: '4', description: 'Cells per side.' },
      { name: 'target', type: 'number', defaultValue: '2048', description: 'The tile that wins.' },
      { name: 'storageKey', type: 'string | null', defaultValue: "'klyv-2048-best'", description: 'localStorage key for the best score; null keeps it in memory.' },
      { name: 'onWin', type: '(score) => void', description: 'Called once per game when the target first appears.' },
      { name: 'onGameOver', type: '(score) => void', description: 'Called when no move is left.' },
    ],
  },

  'word-guess': {
    description:
      'A five-letter word game with the scoring done properly: greens are taken first, and yellows are handed out only from the letters left over, so a repeated letter is never promised twice. Hard mode checks every guess against what has been revealed. The daily word comes from the date, so everyone playing on a day gets the same one, or play random words. The keyboard shows each letter’s best state, guesses are checked against a word list, results are read out letter by letter, and the finished grid can be shared as emoji squares.',
    sections: [
      { title: 'Play', description: 'Click the board and type, or use the on-screen keys.', Content: WordGuessExample, note: motionNote('tiles appear already turned, and a rejected guess does not shake.') },
      rationale(
        'Word-game clones regularly get duplicate letters wrong, which makes them unfair in exactly the cases players remember.',
        'Two-pass scoring, real hard-mode rules and a spoken result for every guess make it correct and playable without seeing the colours.',
        'Engagement features, daily streaks, newsletters and communities, and as an example of a game that is fully keyboard- and screen-reader-operable.',
        ['Button', 'Switch', 'Two-pass scoring'],
      ),
    ],
    props: [
      { name: 'mode', type: "'daily' | 'random'", defaultValue: "'daily'", description: 'Daily picks by date; random picks a new word per game.' },
      { name: 'date', type: 'Date', description: 'The date that picks the daily word.' },
      { name: 'answer', type: 'string', description: 'A fixed answer, for tests and demos.' },
      { name: 'words', type: 'string[]', description: 'Possible answers. Defaults to a built-in list.' },
      { name: 'validGuesses', type: 'string[]', description: 'Extra accepted guesses that are never answers.' },
      { name: 'hardMode', type: 'boolean', description: 'Controlled hard mode. Pair with onHardModeChange; defaultHardMode for uncontrolled.' },
      { name: 'maxGuesses', type: 'number', defaultValue: '6', description: 'Attempts allowed.' },
      { name: 'onComplete', type: '({ won, answer, guesses, hardMode }) => void', description: 'Called once when the game ends.' },
    ],
  },

  solitaire: {
    description:
      'Klondike, dealt from a seedable shuffle: draw one or three from the stock, recycle the waste, build down in alternating colours with kings to empty columns, and up by suit on the foundations. Double-click, or press F, to send a card home; once every card is face up, Finish plays the rest out. Undo, moves, standard scoring and a timer. Drag cards, or use the keyboard — arrows move between piles, Enter picks up (again for more of the run) and puts down — with every pile and card named in full.',
    sections: [
      { title: 'Play', Content: () => <Solitaire />, note: motionNote('Finish completes the foundations at once instead of card by card.') },
      rationale(
        'Solitaire is the classic small game people expect to be able to play, and web versions are almost always mouse-only.',
        'One rules check shared by drag, click and keyboard, plus undo as a stack of tables, makes it correct and fully operable without a pointer.',
        'Break screens, waiting rooms and offline pages, and as a pattern for drag-and-drop with a complete keyboard alternative.',
        ['SegmentedControl', 'Button', 'CSS cards'],
      ),
    ],
    props: [
      { name: 'defaultDraw', type: '1 | 3', defaultValue: '1', description: 'Cards turned from the stock at a time, for the first game.' },
      { name: 'seed', type: 'number', description: 'Seed the shuffle to replay a deal.' },
      { name: 'onWin', type: '({ moves, score, seconds }) => void', description: 'Called when all four foundations are complete.' },
    ],
  },
}
