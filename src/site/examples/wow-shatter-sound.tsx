import { useRef, useState } from 'react'
import {
  Button,
  ChladniPlate,
  Field,
  Input,
  SegmentedControl,
  ShatterDismiss,
  Slider,
  Surface,
  Switch,
  Text,
  Textarea,
  ToastProvider,
  useToast,
  type ChladniPlateShape,
  type ChladniPlateTone,
  type ShatterDismissHandle,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------ shatter: data */

const NOTIFICATIONS = [
  { id: 'deploy', who: 'Deploy bot', what: 'Production deploy #4182 finished in 3m 12s.', when: '2m', hue: 'bg-accent text-accent-ink' },
  { id: 'review', who: 'Mara Lindqvist', what: 'Requested your review on “Move billing to the new ledger”.', when: '14m', hue: 'bg-ink text-ink-inverse' },
  { id: 'invoice', who: 'Billing', what: 'Invoice INV-2291 for €1,240.00 was paid by Northwind.', when: '1h', hue: 'bg-surface-muted text-ink' },
]

/** A generated landscape, so the demo needs no network. */
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2b64"/><stop offset=".55" stop-color="#f8745a"/><stop offset="1" stop-color="#fbd786"/></linearGradient>
<radialGradient id="u" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d5"/><stop offset=".6" stop-color="#ffd37a" stop-opacity=".9"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f28b6b"/><stop offset="1" stop-color="#27325e"/></linearGradient>
</defs>
<rect width="640" height="400" fill="url(#s)"/>
<circle cx="420" cy="215" r="120" fill="url(#u)"/>
<path d="M0 250 L90 170 L160 225 L250 130 L340 220 L420 175 L520 240 L640 160 V400 H0Z" fill="#5a3f6e" opacity=".85"/>
<path d="M0 290 L120 215 L210 270 L300 205 L400 280 L500 230 L640 285 V400 H0Z" fill="#35294d"/>
<rect y="300" width="640" height="100" fill="url(#w)"/>
<path d="M300 300h240M340 318h150M380 334h90M260 352h120" stroke="#ffe2a8" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
<path d="M0 300 L70 262 L130 300Z M520 300 L590 250 L640 300Z" fill="#1f1733"/>
</svg>`)}`

/* ------------------------------------------------------- shatter: specimens */

function NotificationStack() {
  const { toast } = useToast()
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  const headingRef = useRef<HTMLHeadingElement>(null)
  const count = NOTIFICATIONS.filter((item) => !dismissed[item.id]).length

  const set = (id: string, value: boolean) => setDismissed((current) => ({ ...current, [id]: value }))

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <h3 ref={headingRef} tabIndex={-1} className="text-[13px] font-bold text-ink outline-none">
        Inbox · {count} unread
      </h3>
      {NOTIFICATIONS.map((item) => (
        <ShatterDismiss
          key={item.id}
          shattered={!!dismissed[item.id]}
          collapse
          shards={30}
          closeLabel={`Dismiss notification from ${item.who}`}
          focusTarget={headingRef}
          onShatteredChange={(value) => {
            set(item.id, value)
            if (value) {
              toast({
                title: 'Notification dismissed',
                description: item.who,
                duration: 6000,
                action: { label: 'Undo', onSelect: () => set(item.id, false) },
              })
            }
          }}
        >
          <Surface variant="card" padding="md" className="flex-row items-start gap-3 pr-11">
            <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-bold ${item.hue}`}>
              {item.who[0]}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Text size="label" weight="semibold">
                {item.who} <span className="font-medium text-ink-faint">· {item.when}</span>
              </Text>
              <Text size="caption" tone="soft" leading="normal">
                {item.what}
              </Text>
            </div>
          </Surface>
        </ShatterDismiss>
      ))}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => setDismissed({})} disabled={count === NOTIFICATIONS.length}>
          Restore all
        </Button>
        <Text size="caption" tone="faint">
          Dismiss one, then press Undo on the toast.
        </Text>
      </div>
    </div>
  )
}

function NotificationsHero() {
  return (
    <ToastProvider placement="bottom-center">
      <NotificationStack />
    </ToastProvider>
  )
}

function PhotoExample() {
  const shatter = useRef<ShatterDismissHandle>(null)
  const [broken, setBroken] = useState(false)
  const [shards, setShards] = useState(34)
  const [force, setForce] = useState(1)
  const [gravity, setGravity] = useState(1)
  const [edges, setEdges] = useState(true)
  const [floor, setFloor] = useState(true)
  const stage = useRef<HTMLDivElement>(null)

  return (
    <div className="flex w-full flex-col gap-4">
      <div ref={stage} className="relative w-full max-w-[520px] pb-10">
        <ShatterDismiss
          ref={shatter}
          closeButton={false}
          shards={shards}
          force={force}
          gravity={gravity}
          edges={edges}
          floor={floor ? 36 : false}
          onShatteredChange={setBroken}
          focusTarget={() => stage.current?.querySelector<HTMLElement>('[data-put-back]')}
          announcement="Photo shattered. Put it back is available."
        >
          <button
            type="button"
            aria-label="Shatter the photo"
            className="block w-full overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-card)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app"
            onClick={(event) => shatter.current?.shatter(event.detail === 0 ? undefined : { x: event.clientX, y: event.clientY })}
          >
            <img src={PHOTO} alt="" className="block aspect-[16/10] w-full select-none object-cover" draggable={false} />
          </button>
        </ShatterDismiss>
        {broken ? (
          <div className="absolute inset-x-0 top-1/3 flex justify-center">
            <Button size="sm" variant="white" data-put-back="" onClick={() => shatter.current?.restore()}>
              Put it back
            </Button>
          </div>
        ) : null}
      </div>
      <div className="grid max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ink-soft">
          Shards · {shards}
          <Slider min={8} max={90} value={shards} onChange={(event) => setShards(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ink-soft">
          Force · {force.toFixed(1)}
          <Slider min={3} max={20} value={force * 10} onChange={(event) => setForce(Number(event.target.value) / 10)} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ink-soft">
          Gravity · {gravity.toFixed(1)}
          <Slider min={2} max={20} value={gravity * 10} onChange={(event) => setGravity(Number(event.target.value) / 10)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={edges} onChange={(event) => setEdges(event.target.checked)} />
          Glass edges
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={floor} onChange={(event) => setFloor(event.target.checked)} />
          Land on a floor
        </label>
      </div>
    </div>
  )
}

function FormExample() {
  const shatter = useRef<ShatterDismissHandle>(null)
  const undoRef = useRef<HTMLDivElement>(null)
  const [gone, setGone] = useState(false)

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <ShatterDismiss
        ref={shatter}
        closeButton={false}
        shards={44}
        force={0.8}
        floor={24}
        focusTarget={() => undoRef.current?.querySelector('button')}
        onShatteredChange={setGone}
        announcement="Draft discarded. Undo available."
      >
        <Surface variant="card" padding="lg" className="gap-4">
          <Text size="heading" weight="bold">
            New support ticket
          </Text>
          <Field label="Subject">
            <Input defaultValue="Webhooks retrying after a 200" />
          </Field>
          <Field label="Details" hint="The fields keep what you typed — undo brings it all back.">
            <Textarea rows={3} defaultValue="Since Tuesday every delivery to /hooks/stripe is retried three times even though we answer 200 within 80 ms." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={(event) => shatter.current?.shatter({ x: event.clientX, y: event.clientY })}>
              Discard draft
            </Button>
            <Button size="sm">Send</Button>
          </div>
        </Surface>
      </ShatterDismiss>
      <div ref={undoRef} className="flex items-center gap-3">
        <Button size="sm" variant={gone ? 'accent' : 'ghost'} disabled={!gone} onClick={() => shatter.current?.restore()}>
          Undo discard
        </Button>
        <Text size="caption" tone="faint">
          Focus lands here when the form breaks, so the keyboard is never stranded.
        </Text>
      </div>
    </div>
  )
}

/* ------------------------------------------------------- chladni: specimens */

function ChladniHero() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <ChladniPlate grains={14000} size={480} label="Square Chladni plate" />
      <Text size="caption" tone="faint" className="max-w-[60ch] text-center">
        Move the frequency and the sand leaps off the old figure and finds the new one. Drag along the rim to bow the
        plate. Sound stays off until you press the speaker.
      </Text>
    </div>
  )
}

function ChladniPlayground() {
  const [shape, setShape] = useState<ChladniPlateShape>('circle')
  const [tone, setTone] = useState<ChladniPlateTone>('accent')
  const [grains, setGrains] = useState(10000)
  const [intensity, setIntensity] = useState(1)

  return (
    <div className="flex w-full flex-col gap-5 md:flex-row md:items-start">
      <ChladniPlate key={`${shape}-${grains}`} shape={shape} tone={tone} grains={grains} intensity={intensity} size={420} label={`${shape === 'circle' ? 'Circular' : 'Square'} Chladni plate`} />
      <div className="flex min-w-[220px] flex-col gap-4">
        <SegmentedControl
          label="Plate"
          size="sm"
          value={shape}
          onValueChange={(value) => setShape(value as ChladniPlateShape)}
          options={[
            { value: 'circle', label: 'Circle' },
            { value: 'square', label: 'Square' },
          ]}
        />
        <SegmentedControl
          label="Sand"
          size="sm"
          value={tone}
          onValueChange={(value) => setTone(value as ChladniPlateTone)}
          options={[
            { value: 'accent', label: 'Accent' },
            { value: 'ink', label: 'Ink' },
          ]}
        />
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ink-soft">
          Grains · {grains.toLocaleString('en')}
          <Slider min={5} max={20} value={grains / 1000} onChange={(event) => setGrains(Number(event.target.value) * 1000)} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ink-soft">
          Hop · {intensity.toFixed(1)}×
          <Slider min={4} max={25} value={intensity * 10} onChange={(event) => setIntensity(Number(event.target.value) / 10)} />
        </label>
      </div>
    </div>
  )
}

const GALLERY: { frequency: number; shape: ChladniPlateShape; caption: string }[] = [
  { frequency: 12 * 13, shape: 'square', caption: '(3, 2) · 156 Hz' },
  { frequency: 12 * 41, shape: 'square', caption: '(5, 4) · 492 Hz' },
  { frequency: 12 * 89, shape: 'square', caption: '(8, 5) · 1068 Hz' },
  { frequency: 890, shape: 'circle', caption: 'circle · 890 Hz' },
]

function ChladniGallery() {
  return (
    <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-4">
      {GALLERY.map((item) => (
        <figure key={item.caption} className="flex flex-col items-center gap-2">
          <ChladniPlate controls={false} shape={item.shape} defaultFrequency={item.frequency} grains={6000} size={220} label={`Chladni figure ${item.caption}`} />
          <figcaption className="font-mono text-[12px] text-ink-faint">{item.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'shatter-dismiss': {
    description:
      'Dismisses content by breaking the live element like a pane of glass, and flies the pieces back together on undo. Each shard is a clone of the element clipped to a Voronoi cell, and the seeds crowd the impact point — fine splinters where it was struck, broad panes at the far edge. The flight is simulated and recorded before the first frame, so undo replays the same frames backwards.',
    sections: [
      {
        title: 'Notifications with an undo toast',
        description: 'The close button breaks the card from where it was pressed, the gap closes, and Undo on the toast reverses it.',
        bare: true,
        Content: NotificationsHero,
        note: motionNote('the card fades and shrinks away instead of breaking; undo fades it back.'),
      },
      {
        title: 'A photo, broken where you click',
        description: 'The impact point is the pointer. Tune the shard count, the blast and gravity, and give the pieces a floor to bounce on.',
        bare: true,
        Content: PhotoExample,
      },
      {
        title: 'A whole form',
        description: 'The shards are clones of the live element, so typed values break with it — and survive, because the real form never unmounts.',
        bare: true,
        Content: FormExample,
      },
      rationale(
        'A dismissal that just vanishes gives no sense of where the thing went or that it can come back, and a generic fade looks the same for “archived” and “deleted forever”.',
        'Breaking the actual element, not a picture of it, costs no screenshot library and keeps it pixel-exact; recording the flight makes undo a literal rewind rather than a second animation to keep in sync.',
        'Notification centres, discard-draft flows, clearing a canvas, deleting a card with undo, a playful empty-trash.',
        ['IconButton', 'Voronoi fracture', 'rigid-body simulation', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The content that breaks. It stays mounted while dismissed.' },
      { name: 'shattered / defaultShattered', type: 'boolean', defaultValue: '— / false', description: 'Controlled or uncontrolled dismissed state; going back to false plays the undo.' },
      { name: 'onShatteredChange', type: '(shattered: boolean) => void', description: 'The close button, shatter() or restore() asked for a change.' },
      { name: 'onShattered / onRestored', type: '() => void', description: 'The last shard has faded; the real element is back.' },
      { name: 'ref', type: 'ShatterDismissHandle', description: 'shatter(point?) with client coordinates, and restore().' },
      { name: 'shards', type: 'number', defaultValue: '28', description: 'Roughly how many pieces.' },
      { name: 'force / gravity', type: 'number / number', defaultValue: '1 / 1', description: 'Multipliers on the blast and on the fall.' },
      { name: 'floor', type: 'number | false', defaultValue: 'false', description: 'Pixels below the element where pieces bounce, with friction.' },
      { name: 'edges', type: 'boolean', defaultValue: 'true', description: 'Hairline glass highlights on each shard.' },
      { name: 'collapse', type: 'boolean', defaultValue: 'false', description: 'Close the gap it leaves; reopen it before an undo.' },
      { name: 'closeButton / closeLabel', type: 'boolean / string', defaultValue: 'true / Dismiss', description: 'The built-in close affordance and its accessible name.' },
      { name: 'focusTarget', type: 'RefObject<HTMLElement> | () => HTMLElement', description: 'Where focus goes if the element held it when dismissed.' },
      { name: 'announcement', type: 'string', defaultValue: 'Dismissed. Undo available.', description: 'Announced politely on dismissal.' },
    ],
  },

  'chladni-plate': {
    description:
      'Sand on a vibrating plate that gathers into its Chladni figure. Nothing draws the figure: each grain hops a random distance proportional to how hard the plate moves beneath it, so sand is thrown off the antinodes and comes to rest on the nodal lines. Change the frequency and the old figure scatters and the new one forms on its own.',
    sections: [
      {
        title: 'A square plate',
        description: 'The frequency snaps to the nearest eigenmode, cos(nπx)cos(mπy) − cos(mπx)cos(nπy), ordered by n² + m².',
        bare: true,
        Content: ChladniHero,
        note: motionNote('the settled figure for the chosen mode is drawn at once, and redrawn when the mode changes.'),
      },
      {
        title: 'Circle or square, ink or accent',
        description: 'The circular plate uses Bessel modes J_n(αr)·cos(nθ): nodal diameters and rings.',
        bare: true,
        Content: ChladniPlayground,
      },
      {
        title: 'A gallery of modes',
        description: 'Four plates without controls. Each parks its loop off screen and once the sand is still.',
        bare: true,
        Content: ChladniGallery,
      },
      rationale(
        'Most “sound visualisers” are bars bouncing to a spectrum, which says nothing about sound. A Chladni plate shows the physics itself — standing waves you can see.',
        'Simulating the mechanism instead of drawing the curve means the transition between figures is real: sand leaves lines that start moving and finds ones that stopped.',
        'A music or physics lesson, an audio product hero, a science museum kiosk, a calm idle screen.',
        ['Slider', 'Button', 'IconButton', 'canvas', 'Web Audio'],
      ),
    ],
    props: [
      { name: 'shape', type: "'square' | 'circle'", defaultValue: 'square', description: 'Cos·cos modes, or Bessel modes on a disc.' },
      { name: 'frequency / defaultFrequency', type: 'number', description: 'Drive frequency in hertz, controlled or uncontrolled.' },
      { name: 'onFrequencyChange', type: '(hz: number) => void', description: 'From the slider, the mode buttons, or bowing.' },
      { name: 'playing / defaultPlaying', type: 'boolean', defaultValue: '— / true', description: 'Whether the plate is driven.' },
      { name: 'defaultMuted / defaultVolume', type: 'boolean / number', defaultValue: 'true / 0.4', description: 'Sound only starts from a press on the sound button.' },
      { name: 'grains', type: 'number', defaultValue: '12000', description: 'How much sand.' },
      { name: 'tone', type: "'ink' | 'accent'", defaultValue: 'ink', description: 'Grain colour, read from the theme at runtime.' },
      { name: 'intensity', type: 'number', defaultValue: '1', description: 'How far grains hop.' },
      { name: 'size', type: 'number', defaultValue: '460', description: 'Maximum width in pixels.' },
      { name: 'controls', type: 'boolean', defaultValue: 'true', description: 'Transport, frequency and sound controls.' },
    ],
  },
}
