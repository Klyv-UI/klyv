import { useState } from 'react'
import {
  Button,
  DataFreshness,
  ImportMapper,
  RateLimitMeter,
  SegmentedControl,
  Surface,
  Text,
  type ImportField,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const HEADERS = ['Txn Date', 'Description', 'Debit Amount', 'Credit Amount', 'Balance', 'Ref']

const ROWS = [
  ['2026-09-01', 'NORTHWIND ENERGY DD', '128.40', '', '4,921.60', 'DD8841'],
  ['2026-09-02', 'S ROSEWOOD FPS', '', '125.00', '5,046.60', 'FPS5199'],
  ['2026-09-03', 'KESTREL BOOKS', '12.40', '', '5,034.20', 'CRD8821'],
  ['2026-09-04', 'CASHBACK REWARD', '', '42.10', '5,076.30', 'RWD0904'],
]

const FIELDS: ImportField[] = [
  { id: 'date', label: 'Date', required: true, hint: 'When it happened' },
  { id: 'description', label: 'Description', required: true, hint: 'Merchant or payee' },
  { id: 'amount', label: 'Amount out', required: true, hint: 'Money leaving the account' },
  { id: 'credit', label: 'Amount in', hint: 'Money arriving' },
  { id: 'reference', label: 'Reference', hint: 'Optional' },
  { id: 'category', label: 'Category', hint: 'Not in most exports' },
]

/* ----------------------------------------------------------- specimens */

function FreshnessExample() {
  const [updatedAt, setUpdatedAt] = useState(() => new Date(Date.now() - 90_000))
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const refresh = async () => {
    setLoading(true)
    await new Promise((resolve) => window.setTimeout(resolve, 800))
    setLoading(false)
    if (failed) return
    setUpdatedAt(new Date())
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg" className="items-start gap-2">
        <Text size="caption" tone="faint">
          Authorisations today
        </Text>
        <Text size="display" tabular>
          12,481
        </Text>
        <DataFreshness
          updatedAt={updatedAt}
          staleAfter={60_000}
          loading={loading}
          error={failed ? 'The last refresh failed.' : undefined}
          onRefresh={() => void refresh()}
          label="This figure"
        />
      </Surface>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setUpdatedAt(new Date())}>
          Mark as just updated
        </Button>
        <Button size="sm" variant="outline" onClick={() => setUpdatedAt(new Date(Date.now() - 20 * 60_000))}>
          Make it 20 minutes old
        </Button>
        <Button size="sm" variant={failed ? 'accent' : 'ghost'} onClick={() => setFailed((value) => !value)}>
          {failed ? 'Refreshes fail' : 'Refreshes succeed'}
        </Button>
      </div>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        With refreshes failing, the timestamp stays and keeps ageing — the data did not become wrong
        because the network did, it became older, and how old is the useful thing to say.
      </Text>
    </div>
  )
}

function RateLimitExample() {
  const [level, setLevel] = useState<'fine' | 'close' | 'gone'>('close')
  const used = level === 'fine' ? 240 : level === 'close' ? 912 : 1000

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Usage"
        size="sm"
        value={level}
        onValueChange={(value) => setLevel(value as typeof level)}
        className="self-start"
        options={[
          { value: 'fine', label: 'Plenty left' },
          { value: 'close', label: 'Close' },
          { value: 'gone', label: 'Exhausted' },
        ]}
      />

      <Surface variant="card" padding="lg" className="gap-4">
        <RateLimitMeter
          used={used}
          limit={1000}
          resetAt={new Date(Date.now() + 14 * 60_000 + 2000)}
          unit="API calls"
          onUpgrade={() => undefined}
        />
        <RateLimitMeter
          used={3}
          limit={5}
          resetAt={new Date(Date.now() + 3 * 3_600_000)}
          unit="statement exports"
        />
      </Surface>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        The countdown is recomputed from the reset timestamp each tick rather than decremented — a
        decremented counter drifts badly in a background tab, which is exactly where a long quota
        window sits.
      </Text>
    </div>
  )
}

function ImportExample() {
  const [mapping, setMapping] = useState<Record<string, string | null>>({})

  return (
    <div className="flex w-full flex-col gap-3">
      <ImportMapper
        headers={HEADERS}
        rows={ROWS}
        fields={FIELDS}
        value={mapping}
        onChange={setMapping}
        label="Match the columns in your statement"
      />
      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        Date, Description and Amount were guessed from the header names. Map two fields to the same
        column to see the clash reported, or clear a required one.
      </Text>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'data-freshness': {
    description:
      'When this data was last true, and whether that is still good enough. A dashboard with no timestamp is asking to be trusted about something it has not said — the number on screen is always from some moment in the past.',
    sections: [
      {
        title: 'Example',
        description: 'Age the figure, then make refreshes fail: the timestamp stays and keeps ageing.',
        bare: true,
        Content: FreshnessExample,
        note: motionNote('unchanged — the clock ticks at the rate the wording changes, not per frame.'),
      },
      rationale(
        'Every figure on a dashboard is a claim about a moment, and leaving the moment out is the quietest way a product misleads someone.',
        'Staleness is a threshold the caller sets, because ninety seconds is ancient for an authorisation rate and current for a monthly statement — and a failed refresh makes data older, not wrong.',
        'Any live figure, a report header, a chart caption, a sync status.',
        ['Spinner', 'StatusDot', 'Text'],
      ),
    ],
    props: [
      { name: 'updatedAt', type: 'Date', description: 'When the data was fetched — not when the page rendered.' },
      { name: 'staleAfter', type: 'number', defaultValue: '5 min', description: 'Milliseconds after which to treat it as out of date.' },
      { name: 'loading / error', type: 'boolean / string', description: 'A refresh in flight, and one that failed.' },
      { name: 'onRefresh', type: '() => void', description: 'Offer a refresh beside the age.' },
    ],
  },

  'rate-limit-meter': {
    description:
      'How much of a quota is gone, and when it comes back. The reset time is the half that is always missing: “rate limit exceeded” tells someone they are stuck, “912 of 1,000, resets in 14:02” tells them whether to wait or change plan.',
    sections: [
      {
        title: 'Three levels',
        description: 'It warns before the limit rather than at it — being told at 100% is too late to reorder the work.',
        bare: true,
        Content: RateLimitExample,
        note: motionNote('the bar fills without easing; the numbers are identical.'),
      },
      rationale(
        'A quota that is invisible until it is spent turns a planning problem into an outage, and the error that announces it usually says nothing about when it ends.',
        'Showing both numbers and the reset gives the two things anyone can actually do — wait, or change plan — and the countdown is derived from a deadline so a throttled tab cannot drift.',
        'An API dashboard, an exports page, a plan or billing screen, a transfer limit.',
        ['Text', 'accent and status tokens'],
      ),
    ],
    props: [
      { name: 'used / limit', type: 'number / number', description: 'The count and the ceiling.' },
      { name: 'resetAt', type: 'Date', description: 'When the window resets. The countdown is derived from it each tick.' },
      { name: 'unit', type: 'string', description: 'What is counted — "API calls", "exports".' },
      { name: 'warnAt', type: 'number', defaultValue: '0.8', description: 'Fraction at which to start warning.' },
      { name: 'onUpgrade / upgradeLabel', type: 'fn / string', description: 'A way out of the limit, not just an announcement.' },
    ],
  },

  'import-mapper': {
    description:
      'Matching the columns in someone’s file to the fields the importer wants. It guesses first and asks second — a file with an Amount column and a field called Amount does not need a human to connect them.',
    sections: [
      {
        title: 'A bank statement export',
        description: 'Three fields were guessed. Map two to the same column to see the clash caught.',
        bare: true,
        Content: ImportExample,
        note: motionNote('unchanged.'),
      },
      rationale(
        'Imports fail at the mapping step more than anywhere else, and the usual screen asks for nine decisions in a row with nothing but column names to go on.',
        'Guessing removes most of them, showing three real values resolves the ambiguous ones instantly, and catching clashes and missing required fields while the file is on screen beats diagnosing them from an error afterwards.',
        'A statement import, a payee upload, a CSV onboarding step, a migration tool.',
        ['Select', 'Tag', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'headers / rows', type: 'string[] / string[][]', description: 'The file’s header row, and a few rows for the preview.' },
      { name: 'fields', type: 'ImportField[]', description: 'What the importer needs — label, required, hint.' },
      { name: 'value / onChange', type: 'Record<string, string | null> / fn', description: 'field id → header. null means not imported.' },
      { name: 'label', type: 'string', description: 'Accessible name for the group.' },
    ],
  },
}
