import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkActionBar, Button, VirtualList } from 'klyv'

afterEach(cleanup)

const ROWS = Array.from({ length: 10_000 }, (_, index) => ({ id: index, label: `Row ${index}` }))

describe('VirtualList', () => {
  it('renders a window, not ten thousand rows, and still counts them all', () => {
    render(
      <VirtualList
        label="Rows"
        items={ROWS}
        itemHeight={40}
        height={200}
        getKey={(row) => row.id}
        renderItem={(row) => <span>{row.label}</span>}
      />,
    )

    const rendered = screen.getAllByRole('listitem')
    expect(rendered.length).toBeLessThan(30)
    expect(screen.getByText('Row 0')).toBeTruthy()

    // The window is small; the list is not. Both have to be true at once.
    expect(rendered[0].getAttribute('aria-setsize')).toBe('10000')
    expect(rendered[0].getAttribute('aria-posinset')).toBe('1')
  })

  it('follows the scroll, and stays reachable by keyboard', async () => {
    render(
      <VirtualList
        label="Rows"
        items={ROWS}
        itemHeight={40}
        height={200}
        renderItem={(row) => <span>{row.label}</span>}
      />,
    )

    const list = screen.getByRole('list', { name: 'Rows' })
    // A scroll container nobody can focus cannot be scrolled from a keyboard.
    expect(list.getAttribute('tabindex')).toBe('0')

    // jsdom does no layout, so the position is set on the node directly.
    Object.defineProperty(list, 'scrollTop', { value: 4000, configurable: true })
    await act(async () => {
      fireEvent.scroll(list)
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    })

    expect(screen.getByText('Row 100')).toBeTruthy()
    expect(screen.queryByText('Row 0')).toBeNull()
    const first = screen.getAllByRole('listitem')[0]
    expect(Number(first.getAttribute('aria-posinset'))).toBeGreaterThan(90)
  })
})

function SelectionHarness({ onClear = vi.fn() }: { onClear?: () => void }) {
  const [count, setCount] = useState(0)
  return (
    <>
      <button onClick={() => setCount((value) => value + 1)}>Select one more</button>
      <BulkActionBar
        count={count}
        noun="file"
        onClear={() => {
          setCount(0)
          onClear()
        }}
      >
        <Button size="sm">Archive</Button>
      </BulkActionBar>
    </>
  )
}

describe('BulkActionBar', () => {
  it('keeps its live region mounted while hidden, so the first count is announced', async () => {
    const user = userEvent.setup()
    render(<SelectionHarness />)

    // Nothing selected: no bar, but the region that will speak already exists.
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')
    expect(screen.queryByRole('group')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Select one more' }))
    expect(screen.getByRole('status').textContent).toBe('1 file selected')
    expect(screen.getByRole('group', { name: 'Actions for 1 file selected' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Select one more' }))
    expect(screen.getByRole('status').textContent).toBe('2 files selected')
  })

  it('clears the selection and puts the bar away', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<SelectionHarness onClear={onClear} />)

    await user.click(screen.getByRole('button', { name: 'Select one more' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onClear).toHaveBeenCalledOnce()
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
