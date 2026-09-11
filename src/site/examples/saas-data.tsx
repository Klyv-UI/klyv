import { useMemo, useState } from 'react'
import {
  DataTable,
  FilterBuilder,
  SavedViews,
  StatusDot,
  Surface,
  Text,
  matchesFilters,
  type FilterCondition,
  type FilterField,
  type FilterMatch,
  type SavedView,
} from 'citrine'
import type { ExampleModule } from './types'
import { rationale } from './shared'

interface Account {
  id: string
  name: string
  plan: string
  mrr: number
  seats: number
  lastSeen: string
  health: 'good' | 'risk'
}

const ACCOUNTS: Account[] = [
  { id: 'a1', name: 'Northwind', plan: 'team', mrr: 468, seats: 12, lastSeen: '2026-09-10', health: 'good' },
  { id: 'a2', name: 'Kestrel Labs', plan: 'pro', mrr: 96, seats: 4, lastSeen: '2026-09-09', health: 'good' },
  { id: 'a3', name: 'Lumen Studio', plan: 'pro', mrr: 48, seats: 2, lastSeen: '2026-07-02', health: 'risk' },
  { id: 'a4', name: 'Orbital', plan: 'team', mrr: 1_170, seats: 30, lastSeen: '2026-09-11', health: 'good' },
  { id: 'a5', name: 'Fathom Health', plan: 'enterprise', mrr: 4_200, seats: 120, lastSeen: '2026-08-28', health: 'good' },
  { id: 'a6', name: 'Quarry & Co', plan: 'team', mrr: 351, seats: 9, lastSeen: '2026-06-14', health: 'risk' },
  { id: 'a7', name: 'Harbor Freight Tech', plan: 'free', mrr: 0, seats: 1, lastSeen: '2026-09-01', health: 'good' },
]

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'team', label: 'Team' },
  { value: 'enterprise', label: 'Enterprise' },
]

const FIELDS: FilterField[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'plan', label: 'Plan', type: 'select', options: PLAN_OPTIONS },
  { id: 'mrr', label: 'MRR', type: 'number' },
  { id: 'seats', label: 'Seats', type: 'number' },
  { id: 'lastSeen', label: 'Last seen', type: 'date' },
]

const VIEW_FILTERS: Record<string, FilterCondition[]> = {
  all: [],
  big: [{ id: 'v1', field: 'mrr', operator: 'gt', value: '400' }],
  risk: [{ id: 'v2', field: 'lastSeen', operator: 'before', value: '2026-08-01' }],
}

function AccountsTable({ rows }: { rows: Account[] }) {
  return (
    <DataTable
      label="Accounts"
      rows={rows}
      rowId={(row) => row.id}
      empty={<Text size="label" tone="faint" className="p-6 text-center">No account matches these conditions.</Text>}
      columns={[
        { id: 'name', header: 'Account', cell: (row) => <span className="inline-flex items-center gap-2"><StatusDot tone={row.health === 'risk' ? 'warning' : 'success'} label={row.health === 'risk' ? 'At risk' : 'Healthy'} />{row.name}</span>, sortValue: (row) => row.name },
        { id: 'plan', header: 'Plan', cell: (row) => PLAN_OPTIONS.find((option) => option.value === row.plan)?.label, sortValue: (row) => row.plan },
        { id: 'mrr', header: 'MRR', align: 'right', tabular: true, cell: (row) => `$${row.mrr.toLocaleString()}`, sortValue: (row) => row.mrr },
        { id: 'lastSeen', header: 'Last seen', cell: (row) => row.lastSeen, sortValue: (row) => row.lastSeen },
      ]}
    />
  )
}

function BuilderExample() {
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: 'c1', field: 'plan', operator: 'is', value: 'team' },
    { id: 'c2', field: 'mrr', operator: 'gt', value: '400' },
  ])
  const [match, setMatch] = useState<FilterMatch>('all')
  const rows = useMemo(
    () => ACCOUNTS.filter((row) => matchesFilters(row, conditions, match, FIELDS, (item, field) => item[field as keyof Account])),
    [conditions, match],
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <Surface variant="card" padding="lg">
        <FilterBuilder fields={FIELDS} value={conditions} onChange={setConditions} match={match} onMatchChange={setMatch} />
      </Surface>
      <Text size="caption" weight="bold" tone="faint" aria-live="polite">
        {rows.length} of {ACCOUNTS.length} accounts
      </Text>
      <Surface variant="card">
        <AccountsTable rows={rows} />
      </Surface>
    </div>
  )
}

function ViewsExample() {
  const [views, setViews] = useState<SavedView[]>([
    { id: 'all', name: 'All accounts', locked: true },
    { id: 'big', name: 'Over $400 MRR', shared: true },
    { id: 'risk', name: 'Churn risk' },
  ])
  const [saved, setSaved] = useState<Record<string, FilterCondition[]>>(VIEW_FILTERS)
  const [viewId, setViewId] = useState('big')
  const [conditions, setConditions] = useState<FilterCondition[]>(VIEW_FILTERS.big!)
  const [match, setMatch] = useState<FilterMatch>('all')

  const dirty = JSON.stringify(conditions) !== JSON.stringify(saved[viewId] ?? [])
  const filter = (list: FilterCondition[]) =>
    ACCOUNTS.filter((row) => matchesFilters(row, list, 'all', FIELDS, (item, field) => item[field as keyof Account]))
  const rows = filter(conditions)

  const select = (id: string) => {
    setViewId(id)
    setConditions(saved[id] ?? [])
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <SavedViews
        views={views.map((view) => ({ ...view, count: filter(saved[view.id] ?? []).length }))}
        value={viewId}
        onValueChange={select}
        dirty={dirty}
        onDiscard={() => setConditions(saved[viewId] ?? [])}
        onSave={() => setSaved((current) => ({ ...current, [viewId]: conditions }))}
        onSaveAs={(name) => {
          const id = `view-${Date.now()}`
          setViews((current) => [...current, { id, name }])
          setSaved((current) => ({ ...current, [id]: conditions }))
          setViewId(id)
        }}
        onDelete={(view) => {
          setViews((current) => current.filter((item) => item.id !== view.id))
          select('all')
        }}
      />
      <Surface variant="card" padding="lg">
        <FilterBuilder fields={FIELDS} value={conditions} onChange={setConditions} match={match} onMatchChange={setMatch} />
      </Surface>
      <Surface variant="card">
        <AccountsTable rows={rows} />
      </Surface>
    </div>
  )
}

export const demos: ExampleModule = {
  'filter-builder': {
    description:
      'Field, operator, value — as many rows as the question needs, joined by all or any. FilterBar is the quick path of chips; this is for “plan is Team and MRR > 400 and last seen before August”.',
    sections: [
      { title: 'Filtering a real table', bare: true, Content: BuilderExample },
      rationale(
        'Advanced filters are rebuilt per table, and the table’s matching logic drifts away from what the builder’s sentence says.',
        'Operators follow the field’s type; a condition with an empty value is ignored instead of emptying the table; matchesFilters is exported so both sides share one definition.',
        'Any list screen past a few hundred rows — accounts, invoices, users, events.',
        ['Select', 'Input', 'SegmentedControl', 'IconButton', 'DataTable'],
      ),
    ],
    props: [
      { name: 'fields', type: 'FilterField[]', description: "{ id, label, type: 'text' | 'number' | 'select' | 'date', options? }." },
      { name: 'value / onChange', type: 'FilterCondition[] / fn', description: '{ id, field, operator, value } rows.' },
      { name: 'match / onMatchChange', type: "'all' | 'any' / fn", description: 'How rows combine.' },
      { name: 'matchesFilters()', type: '(row, conditions, match, fields, get) => boolean', description: 'The evaluation, exported.' },
    ],
  },

  'saved-views': {
    description:
      'Named combinations of filters above a table. The part usually missing is the unsaved state — change a filter and the table no longer shows what the view’s name says, so it says so, next to save, save as new, or discard.',
    sections: [
      { title: 'Views over the same table', description: 'Change a condition to see the unsaved state; the built-in view can only be copied.', bare: true, Content: ViewsExample },
      rationale(
        'Saved views silently diverge from their name as filters change, and built-in views get overwritten by accident.',
        'A modified dot on the active view plus a named “Unsaved changes” bar; locked views offer Save as new only; shared views warn before deletion.',
        'CRM lists, support queues, admin tables, reports.',
        ['Button', 'Input', 'ConfirmDialog', 'FilterBuilder'],
      ),
    ],
    props: [
      { name: 'views', type: 'SavedView[]', description: '{ id, name, count?, shared?, locked? }.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'The active view.' },
      { name: 'dirty', type: 'boolean', description: 'Current filters differ from the saved ones.' },
      { name: 'onSave / onSaveAs / onDiscard / onDelete', type: 'fn', description: 'The honest choices.' },
    ],
  },
}
