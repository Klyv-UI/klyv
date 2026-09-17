import { useEffect, useState } from 'react'
import {
  Button,
  ConnectionBanner,
  RetryQueue,
  SaveIndicator,
  SegmentedControl,
  SessionTimeout,
  Surface,
  Text,
  type QueuedChange,
  type SaveState,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const QUEUE: QueuedChange[] = [
  {
    id: '1',
    label: 'Raise your daily limit to $5,000',
    state: 'sending',
    attempts: 1,
  },
  {
    id: '2',
    label: 'Add Sarah Rosewood as a payee',
    detail: 'Sort code 04-00-04 · 5199',
    state: 'waiting',
    attempts: 2,
    nextAttemptIn: 18,
  },
  {
    id: '3',
    label: 'Cancel the Halo Fitness subscription',
    state: 'failed',
    attempts: 5,
    error: 'The provider rejected the request. Nothing was cancelled.',
    terminal: true,
  },
]

/* ----------------------------------------------------------- specimens */

function ConnectionExample() {
  const [state, setState] = useState<'online' | 'offline' | 'queued'>('offline')

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Connection"
        size="sm"
        value={state}
        onValueChange={(value) => setState(value as typeof state)}
        className="self-start"
        options={[
          { value: 'offline', label: 'Offline' },
          { value: 'queued', label: 'Sending' },
          { value: 'online', label: 'Online' },
        ]}
      />

      <ConnectionBanner
        online={state !== 'offline'}
        queued={state === 'online' ? 0 : 3}
        retryIn={22}
        onRetry={() => setState('queued')}
      />

      <Text size="caption" tone="faint" leading="normal" className="max-w-[66ch]">
        On “Online” with nothing queued it renders nothing — except for a few seconds after a
        recovery, where it says so first. Switch from Offline to Online to see that.
      </Text>
    </div>
  )
}

function QueueExample() {
  const [items, setItems] = useState(QUEUE)

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg">
        <RetryQueue
          items={items}
          label="Changes waiting to send"
          onRetry={(id) =>
            setItems((current) =>
              current.map((item) =>
                item.id === id ? { ...item, state: 'sending', error: undefined } : item,
              ),
            )
          }
          onDiscard={(id) => setItems((current) => current.filter((item) => item.id !== id))}
          onRetryAll={() =>
            setItems((current) =>
              current.map((item) => ({ ...item, state: 'sending', error: undefined })),
            )
          }
        />
      </Surface>
      <Button size="sm" variant="ghost" className="self-start" onClick={() => setItems(QUEUE)}>
        Reset the queue
      </Button>
    </div>
  )
}

function SaveExample() {
  const [state, setState] = useState<SaveState>('saved')
  const [savedAt, setSavedAt] = useState<Date>(() => new Date(Date.now() - 4 * 60_000))

  const run = async () => {
    setState('saving')
    await new Promise((resolve) => window.setTimeout(resolve, 900))
    setSavedAt(new Date())
    setState('saved')
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg" className="items-start gap-3">
        <Text size="heading">Payment reference</Text>
        <input
          className="w-full max-w-[380px] rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-2.5 text-[13px] font-medium"
          defaultValue="September rent"
          aria-label="Payment reference"
          onChange={() => setState('dirty')}
        />
        <SaveIndicator
          state={state}
          lastSavedAt={savedAt}
          error={state === 'error' ? 'The connection dropped.' : undefined}
          onSaveNow={() => void run()}
          onRetry={() => void run()}
        />
      </Surface>

      <div className="flex flex-wrap gap-2">
        {(['dirty', 'saving', 'saved', 'error'] as SaveState[]).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={state === value ? 'accent' : 'outline'}
            onClick={() => setState(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[66ch]">
        On “error” the last successful save stays on screen beside the failure — the next question
        is how much was lost, and it is already answered.
      </Text>
    </div>
  )
}

function SessionExample() {
  const [armed, setArmed] = useState(false)
  const [signedOut, setSignedOut] = useState(false)

  // Short numbers, so the warning is reachable inside a demo.
  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), 60_000)
    return () => window.clearTimeout(timer)
  }, [armed])

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Button variant="outline" onClick={() => { setArmed(true); setSignedOut(false) }}>
        Start a 20-second session
      </Button>

      {armed && (
        <SessionTimeout
          timeout={20_000}
          warnAt={15_000}
          syncKey="klyv:demo-activity"
          onExtend={() => new Promise((resolve) => window.setTimeout(resolve, 500))}
          onExpire={() => {
            setArmed(false)
            setSignedOut(true)
          }}
        />
      )}

      <Text size="caption" tone="faint" role="status" aria-live="polite" leading="normal" className="max-w-[66ch]">
        {signedOut
          ? 'Signed out. The dialog does not close on Escape or on a click outside — dismissing it by reflex is indistinguishable from choosing to leave.'
          : 'The warning appears after five seconds. Open this page in a second tab and click there: activity is shared, so the countdown resets in both.'}
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'connection-banner': {
    description:
      'The strip that says the connection is gone, what is still waiting, and when the next attempt is. navigator.onLine is the default rather than the authority — a captive portal and a dead backend both read as online, so a failing request can drive it instead.',
    sections: [
      {
        title: 'Every state',
        description: 'Switch to Online from Offline to see the recovery held on screen.',
        bare: true,
        Content: ConnectionExample,
        note: motionNote('unchanged — nothing here animates; the banner appears and goes.'),
      },
      rationale(
        'Losing the connection mid-edit is the moment a product either keeps someone’s trust or loses it, and “offline” alone does not say whether the last three edits are safe.',
        'The queue count is the part that answers that, and holding the recovery on screen for a few seconds is what stops the reader wondering whether it ever came back.',
        'Any screen that writes — the whole app shell, in practice.',
        ['Spinner', 'Text', 'status tokens'],
      ),
    ],
    props: [
      { name: 'online', type: 'boolean', description: 'Overrides the browser. Drive it from your API, not the network interface.' },
      { name: 'queued', type: 'number', defaultValue: '0', description: 'Changes waiting. Shown even once the connection returns.' },
      { name: 'retryIn / retrying', type: 'number / boolean', description: 'Seconds to the next attempt, counted down locally; and whether one is in flight.' },
      { name: 'restoredFor', type: 'number', defaultValue: '4000', description: 'Milliseconds to keep “back online” on screen.' },
      { name: 'fixed', type: 'boolean', defaultValue: 'false', description: 'Pin to the top of the viewport.' },
    ],
  },

  'retry-queue': {
    description:
      'The changes that have not reached the server yet, and what is happening to each. The countdown to the next attempt is the point: a queue that says “failed” beside a retry button makes everyone press it immediately, which is what a backoff exists to prevent.',
    sections: [
      {
        title: 'Three states at once',
        description: 'One sending, one waiting on a backoff, one out of attempts.',
        bare: true,
        Content: QueueExample,
        note: motionNote('unchanged — the countdown is information, not animation.'),
      },
      rationale(
        'Optimistic writes are standard and their failure path is not: most apps show a toast that disappears, leaving a change that silently never happened.',
        'A durable list separates what will be retried from what needs a decision, and names each change in the reader’s words rather than the endpoint’s.',
        'Beside a sync indicator, in a settings screen, anywhere writes are queued offline.',
        ['Spinner', 'StatusDot', 'VisuallyHidden', 'status tokens'],
      ),
    ],
    props: [
      { name: 'items', type: 'QueuedChange[]', description: 'label, state, attempts, nextAttemptIn, error, terminal.' },
      { name: 'onRetry / onDiscard / onRetryAll', type: 'fn', description: 'The three decisions available.' },
      { name: 'emptyLabel', type: 'string', description: 'The normal state, and worth stating.' },
    ],
  },

  'session-timeout': {
    description:
      'The warning before an idle session ends, with a countdown and a way to stay. Activity is shared between tabs through localStorage, and the deadline is a timestamp rather than a ticking counter — a sleeping laptop wakes up believing minutes were seconds.',
    sections: [
      {
        title: 'A twenty-second session',
        description: 'The warning appears after five seconds. Open a second tab to see activity shared.',
        bare: true,
        Content: SessionExample,
        note: motionNote('unchanged — the dialog appears without a transition and the ring still reads.'),
      },
      rationale(
        'A second tab left open on a dashboard counts as idle and signs the person out of the tab they are actually typing in. It is the commonest complaint about session timeouts and a five-line fix.',
        'Sharing activity through storage events fixes it; holding the deadline as a timestamp fixes the laptop-lid case; and refusing to close on Escape stops a reflex dismissing the choice.',
        'Anywhere holding a session — the app shell, mounted once.',
        ['Portal', 'FocusTrap', 'ProgressRing', 'Button'],
      ),
    ],
    props: [
      { name: 'timeout / warnAt', type: 'number / number', defaultValue: '15 min / 60s', description: 'Idle time before the end, and how long before it to warn.' },
      { name: 'onExtend / onExpire', type: 'fn / fn', description: 'Extend — awaited — and the sign-out itself.' },
      { name: 'syncKey', type: 'string', description: 'localStorage key sharing activity between tabs. Empty disables it.' },
      { name: 'paused', type: 'boolean', defaultValue: 'false', description: 'Suspend it — during a payment confirmation, say.' },
    ],
  },

  'save-indicator': {
    description:
      'What autosave is doing, and when it last succeeded. “Saved” alone is indistinguishable from “saved four hours ago and nothing since” — the timestamp is what turns it into a claim, and it ticks at the rate the wording can actually change.',
    sections: [
      {
        title: 'Every state',
        description: 'Switch to error: the last successful save stays beside the failure.',
        bare: true,
        Content: SaveExample,
        note: motionNote('unchanged — only the spinner moves, and it is replaced by a dot.'),
      },
      rationale(
        'Autosave removes the save button and with it the reader’s certainty that anything was saved, so the indicator becomes the only evidence — and it usually says the least useful possible thing.',
        'Naming the last successful save answers the question a failure prompts, and keeping the live region polite for everything but errors is what stops it narrating every keystroke pause.',
        'A document header, a settings page, a long form, an editor toolbar.',
        ['Spinner', 'StatusDot', 'Text'],
      ),
    ],
    props: [
      { name: 'state', type: "'idle' | 'dirty' | 'saving' | 'saved' | 'error'", description: 'The five real states.' },
      { name: 'lastSavedAt', type: 'Date', description: 'Shown as a live relative time, and kept on screen through a failure.' },
      { name: 'onSaveNow / onRetry', type: 'fn / fn', description: 'Offered in the states where they make sense.' },
      { name: 'compact', type: 'boolean', defaultValue: 'false', description: 'Drop the timestamp and the actions.' },
    ],
  },
}
