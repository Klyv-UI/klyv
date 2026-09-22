import { useRef, useState } from 'react'
import { ArrowUpRight, FileText, Sparkles } from 'lucide-react'
import {
  AttentionShake,
  Badge,
  Button,
  CircularText,
  DropOverlay,
  Field,
  FlowField,
  IconButton,
  Input,
  InlineMessage,
  Metronome,
  MorphingText,
  QuestionQueue,
  ScrollStory,
  SegmentedControl,
  SharePermissions,
  Surface,
  Switch,
  Text,
  VersionHistory,
  type AttentionShakeHandle,
  type AttentionShakeVariant,
  type QuestionQueueQuestion,
  type SharePermissionsAccess,
  type SharePermissionsPerson,
  type SharePermissionsRole,
  type VersionHistoryVersion,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ CircularText */

function CircularTextExample() {
  const [rotate, setRotate] = useState<'on' | 'off'>('on')
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <SegmentedControl
        label="Rotation"
        size="sm"
        value={rotate}
        onValueChange={setRotate}
        options={[
          { value: 'on', label: 'Rotating' },
          { value: 'off', label: 'Still' },
        ]}
      />
      <div className="flex flex-wrap items-center justify-center gap-10">
        <CircularText text="Book a discovery call" rotate={rotate === 'on'} size={168}>
          <IconButton icon={ArrowUpRight} label="Book a discovery call" tone="accent" size="lg" />
        </CircularText>
        <CircularText text="Open for projects · 2026" repeat={2} separator=" ✦ " rotate={rotate === 'on'} reverse size={140} fontSize={11}>
          <span className="flex size-12 items-center justify-center rounded-full bg-ink text-[18px] font-extrabold text-ink-inverse">
            K
          </span>
        </CircularText>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ MorphingText */

function MorphingTextExample() {
  const [pace, setPace] = useState<'calm' | 'brisk'>('calm')
  return (
    <div className="flex w-full flex-col items-center gap-6 py-4">
      <SegmentedControl
        label="Pace"
        size="sm"
        value={pace}
        onValueChange={setPace}
        options={[
          { value: 'calm', label: 'Every 2.2s' },
          { value: 'brisk', label: 'Every 1.2s' },
        ]}
      />
      <h3 className="text-center text-[34px] font-extrabold leading-tight tracking-[-0.035em] text-ink">
        Interfaces that feel{' '}
        <MorphingText
          words={['fast', 'accessible', 'considered', 'yours']}
          interval={pace === 'calm' ? 2200 : 1200}
          className="text-[color-mix(in_oklab,var(--color-accent-strong)_60%,var(--color-ink))]"
        />
      </h3>
      <Text size="caption" tone="faint">
        A screen reader hears “fast, accessible, considered, yours” once, not a new word every two seconds.
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ AttentionShake */

function AttentionShakeExample() {
  const [variant, setVariant] = useState<AttentionShakeVariant>('shake')
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [result, setResult] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)
  const card = useRef<AttentionShakeHandle>(null)

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <SegmentedControl
        label="Variant"
        size="sm"
        value={variant}
        onValueChange={setVariant}
        options={[
          { value: 'shake', label: 'Shake' },
          { value: 'pulse', label: 'Pulse' },
          { value: 'bounce', label: 'Bounce' },
        ]}
      />
      <AttentionShake ref={card} trigger={attempts} variant={variant} className="w-full max-w-[340px]">
        <Surface variant="card" padding="lg" className="flex flex-col gap-3">
          <Text size="heading">Unlock the vault</Text>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (pin === '2468') {
                setResult({ tone: 'success', text: 'Unlocked.' })
                return
              }
              setAttempts((count) => count + 1)
              setResult({ tone: 'danger', text: 'That PIN is not right. Try 2468.' })
            }}
          >
            <Field label="Four-digit PIN" error={result?.tone === 'danger' ? result.text : undefined}>
              <Input
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Button type="submit" size="sm">
              Unlock
            </Button>
            {result?.tone === 'success' && (
              <InlineMessage tone="success" live>
                {result.text}
              </InlineMessage>
            )}
          </form>
        </Surface>
      </AttentionShake>
      <Button variant="ghost" size="sm" onClick={() => card.current?.play('bounce')}>
        Nudge it from a ref
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ ScrollStory */

const STORY = [
  {
    id: 'visit',
    title: 'Twelve thousand people visited',
    content: 'Traffic from the launch post peaked on Tuesday. Most of it arrived on a phone, and most of it bounced.',
    value: 12400,
  },
  {
    id: 'signup',
    title: 'Two thousand signed up',
    content: 'The shorter form shipped mid-week. Sign-ups from mobile doubled the day it went out.',
    value: 2100,
  },
  {
    id: 'activate',
    title: 'Nine hundred made a first invoice',
    content: 'Activation is where the funnel narrows most. The sample invoice in onboarding moved it from 31% to 43%.',
    value: 905,
  },
  {
    id: 'pay',
    title: 'Two hundred and forty paid',
    content: 'Paid conversion held steady. The next experiment is an annual plan offered at the first sent invoice.',
    value: 240,
  },
]

function StoryVisual({ index }: { index: number }) {
  const top = STORY[0]!.value
  return (
    <Surface variant="card" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          Launch week funnel
        </Text>
        <Badge tone="neutral">{Math.round((STORY[index]!.value / top) * 1000) / 10}% of visitors</Badge>
      </div>
      <Text size="display" tabular>
        {STORY[index]!.value.toLocaleString('en-US')}
      </Text>
      <div className="flex flex-col gap-2" aria-hidden="true">
        {STORY.map((stage, stageIndex) => (
          <div key={stage.id} className="flex items-center gap-3">
            <span className="w-16 text-[11px] font-bold capitalize text-ink-faint">{stage.id}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <span
                className={
                  stageIndex === index
                    ? 'block h-full rounded-full bg-accent-strong transition-[width] duration-500 motion-reduce:transition-none'
                    : 'block h-full rounded-full bg-line-strong transition-[width] duration-500 motion-reduce:transition-none'
                }
                style={{ width: `${Math.max(3, (stage.value / top) * 100)}%` }}
              />
            </span>
          </div>
        ))}
      </div>
    </Surface>
  )
}

function ScrollStoryExample() {
  const [active, setActive] = useState(0)
  return (
    <div className="flex w-full flex-col gap-3">
      <Text size="caption" tone="faint">
        Scroll the page. Active step: {STORY[active]!.title.toLowerCase()}.
      </Text>
      <ScrollStory
        label="Launch week funnel"
        steps={STORY.map(({ id, title, content }) => ({ id, title, content }))}
        onStepChange={(index) => setActive(index)}
        renderVisual={(index) => <StoryVisual index={index} />}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ SharePermissions */

const SHARE_PEOPLE: SharePermissionsPerson[] = [
  { id: 'u1', name: 'Mira Shah', email: 'mira@northwind.co', role: 'editor', owner: true },
  { id: 'u2', name: 'Kofi Mensah', email: 'kofi@northwind.co', role: 'editor' },
  { id: 'u3', name: 'Lena Vogel', email: 'lena@northwind.co', role: 'commenter' },
  { id: 'u4', name: 'Jun Ito', email: 'jun.ito@partner.io', role: 'viewer' },
]

function SharePermissionsExample() {
  const [people, setPeople] = useState(SHARE_PEOPLE)
  const [access, setAccess] = useState<SharePermissionsAccess>('restricted')
  const [linkRole, setLinkRole] = useState<SharePermissionsRole>('viewer')

  return (
    <Surface variant="card" padding="lg" className="w-full max-w-[520px] gap-4">
      <div className="mb-4 flex items-center gap-2">
        <FileText size={18} aria-hidden="true" />
        <Text size="heading">Share “Q3 planning”</Text>
      </div>
      <SharePermissions
        people={people}
        currentUserId="u1"
        link="https://docs.example.com/d/q3-planning"
        generalAccess={access}
        onGeneralAccessChange={setAccess}
        linkRole={linkRole}
        onLinkRoleChange={setLinkRole}
        onInvite={async (email, role) => {
          await wait(600)
          if (email.endsWith('@blocked.com')) throw new Error('Sharing outside the organisation is turned off for blocked.com.')
          const name = email.split('@')[0]!.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
          setPeople((current) => [...current, { id: email, name, email, role }])
        }}
        onRoleChange={(id, role) => setPeople((current) => current.map((person) => (person.id === id ? { ...person, role } : person)))}
        onRemove={(id) => setPeople((current) => current.filter((person) => person.id !== id))}
      />
    </Surface>
  )
}

/* ------------------------------------------------------------------ VersionHistory */

const NOW = new Date(2026, 8, 17, 16, 30)
const at = (daysAgo: number, hour: number, minute: number) =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, hour, minute)

const VERSIONS: (VersionHistoryVersion & { body: string })[] = [
  { id: 'v9', createdAt: at(0, 16, 12), author: { name: 'Mira Shah' }, summary: 'Tightened the intro', body: 'Q3 is about retention. We will ship annual plans, the sample invoice, and a faster mobile sign-up.' },
  { id: 'v8', createdAt: at(0, 11, 40), author: { name: 'Kofi Mensah' }, name: 'Sent to leadership', body: 'Q3 is about retention. We plan to ship annual plans, the sample invoice, and a faster sign-up on mobile.' },
  { id: 'v7', createdAt: at(0, 9, 5), author: { name: 'Kofi Mensah' }, summary: 'Added budget table', body: 'Q3 is about retention. We plan to ship annual plans and a faster sign-up on mobile.' },
  { id: 'v6', createdAt: at(1, 17, 22), author: { name: 'Lena Vogel' }, name: 'First full draft', body: 'Q3 is mostly about retention. Annual plans and mobile sign-up are the main bets.' },
  { id: 'v5', createdAt: at(1, 14, 3), author: { name: 'Lena Vogel' }, summary: 'Outline', body: 'Retention. Annual plans. Mobile sign-up.' },
  { id: 'v4', createdAt: at(4, 10, 48), author: { name: 'Mira Shah' }, name: 'Kick-off notes', body: 'Themes to discuss: retention, pricing, mobile.' },
]

function VersionHistoryExample() {
  const [selected, setSelected] = useState('v9')
  const [compare, setCompare] = useState(false)
  const [restored, setRestored] = useState<string | null>(null)
  const version = VERSIONS.find((item) => item.id === selected)!
  const current = VERSIONS[0]!

  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
      <Surface variant="card" padding="lg" className="flex min-h-[260px] flex-col gap-3">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          Preview{version.name ? ` · ${version.name}` : ''}
        </Text>
        <Text size="subtitle">Q3 planning</Text>
        <Text size="body" weight="medium" tone="soft" leading="normal">
          {version.body}
        </Text>
        {compare && version.id !== current.id && (
          <div className="flex flex-col gap-1 rounded-[var(--radius-field)] bg-surface-sunken p-3">
            <Text size="caption" weight="bold" tone="faint">
              Current version
            </Text>
            <Text size="label" tone="soft" leading="normal">
              {current.body}
            </Text>
          </div>
        )}
        {restored && (
          <InlineMessage tone="success" live>
            {restored}
          </InlineMessage>
        )}
      </Surface>
      <Surface variant="card" padding="md">
        <VersionHistory
          versions={VERSIONS}
          now={NOW}
          value={selected}
          onValueChange={(id) => {
            setSelected(id)
            setRestored(null)
          }}
          compare={compare}
          onCompareChange={setCompare}
          onRestore={async (id) => {
            await wait(700)
            const chosen = VERSIONS.find((item) => item.id === id)!
            setRestored(`Restored ${chosen.name ?? 'the earlier version'}. The previous state is kept in the history.`)
          }}
        />
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ QuestionQueue */

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)

const INCOMING = [
  'Will the annual plan be available to existing customers?',
  'How are you measuring activation now?',
  'Is there a timeline for the Android app?',
]

function QuestionQueueExample() {
  const [host, setHost] = useState(true)
  const [incoming, setIncoming] = useState(0)
  const [questions, setQuestions] = useState<QuestionQueueQuestion[]>(() => [
    { id: 'q1', text: 'What was the hardest trade-off in the new pricing?', author: 'Dara Okafor', votes: 14, createdAt: minutesAgo(18), pinned: true },
    { id: 'q2', text: 'Can we get the slides afterwards?', votes: 22, createdAt: minutesAgo(25), answered: true },
    { id: 'q3', text: 'How does the sample invoice affect support volume?', author: 'Elif Kaya', votes: 9, voted: true, createdAt: minutesAgo(9) },
    { id: 'q4', text: 'Are there plans for multi-currency invoices?', author: 'Gus Holm', votes: 5, createdAt: minutesAgo(4) },
  ])

  const update = (id: string, change: (question: QuestionQueueQuestion) => QuestionQueueQuestion) =>
    setQuestions((current) => current.map((question) => (question.id === id ? change(question) : question)))

  return (
    <div className="flex w-full max-w-[600px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={host} onChange={(event) => setHost(event.target.checked)} />
          View as host
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={incoming >= INCOMING.length}
          onClick={() => {
            const text = INCOMING[incoming]!
            setIncoming((count) => count + 1)
            setQuestions((current) => [...current, { id: `in-${incoming}`, text, author: 'Audience member', votes: 0, createdAt: new Date() }])
          }}
        >
          Simulate an audience question
        </Button>
      </div>
      <Surface variant="card" padding="lg">
        <QuestionQueue
          questions={questions}
          isHost={host}
          onAsk={async (text, { anonymous }) => {
            await wait(400)
            setQuestions((current) => [
              ...current,
              { id: `mine-${Date.now()}`, text, author: anonymous ? undefined : 'You', votes: 1, voted: true, createdAt: new Date() },
            ])
          }}
          onVote={(id, voted) => update(id, (question) => ({ ...question, voted, votes: question.votes + (voted ? 1 : -1) }))}
          onModerate={(id, action) =>
            update(id, (question) => ({
              ...question,
              answered: action === 'answer' ? true : action === 'reopen' ? false : question.answered,
              pinned: action === 'pin' ? true : action === 'unpin' || action === 'answer' ? false : question.pinned,
              hidden: action === 'hide' ? true : question.hidden,
            }))
          }
        />
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ DropOverlay */

function DropOverlayExample() {
  const [files, setFiles] = useState<{ name: string; size: number }[]>([])
  return (
    <DropOverlay
      accept="image/*,.pdf"
      acceptLabel="Images or PDFs"
      maxSize={5 * 1024 * 1024}
      title="Drop receipts to attach"
      onDrop={(dropped) => setFiles((current) => [...current, ...dropped.map(({ name, size }) => ({ name, size }))])}
      className="w-full max-w-[560px]"
    >
      {(openFilePicker) => (
        <Surface variant="card" padding="lg" className="flex min-h-[240px] flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Text size="heading">Expense #4821 · Team offsite</Text>
              <Text size="caption" tone="faint">
                Drag receipts anywhere onto this card — images or PDFs up to 5 MB.
              </Text>
            </div>
            <Button variant="outline" size="sm" onClick={openFilePicker}>
              Choose files
            </Button>
          </div>
          {files.length === 0 ? (
            <Text size="label" tone="faint" className="py-8 text-center">
              No receipts attached yet.
            </Text>
          ) : (
            <ul aria-label="Attached receipts" className="flex flex-col gap-1.5">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-[var(--radius-field)] bg-surface-muted px-3 py-2">
                  <span className="truncate text-[12px] font-semibold text-ink">{file.name}</span>
                  <span className="text-[11px] font-medium text-ink-faint">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      )}
    </DropOverlay>
  )
}

/* ------------------------------------------------------------------ FlowField */

function FlowFieldExample() {
  const [density, setDensity] = useState<'2' | '4' | '7'>('4')
  const [speed, setSpeed] = useState<'0.6' | '1.2' | '2.4'>('1.2')
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <SegmentedControl
          label="Density"
          size="sm"
          value={density}
          onValueChange={setDensity}
          options={[
            { value: '2', label: 'Sparse' },
            { value: '4', label: 'Even' },
            { value: '7', label: 'Dense' },
          ]}
        />
        <SegmentedControl
          label="Speed"
          size="sm"
          value={speed}
          onValueChange={setSpeed}
          options={[
            { value: '0.6', label: 'Slow' },
            { value: '1.2', label: 'Steady' },
            { value: '2.4', label: 'Quick' },
          ]}
        />
      </div>
      <div className="relative h-[320px] w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <FlowField density={Number(density)} speed={Number(speed)} className="absolute inset-0" />
        <div className="relative flex h-full flex-col items-start justify-end gap-2 bg-gradient-to-t from-surface via-surface/60 to-transparent p-6">
          <Badge>
            <Sparkles size={12} aria-hidden="true" /> New
          </Badge>
          <Text size="title">Forecasts that follow the current</Text>
          <Text size="label" tone="soft" leading="normal" className="max-w-[420px]">
            Cash flow modelled from every invoice, bill and payroll run — updated as they happen.
          </Text>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Metronome */

function MetronomeExample() {
  const [bars, setBars] = useState(0)
  return (
    <div className="flex w-full max-w-[460px] flex-col gap-2">
      <Metronome onBeat={(beat) => beat === 1 && setBars((count) => count + 1)} />
      <Text size="caption" tone="faint" tabular>
        {bars === 0 ? 'Press Start — sound begins only after the press.' : `${bars} bars played`}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ demos */

export const demos: ExampleModule = {
  'circular-text': {
    description:
      'Text set around a circle with a slot in the middle for an icon or a button — the badge on a portfolio or a “book a call” sticker. The phrase is fitted to the circumference so it always closes its own loop, and a screen reader hears it once, not once per repeat.',
    sections: [
      {
        title: 'Live example',
        Content: CircularTextExample,
        note: motionNote('the ring never turns. It also pauses while hovered or focused, so the centre button is easy to hit.'),
      },
      rationale(
        'A circular badge built with rotated spans needs hand-tuned letter angles for every phrase, and reads out as a scatter of letters.',
        'An SVG textPath with textLength fits any phrase exactly, and one plain-text copy gives assistive tech the words once.',
        'Hero corners, portfolio headers, and “scroll” or “book a call” stickers beside a call to action.',
        ['SVG textPath', 'Web Animations', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'text', type: 'string', description: 'The phrase set around the ring. Read once by assistive tech.' },
      { name: 'repeat', type: 'number', defaultValue: '2', description: 'How many times it goes around.' },
      { name: 'separator', type: 'string', defaultValue: "' • '", description: 'Drawn between repeats.' },
      { name: 'size', type: 'number', defaultValue: '160', description: 'Outer diameter in pixels.' },
      { name: 'fontSize', type: 'number', defaultValue: '13', description: 'Letter size in pixels.' },
      { name: 'rotate', type: 'boolean', defaultValue: 'true', description: 'Turn slowly; pauses on hover and focus, off under reduced motion.' },
      { name: 'duration', type: 'number', defaultValue: '18', description: 'Seconds per turn.' },
      { name: 'reverse', type: 'boolean', defaultValue: 'false', description: 'Turn anticlockwise.' },
      { name: 'children', type: 'ReactNode', description: 'Centre slot. Stays upright and clickable.' },
    ],
  },
  'morphing-text': {
    description:
      'One word melting into the next, for a headline with more than one ending. Two blurred copies and an alpha-threshold filter make the letters flow rather than cross-fade, and the words are given to assistive tech once as a list instead of being announced every few seconds.',
    sections: [
      {
        title: 'Live example',
        Content: MorphingTextExample,
        note: motionNote('the first word stays put and nothing morphs.'),
      },
      rationale(
        'Rotating hero words either cut abruptly or fade through an unreadable double image, and a live region on them talks over the whole page.',
        'The threshold filter keeps edges crisp through the morph, the loop writes styles directly without re-rendering, and speech is opt-in.',
        'Landing heroes and section headings where one phrase has several true endings.',
        ['SVG filter', 'requestAnimationFrame', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'words', type: 'string[]', description: 'Words to cycle through. The first is the reduced-motion word.' },
      { name: 'interval', type: 'number', defaultValue: '2200', description: 'Milliseconds each word rests.' },
      { name: 'morphDuration', type: 'number', defaultValue: '900', description: 'Milliseconds the morph takes.' },
      { name: 'accessibleText', type: "'list' | 'first'", defaultValue: "'list'", description: 'What assistive tech reads in place of the animation.' },
      { name: 'announce', type: 'boolean', defaultValue: 'false', description: 'Announce each new word politely.' },
      { name: 'className', type: 'string', description: 'Size, weight and colour.' },
    ],
  },
  'attention-shake': {
    description:
      'A wrapper that nudges its child when a trigger value changes — a shake for a wrong PIN, a pulse for “look here”, a bounce for something new. It plays through the Web Animations API, so the same error twice shakes twice, and under reduced motion it flashes an outline instead of moving.',
    sections: [
      {
        title: 'Live example',
        description: 'Submit any PIN other than 2468.',
        Content: AttentionShakeExample,
        note: motionNote('no movement; the outline flashes once in the danger colour.'),
      },
      rationale(
        'A refused submit usually changes something away from where the person is looking, so they press the button again.',
        'A short decaying movement on the thing itself points at it, and a trigger value means callers never juggle animation classes.',
        'PIN pads, login forms, invalid wizard steps, and cards that just received an update.',
        ['Web Animations', 'usePrefersReducedMotion', 'forwardRef handle'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'What gets nudged.' },
      { name: 'trigger', type: 'unknown', description: 'Plays whenever this value changes; never on first render.' },
      { name: 'variant', type: "'shake' | 'pulse' | 'bounce'", defaultValue: "'shake'", description: 'The kind of nudge.' },
      { name: 'duration', type: 'number', description: 'Milliseconds. Defaults to 450 for shake, 550 otherwise.' },
      { name: 'flashColor', type: 'string', defaultValue: "'var(--color-danger)'", description: 'Outline colour used under reduced motion.' },
      { name: 'onComplete', type: '() => void', description: 'Called when the nudge finishes.' },
      { name: 'as', type: "'div' | 'span'", defaultValue: "'div'", description: 'Wrapper element.' },
      { name: 'ref', type: 'Ref<AttentionShakeHandle>', description: '`play(variant?)` to nudge imperatively.' },
    ],
  },
  'scroll-story': {
    description:
      'Scrollytelling: text steps scroll past while a sticky visual beside them follows the step in the middle of the screen. The visual is a render prop over the active index, and on narrow screens or under reduced motion the story stacks, each step followed by its own visual.',
    sections: [
      {
        title: 'Live example',
        description: 'Wide screens only for the sticky layout — narrow it to see the stacked version.',
        Content: ScrollStoryExample,
        note: motionNote('the story stacks, with every step’s visual shown in place, so nothing changes while you read.'),
      },
      rationale(
        'A report with one chart and five paragraphs makes the reader scroll back and forth between the claim and the picture.',
        'A sticky visual driven by one IntersectionObserver keeps the picture beside the sentence it illustrates, with no scroll listeners.',
        'Annual reviews, launch retrospectives, product tours on a marketing page, and case studies.',
        ['IntersectionObserver', 'Text', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'steps', type: 'ScrollStoryStep[]', description: '`{ id, title, content }` for each step.' },
      { name: 'renderVisual', type: '(index, step) => ReactNode', description: 'Draws the visual for a step.' },
      { name: 'label', type: 'string', description: 'Accessible name for the story.' },
      { name: 'visualSide', type: "'left' | 'right'", defaultValue: "'right'", description: 'Which side the sticky visual sits on.' },
      { name: 'onStepChange', type: '(index, step) => void', description: 'Called when the active step changes.' },
      { name: 'stickyTop', type: 'number', defaultValue: '80', description: 'Offset from the top of the viewport, to clear a header.' },
    ],
  },
  'share-permissions': {
    description:
      'The body of a share dialog: invite by email with a role, change or remove access per person from one menu, and set whether anyone with the link can open it. It is controlled, so the list always reflects the server, and every change is announced.',
    sections: [
      {
        title: 'Live example',
        description: 'Invite someone at blocked.com to see a refusal.',
        Content: SharePermissionsExample,
        background: 'app',
      },
      rationale(
        'Share panels drift from the server, let the owner be removed, and remove people silently from a keyboard.',
        'Controlled data, an owner with no menu at all, duplicate and format checks before sending, and a polite announcement for each change.',
        'Documents, dashboards, boards and folders — anywhere a resource is shared with people and a link.',
        ['Menu', 'Select', 'Input', 'CopyButton', 'Avatar', 'InlineMessage'],
      ),
    ],
    props: [
      { name: 'people', type: 'SharePermissionsPerson[]', description: '`{ id, name, email, role, owner?, avatarSrc? }`.' },
      { name: 'onInvite', type: '(email, role) => void | Promise<void>', description: 'Invite someone. Reject with a message to show it.' },
      { name: 'onRoleChange', type: '(id, role) => void', description: 'A role was changed.' },
      { name: 'onRemove', type: '(id) => void', description: 'Someone was removed.' },
      { name: 'generalAccess', type: "'restricted' | 'link'", description: 'Who else can open it.' },
      { name: 'onGeneralAccessChange', type: '(access) => void', description: 'General access changed.' },
      { name: 'linkRole', type: "'viewer' | 'commenter' | 'editor'", defaultValue: "'viewer'", description: 'What anyone with the link can do.' },
      { name: 'onLinkRoleChange', type: '(role) => void', description: 'Shows the link-role select when given.' },
      { name: 'link', type: 'string', description: 'What Copy link puts on the clipboard.' },
      { name: 'currentUserId', type: 'string', description: 'Marks that person “(you)”.' },
    ],
  },
  'version-history': {
    description:
      'A document’s versions grouped by day, with authors, named versions and a filter to show only those. Selecting a version previews it through a callback, a switch compares it with the current one, and restoring is a separate confirmed step that says the present state is kept.',
    sections: [
      {
        title: 'Live example',
        description: 'Use the arrow keys to move through versions.',
        Content: VersionHistoryExample,
        background: 'app',
      },
      rationale(
        'Version lists mix hundreds of autosaves with the few versions that matter, and make restoring feel like it throws work away.',
        'Selecting only previews, the named-only filter finds the milestones, and the restore confirmation states that nothing is lost.',
        'Docs, design files, contracts, and any editor with autosave.',
        ['ConfirmPopover', 'Switch', 'Avatar', 'Button', 'Text'],
      ),
    ],
    props: [
      { name: 'versions', type: 'VersionHistoryVersion[]', description: '`{ id, createdAt, author, name?, summary? }`. The newest is current.' },
      { name: 'value / defaultValue', type: 'string', description: 'Selected version id.' },
      { name: 'onValueChange', type: '(id) => void', description: 'Load the preview here.' },
      { name: 'compare / defaultCompare', type: 'boolean', defaultValue: 'false', description: 'Compare with the current version.' },
      { name: 'onCompareChange', type: '(compare) => void', description: 'Compare toggled.' },
      { name: 'onRestore', type: '(id) => void | Promise<void>', description: 'Restore after confirmation.' },
      { name: 'defaultNamedOnly', type: 'boolean', defaultValue: 'false', description: 'Start with only named versions.' },
      { name: 'now', type: 'Date', defaultValue: 'new Date()', description: 'Today, for the day headings.' },
    ],
  },
  'question-queue': {
    description:
      'Live Q&A for a talk or an all-hands: ask (optionally anonymously), upvote, sort by votes or time, with pinned questions first and answered ones kept at the bottom. Hosts get a moderation menu per question, and new questions from others are announced politely in batches.',
    sections: [
      {
        title: 'Live example',
        Content: QuestionQueueExample,
        background: 'app',
      },
      rationale(
        'Q&A lists reshuffle under the reader, repeat answered questions, and either stay silent or announce every vote.',
        'A stable order — pinned, open, answered — toggle votes with a pressed state, and announcements only for arrivals from other people.',
        'Webinars, all-hands meetings, conference talks and community office hours.',
        ['Textarea', 'Checkbox', 'SegmentedControl', 'Menu', 'Badge', 'IconButton'],
      ),
    ],
    props: [
      { name: 'questions', type: 'QuestionQueueQuestion[]', description: '`{ id, text, author?, votes, voted?, answered?, pinned?, hidden?, createdAt }`.' },
      { name: 'onAsk', type: '(text, { anonymous }) => void | Promise<void>', description: 'Post a question.' },
      { name: 'onVote', type: '(id, voted) => void', description: 'Upvote toggled.' },
      { name: 'isHost', type: 'boolean', defaultValue: 'false', description: 'Show moderation menus.' },
      { name: 'onModerate', type: "(id, 'answer' | 'reopen' | 'pin' | 'unpin' | 'hide') => void", description: 'A host acted on a question.' },
      { name: 'sort / defaultSort', type: "'top' | 'newest'", defaultValue: "'top'", description: 'Order of open questions.' },
      { name: 'onSortChange', type: '(sort) => void', description: 'Sort changed.' },
      { name: 'maxLength', type: 'number', defaultValue: '280', description: 'Longest question accepted.' },
      { name: 'allowAnonymous', type: 'boolean', defaultValue: 'true', description: 'Offer the anonymous checkbox.' },
    ],
  },
  'drop-overlay': {
    description:
      'A drop target that appears only while files are dragged over a region or the whole page, stating what is accepted and how large. A drag counter keeps it from flickering over child elements, and a choose-files button is always there for keyboard and touch.',
    sections: [
      {
        title: 'Live example',
        description: 'Drag a file from your desktop onto the card, or choose one.',
        Content: DropOverlayExample,
        background: 'app',
      },
      rationale(
        'A permanent dashed drop zone spends space on a gesture most people never use, and a naive enter/leave pair flickers.',
        'The overlay exists only during a file drag, a counter tracks nested enters and leaves, and the same checks apply to picked and dropped files.',
        'Attachments on records, media libraries, chat composers and whole-page uploaders.',
        ['Button', 'InlineMessage', 'Text'],
      ),
    ],
    props: [
      { name: 'onDrop', type: '(files: File[]) => void', description: 'Files that passed the checks.' },
      { name: 'onReject', type: '(rejections) => void', description: '`{ file, reason }` for each refused file.' },
      { name: 'accept', type: 'string', description: 'Native accept string, also checked on drop.' },
      { name: 'acceptLabel', type: 'string', description: 'Plain-language accepted types for the overlay.' },
      { name: 'maxSize', type: 'number', description: 'Largest file in bytes.' },
      { name: 'multiple', type: 'boolean', defaultValue: 'true', description: 'Accept several files at once.' },
      { name: 'scope', type: "'page' | 'region'", defaultValue: "'region'", description: 'Listen on the window, or on the children only.' },
      { name: 'title', type: 'string', defaultValue: "'Drop files to upload'", description: 'Overlay heading.' },
      { name: 'chooseLabel', type: 'string', defaultValue: "'Choose files'", description: 'Label on the file-picker button.' },
      { name: 'children', type: 'ReactNode | (openFilePicker) => ReactNode', description: 'Covered content; a function places the picker control itself.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Ignore drags.' },
    ],
  },
  'flow-field': {
    description:
      'A generative canvas of particles following a smooth, slowly shifting noise current and leaving trails. Colours come from the design tokens and follow the theme, the loop stops off screen, and reduced motion gets a single still frame.',
    sections: [
      {
        title: 'Live example',
        Content: FlowFieldExample,
        note: motionNote('a few hundred steps are drawn at once and shown as a still image.'),
      },
      rationale(
        'Generative hero backgrounds usually pull in a noise library, hard-code colours, and keep burning frames when scrolled away.',
        'A thirty-line seeded value noise, token colours resolved at draw time, and observers that pause the loop when nobody can see it.',
        'Hero sections, empty dashboards, login screens and feature banners.',
        ['Canvas 2D', 'IntersectionObserver', 'usePrefersReducedMotion'],
      ),
    ],
    props: [
      { name: 'density', type: 'number', defaultValue: '3', description: 'Particles per 10,000 square pixels.' },
      { name: 'speed', type: 'number', defaultValue: '1.2', description: 'Pixels per frame.' },
      { name: 'scale', type: 'number', defaultValue: '0.0035', description: 'Noise zoom; smaller is calmer.' },
      { name: 'fade', type: 'number', defaultValue: '0.06', description: 'Trail fade per frame, 0–1.' },
      { name: 'lineWidth', type: 'number', defaultValue: '1.2', description: 'Trail stroke width.' },
      { name: 'colors', type: 'string[]', description: 'Token or CSS colours. Defaults to the accent pair and faint ink.' },
      { name: 'seed', type: 'number', defaultValue: '7', description: 'Noise seed.' },
      { name: 'label', type: 'string', description: 'Makes the canvas an image with this name; otherwise hidden.' },
    ],
  },
  metronome: {
    description:
      'A Web Audio metronome with a tempo slider, a numeric field and tap tempo, time signatures and an accented first beat. Clicks are booked ahead on the audio clock so they do not drift, sound starts only after a press, and Space starts and stops it.',
    sections: [
      {
        title: 'Live example',
        Content: MetronomeExample,
        note: motionNote('the dots are replaced by a still “Beat 2 of 4” readout.'),
      },
      rationale(
        'Timer-driven metronomes drift and stutter whenever the page is busy, which is exactly when a musician notices.',
        'A lookahead scheduler on the AudioContext clock keeps time on the audio thread, and the visual beat reads the same booked times.',
        'Practice tools, music lessons, rhythm games and tempo settings in audio apps.',
        ['Slider', 'NumberInput', 'Select', 'Button', 'Web Audio'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'number', defaultValue: '100', description: 'Tempo in BPM.' },
      { name: 'onValueChange', type: '(bpm) => void', description: 'Tempo changed.' },
      { name: 'min', type: 'number', defaultValue: '30', description: 'Slowest tempo.' },
      { name: 'max', type: 'number', defaultValue: '260', description: 'Fastest tempo.' },
      { name: 'timeSignature / defaultTimeSignature', type: "'2/4' | '3/4' | '4/4' | '5/4' | '6/8' | '7/8'", defaultValue: "'4/4'", description: 'Clicks per bar.' },
      { name: 'onTimeSignatureChange', type: '(signature) => void', description: 'Time signature changed.' },
      { name: 'accent', type: 'boolean', defaultValue: 'true', description: 'Accent the first beat.' },
      { name: 'onBeat', type: '(beat) => void', description: 'Called as each beat sounds.' },
      { name: 'label', type: 'string', defaultValue: "'Metronome'", description: 'Accessible name.' },
    ],
  },
}
