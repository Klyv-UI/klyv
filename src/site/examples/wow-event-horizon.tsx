import { useRef, useState, type ReactNode } from 'react'
import {
  Badge,
  Button,
  EventHorizon,
  SegmentedControl,
  Slider,
  StatCard,
  Surface,
  Switch,
  Text,
  type EventHorizonHandle,
  type EventHorizonTone,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------------ stage */

/** An ordinary dashboard, for the hole to fall through. */
function Dashboard() {
  const [alerts, setAlerts] = useState(true)
  return (
    <>
      <StatCard title="Monthly revenue" value="$48,290" delta="12.4%" trend="up" caption="Against August" />
      <Surface variant="card" padding="md" className="gap-2">
        <Text as="h3" size="heading" className="text-[15px]">
          Deploys
        </Text>
        <Text size="caption" tone="soft">
          14 this week, none rolled back.
        </Text>
        <Button size="sm" className="self-start">
          Open the log
        </Button>
      </Surface>
      <Surface variant="card" padding="md" className="gap-3">
        <span className="flex items-center gap-2">
          <Text as="h3" size="heading" className="text-[15px]">
            Alerts
          </Text>
          <Badge>Live</Badge>
        </span>
        <label className="flex items-center justify-between gap-3">
          <Text as="span" size="label" weight="semibold">
            Page on burn rate
          </Text>
          <Switch checked={alerts} onChange={(event) => setAlerts(event.target.checked)} />
        </label>
      </Surface>
      <Surface variant="card" padding="md" className="gap-2">
        <Text as="h3" size="heading" className="text-[15px]">
          Seats
        </Text>
        <Text size="caption" tone="soft">
          39 of 60 licensed. Two invites pending.
        </Text>
      </Surface>
    </>
  )
}

const GRID = 'grid w-full grid-cols-2 gap-3 p-6 sm:grid-cols-4'

function EventHorizonHeroExample() {
  return (
    <div className="flex w-full flex-col gap-3">
      <EventHorizon
        className="min-h-[420px] rounded-[var(--radius-card)] border border-line bg-surface-sunken"
        bodies=".dashboard-card"
        label="A singularity falling through a dashboard"
      >
        <div className={`${GRID} dashboard`}>
          <div className="dashboard-card flex">
            <StatCard title="Monthly revenue" value="$48,290" delta="12.4%" trend="up" caption="Against August" className="w-full" />
          </div>
          <div className="dashboard-card col-span-2 flex sm:col-span-2">
            <Surface variant="card" padding="md" className="w-full gap-2">
              <Text as="h3" size="heading" className="text-[15px]">
                Deploys
              </Text>
              <Text size="caption" tone="soft">
                Fourteen this week, none rolled back. The button still works while it is being swallowed — try it on the way in.
              </Text>
              <Button size="sm" className="self-start">
                Open the log
              </Button>
            </Surface>
          </div>
          <div className="dashboard-card flex">
            <Surface variant="card" padding="md" className="w-full gap-2">
              <Text as="h3" size="heading" className="text-[15px]">
                Seats
              </Text>
              <Text size="caption" tone="soft">
                39 of 60 licensed.
              </Text>
            </Surface>
          </div>
        </div>
      </EventHorizon>
      <Text size="caption" tone="faint">
        Drag the hole anywhere over the dashboard. Each card is a real element — pulled in, stretched along the line to
        the hole, turned by its spin and gone at the horizon, then back exactly as it was. Focus the hole and the arrow
        keys steer it; Home puts it back in the middle.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------- playground */

function EventHorizonPlaygroundExample() {
  const hole = useRef<EventHorizonHandle>(null)
  const [horizon, setHorizon] = useState(76)
  const [reach, setReach] = useState(420)
  const [strength, setStrength] = useState(100)
  const [spin, setSpin] = useState(60)
  const [tone, setTone] = useState<EventHorizonTone>('ink')
  const [follow, setFollow] = useState(false)

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl<EventHorizonTone>
          label="Disc"
          size="sm"
          value={tone}
          onValueChange={setTone}
          options={[
            { value: 'ink', label: 'Ink' },
            { value: 'accent', label: 'Accent' },
          ]}
        />
        <label className="flex items-center gap-2">
          <Switch checked={follow} onChange={(event) => setFollow(event.target.checked)} />
          <Text as="span" size="label" weight="semibold">
            Follow the pointer
          </Text>
        </label>
        <Button size="sm" variant="outline" onClick={() => hole.current?.moveTo(60, 60)}>
          Send it to the corner
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Horizon" value={`${horizon} px`}>
          <Slider min={30} max={140} value={horizon} onChange={(event) => setHorizon(Number(event.target.value))} />
        </Field>
        <Field label="Reach" value={`${reach} px`}>
          <Slider min={200} max={700} value={reach} onChange={(event) => setReach(Number(event.target.value))} />
        </Field>
        <Field label="Strength" value={`${(strength / 100).toFixed(2)}×`}>
          <Slider min={20} max={200} value={strength} onChange={(event) => setStrength(Number(event.target.value))} />
        </Field>
        <Field label="Spin" value={`${spin}°`}>
          <Slider min={0} max={180} value={spin} onChange={(event) => setSpin(Number(event.target.value))} />
        </Field>
      </div>

      <EventHorizon
        ref={hole}
        className="min-h-[420px] rounded-[var(--radius-card)] border border-line bg-surface-sunken"
        bodies=":scope > div > div"
        horizon={horizon}
        reach={reach}
        strength={strength / 100}
        spin={spin}
        tone={tone}
        followPointer={follow}
        label="A singularity over a dashboard, with its field on show"
      >
        <div className={GRID}>
          <Dashboard />
        </div>
      </EventHorizon>
    </div>
  )
}

/** A labelled slider row, the shape this page repeats. */
function Field({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <Text as="span" size="label" weight="semibold">
          {label}
        </Text>
        <Text as="span" size="label" weight="bold" tabular>
          {value}
        </Text>
      </div>
      {children}
    </label>
  )
}

export const demos: ExampleModule = {
  'event-horizon': {
    description:
      'A black hole you drag across a working interface. Every element named by `bodies` is pulled toward it on an inverse-square law softened at the horizon, sheared along the line to it, turned by the hole’s spin, and faded out as it crosses — then it springs back exactly as it was. The warp is written to the individual `translate`, `rotate` and `scale` properties, so an element that already has a transform keeps it, and nothing is ever laid out again: the whole effect is a handful of property writes a frame.',
    sections: [
      {
        title: 'Drag it through a dashboard',
        description:
          'The cards are real components, not a picture of them. Press the switch or the button while they are being pulled in — they still work until the horizon takes them.',
        bare: true,
        Content: EventHorizonHeroExample,
        note: (
          <>
            The hole is one tab stop: arrows move it, Shift moves it further, Home returns it to the middle.{' '}
            {motionNote('the disc does not turn and the hole stays where it was put, with its warp already applied.')}
          </>
        ),
      },
      {
        title: 'Every dial on it',
        description:
          'Horizon is how big the point of no return is, reach is how far the pull is felt at all, strength scales the whole field, and spin is how far a body is turned as it falls.',
        bare: true,
        Content: EventHorizonPlaygroundExample,
      },
      rationale(
        'A product has to show that something is being consumed, collapsed or destroyed, and the usual answer is a spinner beside a sentence promising it.',
        'Gravity is a thing everyone has already seen: a shape pulled out of line, stretched toward a point and gone tells the story without a word of copy, and doing it to the real elements means nothing has to be mocked up twice.',
        'Empty and destructive states, archive and purge flows, a hero that eats its own marketing copy, and any moment a page wants one piece of theatre it can also explain.',
        ['ResizeObserver', 'requestAnimationFrame', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'The interface to warp. It stays interactive throughout.' },
      { name: 'bodies', type: 'string', defaultValue: "':scope > *'", description: 'Selector for the elements that fall. Everything else rides with its parent.' },
      { name: 'horizon', type: 'number', defaultValue: '76', description: 'Radius of the event horizon in pixels. Inside it a body is gone.' },
      { name: 'reach', type: 'number', defaultValue: '420', description: 'How far the pull is felt. Beyond it, elements are left entirely alone.' },
      { name: 'strength', type: 'number', defaultValue: '1', description: 'Scales the whole field.' },
      { name: 'spin', type: 'number', defaultValue: '60', description: 'Degrees a body is turned at full pull, as the disc drags it round.' },
      { name: 'origin', type: '[number, number]', defaultValue: '[0.5, 0.5]', description: 'Where the hole starts, as a fraction of the field.' },
      { name: 'followPointer', type: 'boolean', defaultValue: 'false', description: 'Follow the pointer over the field instead of waiting to be dragged.' },
      { name: 'tone', type: "'ink' | 'accent'", defaultValue: "'ink'", description: 'The accretion disc’s colour.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Stop the disc turning and hold everything where it is.' },
      { name: 'label', type: 'string', description: 'Accessible name for the hole, which is a figure in its own right.' },
      { name: 'ref', type: 'EventHorizonHandle', description: '`moveTo(x, y)` puts the hole somewhere; `release()` lets go of a drag.' },
    ],
  },
}
