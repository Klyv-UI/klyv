import { useState } from 'react'
import { Folder, FileText, Wallet } from 'lucide-react'
import {
  Badge,
  Card,
  DataTable,
  DiffView,
  KanbanBoard,
  Surface,
  Tag,
  Text,
  TreeView,
  type DataTableColumn,
  type KanbanColumn,
} from 'citrine'
import type { ExampleModule } from './types'

interface Row {
  id: string
  name: string
  date: string
  category: string
  amount: number
}

const ROWS: Row[] = [
  { id: '1', name: 'Sarah Rosewood', date: '2026-10-14', category: 'Transfer', amount: 125 },
  { id: '2', name: 'GumZone', date: '2026-10-14', category: 'Subscription', amount: -35 },
  { id: '3', name: 'Apple Music', date: '2026-10-13', category: 'Subscription', amount: -4.99 },
  { id: '4', name: 'Jack Hammer', date: '2026-10-13', category: 'Transfer', amount: -24.05 },
  { id: '5', name: 'Electric Co.', date: '2026-10-11', category: 'Bill', amount: -63.69 },
  { id: '6', name: 'Water Co.', date: '2026-10-09', category: 'Bill', amount: -24.5 },
  { id: '7', name: 'Cashback', date: '2026-10-08', category: 'Reward', amount: 42.1 },
  { id: '8', name: 'Mia Okonkwo', date: '2026-10-05', category: 'Transfer', amount: -300 },
]

const money = (value: number) =>
  `${value < 0 ? '-' : '+'}$${Math.abs(value).toFixed(2)}`

function DataTableExample() {
  const [selected, setSelected] = useState<string[]>(['2'])

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'name',
      header: 'Counterparty',
      cell: (row) => <span className="font-bold">{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      id: 'date',
      header: 'Date',
      cell: (row) => <span className="text-ink-soft">{row.date}</span>,
      sortValue: (row) => row.date,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (row) => <Tag size="sm">{row.category}</Tag>,
      sortValue: (row) => row.category,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      tabular: true,
      cell: (row) => (
        <span className={row.amount > 0 ? 'font-bold text-success' : 'font-bold'}>
          {money(row.amount)}
        </span>
      ),
      sortValue: (row) => row.amount,
    },
  ]

  return (
    <Card title="Transactions" padded={false} className="w-full">
      <div className="p-4 pt-0">
        <DataTable
          label="Transactions"
          columns={columns}
          rows={ROWS}
          rowId={(row) => row.id}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          pageSize={5}
        />
      </div>
    </Card>
  )
}

function KanbanExample() {
  const [columns, setColumns] = useState<KanbanColumn[]>([
    {
      id: 'todo',
      title: 'To review',
      cards: [
        { id: 'a', title: 'Electric Co. — $63,69', meta: <Tag size="sm">Bill</Tag> },
        { id: 'b', title: 'Mia Okonkwo — $300,00', meta: <Tag size="sm">Transfer</Tag> },
      ],
    },
    {
      id: 'flagged',
      title: 'Flagged',
      cards: [{ id: 'c', title: 'Unknown merchant — $12,40', meta: <Badge>Check</Badge> }],
    },
    { id: 'done', title: 'Cleared', cards: [{ id: 'd', title: 'Sarah Rosewood — $125,00' }] },
  ])

  const move = (cardId: string, toColumnId: string, toIndex: number) => {
    setColumns((previous) => {
      const card = previous.flatMap((column) => column.cards).find((entry) => entry.id === cardId)
      if (!card) return previous
      return previous.map((column) => {
        const without = column.cards.filter((entry) => entry.id !== cardId)
        if (column.id !== toColumnId) return { ...column, cards: without }
        const next = [...without]
        next.splice(Math.min(toIndex, next.length), 0, card)
        return { ...column, cards: next }
      })
    })
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <KanbanBoard columns={columns} onMove={move} label="Transaction review" className="w-full" />
      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        Drag a card between columns, or hover and focus one to reveal its move controls. A board
        that can only be reordered by drag is unusable by keyboard, and drag has no keyboard
        equivalent of its own.
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  'data-table': {
    description:
      'Table plus the four things a data grid needs: sorting, selection, pagination and an empty state. It composes Table rather than redrawing one, so a plain table and a data table look identical. Sorting is announced through aria-sort, and each header is a real button.',
    sections: [
      { title: 'Example', description: 'Sort a column, select rows, and page through.', bare: true, Content: DataTableExample },
      {
        title: 'Empty',
        bare: true,
        Content: () => (
          <Surface variant="card" className="w-full">
            <DataTable
              label="Empty table"
              columns={[{ id: 'name', header: 'Name', cell: () => null }]}
              rows={[]}
              rowId={() => ''}
            />
          </Surface>
        ),
      },
    ],
    props: [
      { name: 'columns', type: 'DataTableColumn[]', description: 'id, header, cell, and sortValue to make it sortable.' },
      { name: 'rows / rowId', type: 'Row[] / (row) => string', description: 'Data and stable identity.' },
      { name: 'selectable / selected / onSelectedChange', type: 'boolean / string[] / fn', description: 'Adds the selection column.' },
      { name: 'pageSize', type: 'number', description: 'Rows per page. Omit to show everything.' },
      { name: 'empty', type: 'ReactNode', description: 'Replaces the default EmptyState.' },
    ],
  },

  'kanban-board': {
    description:
      'Columns of cards that can be moved between them. Dragging is the pointer affordance, but every card also exposes explicit move controls on focus — because drag-and-drop has no keyboard equivalent, and a board without them simply cannot be used without a mouse.',
    sections: [{ title: 'Example', bare: true, Content: KanbanExample }],
    props: [
      { name: 'columns', type: 'KanbanColumn[]', description: 'id, title and its cards.' },
      { name: 'onMove', type: '(cardId, toColumnId, toIndex) => void', description: 'The board is controlled; you own the data.' },
      { name: 'label', type: 'string', description: 'Accessible name for the board.' },
    ],
  },

  'tree-view': {
    description:
      'Recursive disclosure with the full tree keyboard model: up and down move through visible rows, right expands or steps in, left collapses or steps out, Home and End jump to the ends. Rows carry aria-level, aria-expanded and aria-selected, so depth and state are announced rather than only indented.',
    sections: [
      {
        title: 'Example',
        description: 'Click a folder, or focus a row and use the arrow keys.',
        bare: true,
        Content: () => {
          const [selected, setSelected] = useState('current')
          return (
            <Surface variant="card" padding="md" className="w-full max-w-[340px]">
              <TreeView
                label="Accounts"
                selected={selected}
                onSelect={setSelected}
                defaultExpanded={['personal']}
                nodes={[
                  {
                    id: 'personal',
                    label: 'Personal',
                    icon: Folder,
                    children: [
                      { id: 'current', label: 'Current account', icon: Wallet, meta: <Tag size="sm">£8.4k</Tag> },
                      { id: 'savings', label: 'Savings', icon: Wallet },
                      {
                        id: 'statements',
                        label: 'Statements',
                        icon: Folder,
                        children: [
                          { id: 'sep', label: 'September 2026', icon: FileText },
                          { id: 'oct', label: 'October 2026', icon: FileText },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'business',
                    label: 'Business',
                    icon: Folder,
                    children: [{ id: 'trading', label: 'Trading account', icon: Wallet }],
                  },
                ]}
              />
            </Surface>
          )
        },
      },
    ],
    props: [
      { name: 'nodes', type: 'TreeNode[]', description: 'id, label, icon, meta and children.' },
      { name: 'defaultExpanded', type: 'string[]', description: 'Ids expanded on first render.' },
      { name: 'selected / onSelect', type: 'string / fn', description: 'Current node.' },
    ],
  },

  'diff-view': {
    description:
      'A unified diff on the line and surface tokens. Every changed line carries a leading plus or minus as text, not only a background tint — so the change is legible in a screen reader, in print, and to anyone who cannot distinguish the two tints.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: () => (
          <DiffView
            className="w-full max-w-[520px]"
            titles={['v1.0', 'v1.1']}
            lines={[
              { kind: 'unchanged', before: 12, after: 12, content: 'export function Button({' },
              { kind: 'removed', before: 13, content: '  variant = "primary",' },
              { kind: 'added', after: 13, content: '  variant = "accent",' },
              { kind: 'added', after: 14, content: '  loading = false,' },
              { kind: 'unchanged', before: 14, after: 15, content: '  size = "md",' },
              { kind: 'unchanged', before: 15, after: 16, content: '}: ButtonProps) {' },
            ]}
          />
        ),
      },
    ],
    props: [
      { name: 'lines', type: 'DiffLine[]', description: 'kind, before, after and content.' },
      { name: 'titles', type: '[string, string]', description: 'Labels for the two sides.' },
    ],
  },
}
