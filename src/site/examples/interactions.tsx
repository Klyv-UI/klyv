import { useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Check,
  CreditCard,
  Download,
  Gift,
  Plus,
  QrCode,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import {
  Avatar,
  Button,
  DescriptionList,
  IconTile,
  MagicTabs,
  MorphDialog,
  RadialMenu,
  ScratchCard,
  ScrollProgress,
  Sparkline,
  Surface,
  SwipeDeck,
  Tag,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

interface Approval {
  id: string
  name: string
  merchant: string
  amount: number
  category: string
  when: string
}

const APPROVALS: Approval[] = [
  { id: '1', name: 'Sarah Rosewood', merchant: 'Rent share', amount: 640, category: 'Transfer', when: 'Today, 09:12' },
  { id: '2', name: 'GumZone', merchant: 'Monthly plan', amount: 35, category: 'Subscription', when: 'Today, 08:40' },
  { id: '3', name: 'Northwind Energy', merchant: 'October bill', amount: 128.4, category: 'Bill', when: 'Yesterday' },
  { id: '4', name: 'Halo Fitness', merchant: 'Annual renewal', amount: 219, category: 'Subscription', when: 'Yesterday' },
  { id: '5', name: 'Kestrel Books', merchant: 'Order 88213', amount: 42.1, category: 'Card', when: '2 days ago' },
]

/* ----------------------------------------------------------- specimens */

function MagicTabsExample() {
  const [pill, setPill] = useState('activity')
  const [underline, setUnderline] = useState('overview')

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Text size="caption" tone="faint">
          Pill — with icons and counts, so the tabs are deliberately different widths
        </Text>
        <MagicTabs
          label="Account sections"
          value={pill}
          onValueChange={setPill}
          panelId="magic-tabs-panel"
          items={[
            { value: 'activity', label: 'Activity', icon: ArrowLeftRight, count: 24 },
            { value: 'cards', label: 'Cards', icon: CreditCard },
            { value: 'rewards', label: 'Rewards', icon: Gift, count: 3 },
            { value: 'archive', label: 'Archive', disabled: true },
          ]}
          className="self-start"
        />
        <Surface
          id="magic-tabs-panel"
          role="tabpanel"
          variant="sunken"
          padding="lg"
          className="mt-1"
        >
          <Text size="body" tone="soft">
            Showing <strong className="font-bold text-ink">{pill}</strong>.
          </Text>
        </Surface>
      </div>

      <div className="flex flex-col gap-2">
        <Text size="caption" tone="faint">
          Underline — the same measurement, drawn as a rule
        </Text>
        <MagicTabs
          variant="underline"
          size="sm"
          label="Report sections"
          value={underline}
          onValueChange={setUnderline}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'categories', label: 'By category' },
            { value: 'merchants', label: 'By merchant' },
            { value: 'export', label: 'Export' },
          ]}
          className="self-start"
        />
      </div>
    </div>
  )
}

function MorphDialogExample() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <MorphDialog
        title="Everyday account"
        description="Opened March 2021 · GB29 NWBK 6016 1331 9268 19"
        triggerLabel="Open everyday account details"
        trigger={
          <Surface variant="card" padding="lg" className="h-full gap-2">
            <div className="flex items-center justify-between">
              <IconTile icon={CreditCard} tone="accent" />
              <Tag size="sm">Everyday</Tag>
            </div>
            <Text size="amount" tabular className="mt-1">
              $27,829.83
            </Text>
            <Text size="caption" tone="faint">
              Tap to expand
            </Text>
          </Surface>
        }
      >
        <div className="flex flex-col gap-4">
          <Sparkline
            values={[21400, 22100, 23050, 24200, 25600, 26400, 27829]}
            label="Balance trend"
            tone="accent"
            area
            showLast
            width={480}
            height={72}
            className="w-full"
          />
          <DescriptionList
            items={[
              { term: 'Available', description: '$27,829.83' },
              { term: 'Pending', description: '$412.00' },
              { term: 'Overdraft', description: 'None arranged' },
              { term: 'Interest', description: '3.1% AER' },
            ]}
          />
          <div className="flex gap-2">
            <Button size="sm">Send money</Button>
            <Button size="sm" variant="outline">
              Statement
            </Button>
          </div>
        </div>
      </MorphDialog>

      <MorphDialog
        title="Savings pot"
        description="Locked until 12 June"
        triggerLabel="Open savings pot details"
        width={440}
        trigger={
          <Surface variant="card" padding="lg" className="h-full gap-2">
            <div className="flex items-center justify-between">
              <IconTile icon={Gift} />
              <Tag size="sm" tone="outline">
                Savings
              </Tag>
            </div>
            <Text size="amount" tabular className="mt-1">
              $6,120.00
            </Text>
            <Text size="caption" tone="faint">
              Tap to expand
            </Text>
          </Surface>
        }
      >
        <Text size="body" weight="medium" tone="soft" leading="normal">
          The dialog grows out of the tile you clicked and collapses back into it, so you never lose
          which of the two you opened.
        </Text>
      </MorphDialog>
    </div>
  )
}

function RadialMenuExample() {
  const [last, setLast] = useState<string | null>(null)

  return (
    <div className="flex w-full flex-col items-center gap-6 py-6">
      <div className="pt-24">
        <RadialMenu
          label="Quick actions"
          icon={Plus}
          radius={96}
          startAngle={-170}
          sweep={160}
          actions={[
            { id: 'send', label: 'Send', icon: Send, onSelect: () => setLast('Send') },
            { id: 'request', label: 'Request', icon: Download, onSelect: () => setLast('Request') },
            { id: 'qr', label: 'QR', icon: QrCode, onSelect: () => setLast('QR') },
            { id: 'card', label: 'Card', icon: CreditCard, onSelect: () => setLast('Card') },
            { id: 'freeze', label: 'Freeze', icon: Trash2, tone: 'danger', onSelect: () => setLast('Freeze') },
          ]}
        />
      </div>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {last ? `Chose ${last}.` : 'Open it, then use the arrow keys. Escape closes.'}
      </Text>
    </div>
  )
}

function SwipeDeckExample() {
  const [decided, setDecided] = useState<{ approved: number; declined: number }>({
    approved: 0,
    declined: 0,
  })
  const [round, setRound] = useState(0)

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <SwipeDeck
        key={round}
        items={APPROVALS}
        itemId={(item) => item.id}
        label="Payments awaiting approval"
        className="w-full max-w-[360px]"
        hints={{
          left: (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-1 text-[11px] font-bold text-white">
              <X size={12} strokeWidth={3} aria-hidden="true" /> Decline
            </span>
          ),
          right: (
            <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[11px] font-bold text-white">
              <Check size={12} strokeWidth={3} aria-hidden="true" /> Approve
            </span>
          ),
        }}
        onSwipe={(_item, direction) =>
          setDecided((previous) => ({
            approved: previous.approved + (direction === 'right' ? 1 : 0),
            declined: previous.declined + (direction === 'left' ? 1 : 0),
          }))
        }
        empty={
          <Surface variant="card" padding="lg" className="w-full max-w-[360px] items-center gap-3">
            <Text size="heading">All caught up</Text>
            <Text size="caption" tone="soft">
              {decided.approved} approved, {decided.declined} declined.
            </Text>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDecided({ approved: 0, declined: 0 })
                setRound((value) => value + 1)
              }}
            >
              Reset
            </Button>
          </Surface>
        }
        renderItem={(item) => (
          <Surface variant="card" padding="lg" className="gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={item.name} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Text size="body" truncate>
                  {item.name}
                </Text>
                <Text size="caption" tone="faint" truncate>
                  {item.merchant}
                </Text>
              </div>
              <Tag size="sm">{item.category}</Tag>
            </div>
            <Text size="title" tabular>
              ${item.amount.toFixed(2)}
            </Text>
            <Text size="caption" tone="faint">
              {item.when}
            </Text>
          </Surface>
        )}
      />
      <Text size="caption" tone="faint">
        Drag the top card, or focus it and press the left and right arrows.
      </Text>
    </div>
  )
}

function ScratchCardExample() {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <ScratchCard
        className="w-full max-w-[380px]"
        onReveal={() => setRevealed(true)}
        label="Scratch to reveal"
        revealLabel="Reveal without scratching"
      >
        <Surface variant="card" padding="lg" className="h-[168px] items-center justify-center gap-2">
          <IconTile icon={Gift} tone="accent" size="lg" />
          <Text size="title" tabular>
            $25 cashback
          </Text>
          <Text size="caption" tone="soft">
            Credited to your card within 24 hours.
          </Text>
        </Surface>
      </ScratchCard>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {revealed ? 'Revealed.' : 'Clear about 45% of the cover and the rest goes on its own.'}
      </Text>
    </div>
  )
}

function ScrollProgressExample() {
  const scroller = useRef<HTMLDivElement>(null)

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <ScrollProgress target={scroller} fixed={false} size={4} />
        <div ref={scroller} className="h-[280px] overflow-y-auto p-6">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 9 }, (_, index) => (
              <div key={index} className="flex flex-col gap-1">
                <Text size="heading">Section {index + 1}</Text>
                <Text size="body" weight="medium" tone="soft" leading="normal">
                  The handler does nothing but request a frame, so the measurement and the single
                  state write happen once per repaint at most — which is what keeps a progress bar
                  from being the reason a page feels slow.
                </Text>
              </div>
            ))}
          </div>
        </div>
        <ScrollProgress
          target={scroller}
          variant="ring"
          fixed={false}
          backToTop
          showValue
          hideUntil={0.08}
          className="absolute bottom-4 right-4"
        />
      </div>
      <Text size="caption" tone="faint">
        Scroll the panel. The ring appears past 8% and scrolls back to the top when clicked.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'magic-tabs': {
    description:
      'Tabs whose indicator physically slides from the old tab to the new one. SegmentedControl cross-fades a background; this measures the selected tab and animates transform and width to match, which is what lets it travel across tabs of different widths.',
    sections: [
      {
        title: 'Both variants',
        description: 'Hover to see the quieter ghost that shows where a click would land.',
        bare: true,
        Content: MagicTabsExample,
        note: motionNote('the indicator jumps rather than travels; nothing else changes.'),
      },
      rationale(
        'A tab set with icons and counts has tabs of different widths, and a cross-faded background makes the change read as two things recolouring rather than one thing moving.',
        'Measuring in useLayoutEffect and re-measuring on resize and font load is the only way the indicator is never a frame out of place.',
        'An account page, a report with several cuts of the same data, a settings screen.',
        ['Text', 'ResizeObserver', 'roving tabindex', 'surface tokens'],
      ),
    ],
    props: [
      { name: 'items', type: 'MagicTabItem[]', description: 'value, label, icon, count, disabled.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'Controlled selection.' },
      { name: 'variant', type: "'pill' | 'underline'", defaultValue: "'pill'", description: 'Lifted pill, or a rule under the row.' },
      { name: 'panelId', type: 'string', description: 'Ties the list to its panel through aria-controls.' },
      { name: 'fullWidth / size', type: 'boolean / string', defaultValue: "false / 'md'", description: 'Layout.' },
    ],
  },

  'morph-dialog': {
    description:
      'A card that expands into a dialog from exactly where it sits, and collapses back into it. It is a FLIP animation: the dialog renders at its final size, is transformed back onto the trigger for one frame, then released — so the browser animates one transform and never relayouts the contents.',
    sections: [
      {
        title: 'Example',
        description: 'Open either card. Escape, the scrim and the close button all send it back.',
        bare: true,
        Content: MorphDialogExample,
        note: motionNote('the dialog simply appears — the spatial cue is a nicety, the dialog is not.'),
      },
      rationale(
        'A dialog that fades in from nowhere makes the reader find their place again when it closes, which is worst exactly where it is most used: a grid of similar tiles.',
        'Growing the dialog out of the thing that was clicked answers where am I and where will I be returned to, without a word of copy.',
        'A card grid where each tile has a detail view — accounts, plans, team members, files.',
        ['Portal', 'FocusTrap', 'IconButton', 'Text', 'shadow tokens'],
      ),
    ],
    props: [
      { name: 'trigger', type: 'ReactNode', description: 'The closed state. Wrapped in a button, so it must not contain one.' },
      { name: 'title / description', type: 'string / string', description: 'Dialog heading, wired to aria-labelledby and aria-describedby.' },
      { name: 'width', type: 'number', defaultValue: '560', description: 'Dialog width in pixels, capped to the viewport.' },
      { name: 'triggerLabel', type: 'string', description: 'Accessible name, when the trigger is not self-describing.' },
      { name: 'onOpenChange', type: '(open: boolean) => void', description: 'Reports both directions.' },
    ],
  },

  'radial-menu': {
    description:
      'Actions fanned out on an arc around their trigger. The arc is not decoration: on a radial layout every action is the same distance from the pointer, so no item is cheaper to reach than another. A vertical menu always favours its first item.',
    sections: [
      {
        title: 'Example',
        description: 'The stagger runs outward on open and inward on close, so it reads as one object.',
        bare: true,
        Content: RadialMenuExample,
        note: motionNote('the items appear in place, still on the arc.'),
      },
      rationale(
        'A floating action button with three to six verbs behind it is a mobile staple, and it is normally built as a list that grows upward — which puts the last item furthest from the thumb.',
        'A transform per item keeps the open composited, and the arc equalises the reach. It is still a real menu: Escape, outside click, arrow keys and a focusable trigger.',
        'A floating action button, a canvas or editor tool, a compact row of verbs on a touch screen.',
        ['Text', 'IconComponent', 'shadow tokens', 'motion tokens'],
      ),
    ],
    props: [
      { name: 'actions', type: 'RadialAction[]', description: 'id, label, icon, onSelect, disabled, tone.' },
      { name: 'radius / startAngle / sweep', type: 'number', defaultValue: '92 / -90 / 180', description: 'Geometry of the arc. 360 makes a full wheel.' },
      { name: 'icon / label', type: 'IconComponent / string', description: 'The trigger glyph and its accessible name.' },
      { name: 'open / onOpenChange', type: 'boolean / fn', description: 'Controlled visibility. Omit for uncontrolled.' },
    ],
  },

  'swipe-deck': {
    description:
      'A stack of cards where the top one is thrown left or right. The drag uses pointer capture, which is what keeps the gesture alive when the pointer leaves the card — exactly what happens on every real throw — and the transform is written straight to the node, so a gesture re-renders three times rather than once a pixel.',
    sections: [
      {
        title: 'Example',
        description: 'Drag past the threshold to see the hint, or use the arrow keys on the focused card.',
        bare: true,
        Content: SwipeDeckExample,
        note: motionNote('the throw is instant rather than eased; the keyboard path is identical either way.'),
      },
      rationale(
        'A queue of yes/no decisions — approvals, matches, review items — is slow in a table, because each row costs a read, a scan across to the buttons and a click.',
        'One card at a time with a directional gesture makes the decision a single motion, and the arrow keys give the same speed to anyone not holding a pointer.',
        'Payment approvals, a review queue, onboarding preferences, triage of anything.',
        ['Surface', 'Avatar', 'Tag', 'Text', 'pointer capture'],
      ),
    ],
    props: [
      { name: 'items / itemId / renderItem', type: 'T[] / fn / fn', description: 'The deck, a stable key, and the face of one card.' },
      { name: 'onSwipe / onEmpty', type: '(item, direction) => void / fn', description: 'The decision, and running out.' },
      { name: 'threshold / depth', type: 'number / number', defaultValue: '96 / 3', description: 'Pixels before a release counts, and cards visible behind the top one.' },
      { name: 'hints', type: '{ left, right }', description: 'Badges shown once the drag passes the threshold.' },
      { name: 'empty', type: 'ReactNode', description: 'Rendered when the deck runs out.' },
    ],
  },

  'scratch-card': {
    description:
      'A cover you scratch away to reveal what is under it. The cover is a canvas erased with destination-out compositing, progress is sampled on a coarse grid rather than pixel by pixel, and there is always a real button beside it — because scratching is a pointer gesture with no keyboard equivalent.',
    sections: [
      {
        title: 'Example',
        description: 'Scratch about half of it and the rest goes on its own.',
        bare: true,
        Content: ScratchCardExample,
        note: motionNote('unchanged — the reveal is a gesture, not an animation, and the button is always there.'),
      },
      rationale(
        'A reward that simply appears is read and forgotten. The small act of uncovering it is what makes it register as something received.',
        'Compositing the hole into a canvas is the only way to get a soft-edged erase without a new element per stroke — and the fallback button means the reward is never gated behind a mouse.',
        'A cashback reveal, a referral code, a loyalty prize, a launch-day surprise.',
        ['canvas', 'Surface', 'Text', 'ResizeObserver'],
      ),
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'What is underneath. Rendered immediately; the cover hides it.' },
      { name: 'threshold', type: 'number', defaultValue: '0.45', description: 'Fraction cleared before the rest reveals itself.' },
      { name: 'brush', type: 'number', defaultValue: '26', description: 'Brush radius in pixels.' },
      { name: 'revealed / onReveal', type: 'boolean / fn', description: 'Reveal from outside, and hear about it.' },
      { name: 'label / revealLabel', type: 'string / string', description: 'Prompt on the cover, and the keyboard fallback.' },
    ],
  },

  'scroll-progress': {
    description:
      'How far through a page — or through one scrolling element — the reader is. Scroll fires far more often than the screen repaints, so the handler does nothing but request a frame; without that coalescing this is one of the easiest components in a library to make a page feel slow.',
    sections: [
      {
        title: 'Bar and ring',
        description: 'Both bound to the panel rather than the window, with fixed turned off.',
        bare: true,
        Content: ScrollProgressExample,
        note: motionNote('unchanged — the value tracks scroll, which the reader is driving.'),
      },
      rationale(
        'A long page gives no sense of how much is left, and the back-to-top button that usually solves the second half of that problem says nothing about the first.',
        'One component answers both, because the control that tells you how far down you are is exactly the control you want when you decide you have gone far enough.',
        'A statement, an article, terms and conditions, a long settings page, a report.',
        ['Text', 'requestAnimationFrame', 'accent tokens'],
      ),
    ],
    props: [
      { name: 'target', type: 'RefObject<HTMLElement>', description: 'The scrolling element. Omit to track the window.' },
      { name: 'variant', type: "'bar' | 'ring'", defaultValue: "'bar'", description: 'A rule across an edge, or a dial.' },
      { name: 'fixed / position', type: "boolean / 'top' | 'bottom'", defaultValue: "true / 'top'", description: 'Pin to the viewport, or place it in a container.' },
      { name: 'backToTop', type: 'boolean', defaultValue: 'false', description: 'Ring variant: clicking scrolls back to the start.' },
      { name: 'hideUntil / showValue', type: 'number / boolean', defaultValue: '0 / false', description: 'Appear past a threshold, and show the percentage.' },
    ],
  },
}
