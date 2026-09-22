import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable, type DataTableColumn } from 'klyvui'

afterEach(cleanup)

interface Shipment {
  id: string
  reference: string
  weight: number
}

const ROWS: Shipment[] = [
  { id: 's1', reference: 'MF-40188', weight: 2_400 },
  { id: 's2', reference: 'MF-40182', weight: 18_240 },
  { id: 's3', reference: 'MF-40211', weight: 9_100 },
]

const COLUMNS: DataTableColumn<Shipment>[] = [
  { id: 'reference', header: 'Reference', cell: (row) => row.reference, sortValue: (row) => row.reference },
  { id: 'weight', header: 'Weight', cell: (row) => `${row.weight} kg`, sortValue: (row) => row.weight, align: 'right' },
]

/** The reference in each body row, top to bottom. */
function order() {
  const table = screen.getByRole('table', { name: 'Consignments' })
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent)
    .filter(Boolean)
}

describe('DataTable', () => {
  it('sorts from the header, and says so through aria-sort', async () => {
    const user = userEvent.setup()
    render(<DataTable label="Consignments" rows={ROWS} columns={COLUMNS} rowId={(row) => row.id} />)

    expect(order()).toEqual(['MF-40188', 'MF-40182', 'MF-40211'])

    const table = screen.getByRole('table', { name: 'Consignments' })
    const header = within(table).getByRole('button', { name: /Reference/ })
    const cell = header.closest('th')
    // Unsorted carries no aria-sort, which is what "none" means by default.
    expect(cell?.getAttribute('aria-sort')).not.toBe('ascending')
    expect(cell?.getAttribute('aria-sort')).not.toBe('descending')

    await user.click(header)
    expect(cell?.getAttribute('aria-sort')).toBe('ascending')
    expect(order()).toEqual(['MF-40182', 'MF-40188', 'MF-40211'])

    await user.click(header)
    expect(cell?.getAttribute('aria-sort')).toBe('descending')
    expect(order()).toEqual(['MF-40211', 'MF-40188', 'MF-40182'])
  })

  it('sorts numbers by value, not by how they read', async () => {
    const user = userEvent.setup()
    render(<DataTable label="Consignments" rows={ROWS} columns={COLUMNS} rowId={(row) => row.id} />)

    const table = screen.getByRole('table', { name: 'Consignments' })
    await user.click(within(table).getByRole('button', { name: /Weight/ }))
    // 2,400 before 9,100 before 18,240 — a string sort would put 18,240 first.
    expect(order()).toEqual(['MF-40188', 'MF-40211', 'MF-40182'])
  })

  it('reports what is selected, by id', async () => {
    const user = userEvent.setup()
    const onSelectedChange = vi.fn()

    function Harness() {
      const [selected, setSelected] = useState<string[]>([])
      return (
        <DataTable
          label="Consignments"
          rows={ROWS}
          columns={COLUMNS}
          rowId={(row) => row.id}
          selectable
          selected={selected}
          onSelectedChange={(ids) => {
            setSelected(ids)
            onSelectedChange(ids)
          }}
        />
      )
    }
    render(<Harness />)

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes.length).toBe(ROWS.length + 1) // one per row, plus select-all

    await user.click(boxes[1])
    expect(onSelectedChange).toHaveBeenLastCalledWith(['s1'])

    await user.click(boxes[0])
    expect(onSelectedChange).toHaveBeenLastCalledWith(['s1', 's2', 's3'])

    await user.click(boxes[0])
    expect(onSelectedChange).toHaveBeenLastCalledWith([])
  })

  it('says when there is nothing rather than drawing an empty grid', () => {
    render(
      <DataTable
        label="Consignments"
        rows={[]}
        columns={COLUMNS}
        rowId={(row) => row.id}
        empty={<p>No consignments today.</p>}
      />,
    )
    expect(screen.getByText('No consignments today.')).toBeTruthy()
  })
})
