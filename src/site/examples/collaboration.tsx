import { useEffect, useState } from 'react'
import {
  Button,
  PresenceBar,
  PresenceCursors,
  Surface,
  Text,
  TypingIndicator,
  type Participant,
  type RemoteCursor,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const PEOPLE: Participant[] = [
  { id: 'a-you', name: 'Vaibhav Zapadiya', you: true, status: 'active' },
  { id: 'b-sarah', name: 'Sarah Rosewood', status: 'active' },
  { id: 'c-max', name: 'Max Oduya', status: 'idle' },
  { id: 'd-lena', name: 'Lena Fischer', status: 'active' },
  { id: 'e-tom', name: 'Tom Bright', status: 'away' },
  { id: 'f-ada', name: 'Ada Winters', status: 'active' },
  { id: 'g-noor', name: 'Noor Haddad', status: 'idle' },
]

const SEEDS = [
  { id: 'b-sarah', name: 'Sarah', color: '#7fd4ff', status: 'editing the total' },
  { id: 'd-lena', name: 'Lena', color: 'var(--color-accent-strong)' },
  { id: 'f-ada', name: 'Ada', color: '#f5a524', status: 'reading' },
]

/* ----------------------------------------------------------- specimens */

/** Stands in for a websocket: a few positions a second, unevenly. */
function useFakeFeed(active: boolean) {
  const [cursors, setCursors] = useState<RemoteCursor[]>(
    SEEDS.map((seed, index) => ({ ...seed, x: 0.2 + index * 0.25, y: 0.35 })),
  )

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => {
      setCursors((current) =>
        current.map((cursor) => ({
          ...cursor,
          x: Math.min(0.88, Math.max(0.04, cursor.x + (Math.random() - 0.5) * 0.16)),
          y: Math.min(0.8, Math.max(0.06, cursor.y + (Math.random() - 0.5) * 0.16)),
        })),
      )
    }, 700)
    return () => window.clearInterval(timer)
  }, [active])

  return cursors
}

function CursorsExample() {
  const [live, setLive] = useState(true)
  const cursors = useFakeFeed(live)

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="relative h-[260px] w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-app">
        <div className="grid h-full place-items-center p-6 text-center">
          <div className="flex flex-col gap-2">
            <Text size="subtitle">September report — shared draft</Text>
            <Text size="caption" tone="soft" leading="normal" className="max-w-[46ch]">
              Positions arrive roughly every 700ms, unevenly. The gliding between them is one CSS
              transition per cursor, not a frame loop.
            </Text>
          </div>
        </div>
        <PresenceCursors cursors={cursors} label="People editing this document" smoothing={760} />
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setLive((value) => !value)}>
          {live ? 'Freeze the feed' : 'Resume the feed'}
        </Button>
        <Text size="caption" tone="faint">
          Frozen, they hold position — the component never animates on its own.
        </Text>
      </div>
    </div>
  )
}

function PresenceExample() {
  const [here, setHere] = useState<Participant[]>(PEOPLE.slice(0, 4))

  const join = () => {
    const next = PEOPLE.find((person) => !here.some((entry) => entry.id === person.id))
    if (next) setHere([...here, next])
  }

  const leave = () => {
    if (here.length > 1) setHere(here.slice(0, -1))
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg" className="flex-row items-center justify-between gap-4">
        <Text size="heading">September report</Text>
        <PresenceBar participants={here} label="People in this document" max={4} />
      </Surface>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={join} disabled={here.length >= PEOPLE.length}>
          Someone joins
        </Button>
        <Button size="sm" variant="ghost" onClick={leave} disabled={here.length <= 1}>
          Someone leaves
        </Button>
        <Text size="caption" tone="faint">
          Each change is announced politely as well as drawn.
        </Text>
      </div>
    </div>
  )
}

function TypingExample() {
  const [count, setCount] = useState(1)
  const names = ['Sarah', 'Max', 'Lena', 'Ada', 'Noor'].slice(0, count)

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Surface variant="card" padding="lg" className="w-full max-w-[440px] items-start gap-3">
        <Text size="body" tone="soft">
          Latest: “Cashback covered two subscriptions outright.”
        </Text>
        <div className="min-h-[32px]">
          <TypingIndicator names={names} />
        </div>
      </Surface>

      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2, 3, 5].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={count === value ? 'accent' : 'outline'}
            onClick={() => setCount(value)}
          >
            {value === 0 ? 'Nobody' : `${value} typing`}
          </Button>
        ))}
      </div>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        At zero it renders nothing at all rather than an empty row — an indicator that leaves a gap
        behind makes the message list jump every time someone pauses.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'presence-cursors': {
    description:
      'Other people’s pointers, drawn over a shared surface. Positions arrive at whatever rate the network manages, so each cursor carries a CSS transition slightly longer than the gap between updates and glides from the last position to the next.',
    sections: [
      {
        title: 'Example',
        description: 'A stand-in feed reports about one and a half positions a second, unevenly.',
        bare: true,
        Content: CursorsExample,
        note: motionNote('the glide is dropped and cursors step straight to each reported position.'),
      },
      rationale(
        'Remote cursors rendered at each reported position teleport, because no realistic feed is fast or even enough to look continuous.',
        'Handing the interpolation to a CSS transition costs nothing per frame and turns a sparse feed into movement — and fractional coordinates mean two different window sizes still agree where a pointer is.',
        'A shared document, a collaborative board, a live review, a support session.',
        ['Text', 'CSS transitions', 'percentage transforms'],
      ),
    ],
    props: [
      { name: 'cursors', type: 'RemoteCursor[]', description: 'id, name, x, y as fractions, plus optional colour and status.' },
      { name: 'smoothing', type: 'number', defaultValue: '120', description: 'Milliseconds to glide. Set it just above your update interval.' },
      { name: 'showLabels', type: 'boolean', defaultValue: 'true', description: 'Name pill beside each pointer.' },
    ],
  },

  'presence-bar': {
    description:
      'Who else is here, with arrivals and departures that can be seen and heard. The order puts the local person first and then holds stable by id — sorting by arrival makes every join reshuffle the row.',
    sections: [
      {
        title: 'Example',
        description: 'Add and remove people. The overflow count absorbs anyone past the limit.',
        bare: true,
        Content: PresenceExample,
        note: motionNote('avatars appear without the lift on hover; the announcements are unchanged.'),
      },
      rationale(
        'A presence list changes on its own, and `AvatarGroup` with a status dot bolted on tells nobody who cannot see it that a colleague just arrived.',
        'A polite live region makes the change audible, and status is part of the accessible name rather than only a ring colour.',
        'A document header, a board, a live report, a support conversation.',
        ['Avatar', 'Tooltip', 'VisuallyHidden', 'status tokens'],
      ),
    ],
    props: [
      { name: 'participants', type: 'Participant[]', description: 'id, name, status, and `you` for the local person.' },
      { name: 'max', type: 'number', defaultValue: '5', description: 'Avatars shown before the rest become a count.' },
      { name: 'announce', type: 'boolean', defaultValue: 'true', description: 'Report arrivals and departures to a live region.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Avatar size.' },
    ],
  },

  'typing-indicator': {
    description:
      'Three dots and a sentence saying who is writing. The sentence is built rather than templated, because one, two and many are three different grammatical shapes — and the usual join produces “Sarah are typing” for the commonest case of all.',
    sections: [
      {
        title: 'Every count',
        description: 'Switch between them. Zero renders nothing at all.',
        bare: true,
        Content: TypingExample,
        note: motionNote('the dots hold still; the sentence is what carries the information anyway.'),
      },
      rationale(
        'It looks like the smallest component in any chat product and it is the one most often wrong: bad grammar at two people, a reserved empty row at zero, and a live region that narrates every keystroke.',
        'All three are decided once here — including `aria-live="off"`, which is the rare correct answer, since narrating each transition would drown out the messages themselves.',
        'A chat, a comment thread, a shared document, a support conversation.',
        ['Text', 'CSS keyframes', 'ink tokens'],
      ),
    ],
    props: [
      { name: 'names', type: 'string[]', description: 'Who is typing, in the order they started. Empty renders nothing.' },
      { name: 'max', type: 'number', defaultValue: '3', description: 'Names listed before the rest become a count.' },
      { name: 'dotsOnly', type: 'boolean', defaultValue: 'false', description: 'Drop the sentence for a compact row.' },
      { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: 'Dot and text size.' },
    ],
  },
}
