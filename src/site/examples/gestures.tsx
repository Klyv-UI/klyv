import { useState } from 'react'
import { Archive, GripVertical, Pin, Star, Trash2 } from 'lucide-react'
import {
  Avatar,
  Button,
  HoldToConfirm,
  IconTile,
  ImageCompare,
  PullToRefresh,
  SortableList,
  Surface,
  SwipeRow,
  Text,
} from 'klyvui'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

interface Payee {
  id: string
  name: string
  detail: string
}

const PAYEES: Payee[] = [
  { id: '1', name: 'Sarah Rosewood', detail: 'Rent share · **** 5199' },
  { id: '2', name: 'Northwind Energy', detail: 'Utilities · Direct debit' },
  { id: '3', name: 'Halo Fitness', detail: 'Membership · Monthly' },
  { id: '4', name: 'Kestrel Books', detail: 'Card · Occasional' },
  { id: '5', name: 'GumZone', detail: 'Subscription · Monthly' },
]

const FEED = [
  { id: 'a', name: 'Sarah Rosewood', amount: '+$125.00', when: '4m ago' },
  { id: 'b', name: 'Apple Music', amount: '-$4.99', when: '2h ago' },
  { id: 'c', name: 'Mcdonalds', amount: '-$12.40', when: 'Yesterday' },
  { id: 'd', name: 'Northwind Energy', amount: '-$128.40', when: 'Yesterday' },
  { id: 'e', name: 'Cashback', amount: '+$42.10', when: '2 days ago' },
  { id: 'f', name: 'Halo Fitness', amount: '-$219.00', when: '3 days ago' },
]

/* ----------------------------------------------------------- specimens */

function SortableExample() {
  const [payees, setPayees] = useState(PAYEES)

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-2">
      <SortableList
        items={payees}
        itemId={(payee) => payee.id}
        onReorder={setPayees}
        label="Favourite payees, in order"
        renderItem={(payee, { dragging, grabbed }) => (
          <Surface
            variant="tile"
            padding="sm"
            className={`flex-row items-center gap-3 bg-surface ${dragging || grabbed ? 'border-accent-strong' : ''}`}
          >
            <GripVertical size={16} strokeWidth={2} className="shrink-0 text-ink-faint" aria-hidden="true" />
            <Avatar name={payee.name} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col">
              <Text size="body" truncate>
                {payee.name}
              </Text>
              <Text size="caption" tone="faint" truncate>
                {payee.detail}
              </Text>
            </div>
          </Surface>
        )}
      />
      <Text size="caption" tone="faint" leading="normal">
        Drag a row, or focus one and press Space to pick it up, then use the arrow keys.
      </Text>
    </div>
  )
}

function SwipeRowExample() {
  const [log, setLog] = useState<string | null>(null)

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-2">
      {FEED.slice(0, 3).map((entry) => (
        <SwipeRow
          key={entry.id}
          leading={[
            { id: 'pin', label: 'Pin', icon: Pin, tone: 'accent', onSelect: () => setLog(`Pinned ${entry.name}`) },
          ]}
          trailing={[
            { id: 'archive', label: 'Archive', icon: Archive, onSelect: () => setLog(`Archived ${entry.name}`) },
            { id: 'delete', label: 'Delete', icon: Trash2, tone: 'danger', onSelect: () => setLog(`Deleted ${entry.name}`) },
          ]}
        >
          <div className="flex items-center gap-3 p-3.5">
            <IconTile icon={Star} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Text size="body" truncate>
                {entry.name}
              </Text>
              <Text size="caption" tone="faint">
                {entry.when}
              </Text>
            </div>
            <Text size="body" tabular>
              {entry.amount}
            </Text>
          </div>
        </SwipeRow>
      ))}
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {log ?? 'Drag a row sideways — or press Tab, which opens it too.'}
      </Text>
    </div>
  )
}

function PullExample() {
  const [rows, setRows] = useState(FEED)
  const [refreshed, setRefreshed] = useState(0)

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-2">
      <PullToRefresh
        className="h-[240px]"
        onRefresh={async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 1200))
          setRows((previous) => [previous[previous.length - 1], ...previous.slice(0, -1)])
          setRefreshed((value) => value + 1)
        }}
      >
        <div className="divide-y divide-line">
          {rows.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 p-3.5">
              <Avatar name={entry.name} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Text size="body" truncate>
                  {entry.name}
                </Text>
                <Text size="caption" tone="faint">
                  {entry.when}
                </Text>
              </div>
              <Text size="body" tabular>
                {entry.amount}
              </Text>
            </div>
          ))}
        </div>
      </PullToRefresh>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        Refreshed {refreshed} {refreshed === 1 ? 'time' : 'times'}. The list must be at the top for the drag to start.
      </Text>
    </div>
  )
}

function CompareExample() {
  const panel = (title: string, rows: [string, string][], accent: boolean) => (
    <div className={`flex h-[220px] flex-col gap-2 p-5 ${accent ? 'bg-accent-soft' : 'bg-surface-muted'}`}>
      <Text size="heading">{title}</Text>
      {rows.map(([term, value]) => (
        <div key={term} className="flex items-baseline justify-between gap-4">
          <Text size="caption" tone="soft">
            {term}
          </Text>
          <Text size="body" tabular>
            {value}
          </Text>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-2">
      <ImageCompare
        label="Statement before and after the redesign"
        beforeLabel="Current"
        afterLabel="Proposed"
        before={panel('Statement', [
          ['TXN 88213 GBP', '−12.40'],
          ['DD NORTHWIND EN', '−128.40'],
          ['FPS INB S ROSEWO', '+125.00'],
          ['CSHBK REWARD 09', '+42.10'],
        ], false)}
        after={panel('Statement', [
          ['Kestrel Books', '−$12.40'],
          ['Northwind Energy', '−$128.40'],
          ['Sarah Rosewood', '+$125.00'],
          ['Cashback', '+$42.10'],
        ], true)}
      />
      <Text size="caption" tone="faint">
        Drag the handle, or focus it and use the arrow keys — Shift for bigger steps.
      </Text>
    </div>
  )
}

function HoldExample() {
  const [closed, setClosed] = useState(false)

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <HoldToConfirm
        label="Close account"
        holdingLabel="Keep holding…"
        doneLabel="Account closed"
        icon={Trash2}
        onConfirm={() => setClosed(true)}
      />
      <HoldToConfirm label="Freeze card" tone="accent" duration={900} onConfirm={() => undefined} />
      <HoldToConfirm label="Disabled" tone="ink" disabled onConfirm={() => undefined} />
      {closed && (
        <Button size="sm" variant="ghost" onClick={() => setClosed(false)}>
          Reset the example
        </Button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'sortable-list': {
    description:
      'A list whose rows are dragged into a new order, with the rows they displace sliding out of the way. Geometry is measured once on grab and never during the drag — measuring rows that are already mid-transition is what makes the target index flicker along every boundary.',
    sections: [
      {
        title: 'Example',
        description: 'Drag a row, or use the keyboard: Space picks up, arrows move, Space drops, Escape cancels.',
        bare: true,
        Content: SortableExample,
        note: motionNote('rows change places without sliding; the live-region announcements are unchanged.'),
      },
      rationale(
        'Reordering is normally either drag-only — which excludes anyone not holding a pointer — or a pair of up/down buttons on every row, which is slow and doubles the row content.',
        'The ARIA grab pattern gives both from one model, and every move is announced, because a reorder that is only visible is not one anyone can verify.',
        'Favourite payees, dashboard cards, a playlist, column order, priority lists.',
        ['VisuallyHidden', 'pointer capture', 'motion tokens'],
      ),
    ],
    props: [
      { name: 'items / itemId / renderItem', type: 'T[] / fn / fn', description: 'The list, a stable key, and one row.' },
      { name: 'onReorder', type: '(items: T[]) => void', description: 'Called with the whole reordered array.' },
      { name: 'gap', type: 'number', defaultValue: '8', description: 'Vertical gap, in pixels — it is part of the shift arithmetic.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Turns off both the drag and the keyboard grab.' },
    ],
  },

  'swipe-row': {
    description:
      'A list row that slides aside to reveal its actions. The actions sit under the row rather than inside it, so the row is one opaque surface on a single translateX — no clipping, no measuring, and the actions never reflow as it moves.',
    sections: [
      {
        title: 'Example',
        description: 'Drag sideways, or press Tab: focusing an action opens the row it belongs to.',
        bare: true,
        Content: SwipeRowExample,
        note: motionNote('the snap is instant rather than eased; nothing else about the row changes.'),
      },
      rationale(
        'Row actions are usually a menu behind an ellipsis, which costs two taps and hides the destructive one behind the same affordance as the harmless ones.',
        'A swipe puts the common action one gesture away and the destructive one on its own side — and because the buttons are always in the DOM, Tab reaches them without any swipe at all.',
        'A transaction list, an inbox, a saved-payee list, notifications.',
        ['IconComponent', 'pointer capture', 'colour tokens'],
      ),
    ],
    props: [
      { name: 'leading / trailing', type: 'RowAction[]', description: 'Actions on each edge. The destructive one belongs in trailing.' },
      { name: 'actionWidth', type: 'number', defaultValue: '76', description: 'Width of one action button.' },
      { name: 'children', type: 'ReactNode', description: 'The row itself. It sits on an opaque surface.' },
      { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Turns off the gesture; the buttons stay reachable.' },
    ],
  },

  'image-compare': {
    description:
      'Two states of the same thing, split by a handle you drag across them. The top layer is clipped rather than resized — resizing it would reflow its contents at every pixel of the drag, which is why versions built that way judder on anything more complex than a photograph.',
    sections: [
      {
        title: 'Example',
        description: 'It takes children, not image sources, so it compares whatever you put in it.',
        bare: true,
        Content: CompareExample,
        note: motionNote('unchanged — the reveal is a drag, and the reader is driving it.'),
      },
      rationale(
        'Showing a change usually means two screenshots side by side, which makes the reader do the alignment themselves and misses anything subtle.',
        'One image on top of the other, split by a handle, puts the difference exactly where the eye already is — and the handle is a real slider, so it works from the keyboard.',
        'A redesign write-up, a before-and-after in release notes, an accessibility or theme comparison.',
        ['Text', 'clip-path', 'ARIA slider semantics'],
      ),
    ],
    props: [
      { name: 'before / after', type: 'ReactNode', description: 'Any two nodes. The after layer is clipped to the handle.' },
      { name: 'initial', type: 'number', defaultValue: '0.5', description: 'Starting position, 0 to 1.' },
      { name: 'orientation', type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'", description: 'Split left/right or top/bottom.' },
      { name: 'hover', type: 'boolean', defaultValue: 'false', description: 'Follow the pointer without a press.' },
      { name: 'beforeLabel / afterLabel', type: 'string / string', description: 'Corner captions. Empty hides one.' },
    ],
  },

  'pull-to-refresh': {
    description:
      'Drag the top of a list down past a threshold to reload it. The gesture only starts when the container is already at the top, which is the rule that keeps it from stealing an ordinary scroll — the common failure of hand-rolled versions.',
    sections: [
      {
        title: 'Example',
        description: 'Drag from the first row. The ring is full at exactly the point release would fire.',
        bare: true,
        Content: PullExample,
        note: motionNote('the snap back is instant; the Refresh button is unaffected either way.'),
      },
      rationale(
        'A list that only reloads on navigation feels stale, and a refresh button alone gets lost in a header on touch.',
        'The gesture is where the thumb already is. `onRefresh` may return a promise and the spinner waits for it, rather than for a guessed timeout — and there is always a real button beside it.',
        'A transaction feed, a notifications list, any screen backed by data that moves.',
        ['ProgressRing', 'Spinner', 'Text', 'pointer capture'],
      ),
    ],
    props: [
      { name: 'onRefresh', type: '() => void | Promise<void>', description: 'Awaited — the indicator stays until it settles.' },
      { name: 'threshold', type: 'number', defaultValue: '72', description: 'Pixels of travel before a release counts.' },
      { name: 'showButton', type: 'boolean', defaultValue: 'true', description: 'The keyboard path. Turn it off at your peril.' },
      { name: 'labels', type: '{ pull, release, refreshing }', description: 'Copy for each stage.' },
    ],
  },

  'hold-to-confirm': {
    description:
      'A destructive action that has to be held rather than clicked. It replaces the confirmation dialog for actions that are irreversible but routine: a dialog asks after the mistake is already made and gets dismissed by reflex, while a hold cannot be completed by accident.',
    sections: [
      {
        title: 'Example',
        description: 'Hold either button. Let go early and it rewinds. Space and Enter hold it too.',
        bare: true,
        Content: HoldExample,
        note: motionNote('unchanged — the fill is the gesture itself, not decoration on top of it.'),
      },
      rationale(
        'Confirmation dialogs stop protecting anything the moment they become routine: two clicks in the same place, and the second one is muscle memory.',
        'Spreading the commitment across a gesture cannot be short-circuited that way, and progress is driven from timestamps, so the hold takes the same wall-clock time on a 60Hz and a 144Hz screen.',
        'Closing an account, deleting a card, cancelling a plan, wiping a filter set.',
        ['Text', 'requestAnimationFrame', 'status tokens'],
      ),
    ],
    props: [
      { name: 'label / holdingLabel / doneLabel', type: 'string', description: 'The three stages of the control.' },
      { name: 'onConfirm', type: '() => void', description: 'Fired once, at the end of a completed hold.' },
      { name: 'duration', type: 'number', defaultValue: '1400', description: 'Milliseconds the press must be held.' },
      { name: 'tone', type: "'danger' | 'accent' | 'ink'", defaultValue: "'danger'", description: 'Shell and fill colour.' },
    ],
  },
}
