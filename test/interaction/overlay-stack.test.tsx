import { useState } from 'react'
import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoachTour, Combobox, ConfirmDialog, Modal, Popover, ToastProvider, Tooltip } from 'citrine'
import { openOverlayCount } from '../../src/lib/overlay'

/**
 * Overlays in combination — the case every overlay used to get wrong on its
 * own, because each one locked the page, listened for Escape and picked a
 * layer without knowing the others existed.
 *
 * Every test here failed before src/lib/overlay.ts. Handlers are written
 * inline on purpose: a fresh `onClose` on every render is what real callers
 * pass, and it is what exposed the scroll-lock bug.
 */
afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

function EditWithConfirm() {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <button onClick={() => setEditing(true)}>Edit</button>
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit member">
        <button onClick={() => setConfirming(true)}>Remove member</button>
        <button onClick={() => setEditing(false)}>Done</button>
      </Modal>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => setConfirming(false)}
        title="Remove this member?"
        description="They lose access straight away."
      />
    </>
  )
}

describe('scroll lock', () => {
  it('gives scrolling back after a dialog opened from inside another closes', async () => {
    const user = userEvent.setup()
    render(<EditWithConfirm />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(screen.getByRole('button', { name: 'Remove member' }))
    await screen.findByRole('alertdialog', { name: 'Remove this member?' })
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    // The outer dialog is still up, so the page is still held.
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // Before the shared count this stayed `hidden` for good.
    expect(document.body.style.overflow).toBe('')
    expect(openOverlayCount()).toBe(0)
  })

  it('restores the value the page had, not an empty string', async () => {
    document.body.style.overflow = 'clip'
    const { rerender } = render(<Modal open onClose={() => {}} title="One" />)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Modal open={false} onClose={() => {}} title="One" />)
    expect(document.body.style.overflow).toBe('clip')
  })
})

describe('Escape', () => {
  it('closes only the dialog in front', async () => {
    const user = userEvent.setup()
    function Nested() {
      const [outer, setOuter] = useState(true)
      const [inner, setInner] = useState(true)
      return (
        <>
          <Modal open={outer} onClose={() => setOuter(false)} title="Workspace settings" />
          <Modal open={inner} onClose={() => setInner(false)} title="Rename workspace" />
        </>
      )
    }
    render(<Nested />)

    await user.keyboard('{Escape}')
    // Before the stack, one press closed both.
    expect(screen.queryByRole('dialog', { name: 'Rename workspace' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Workspace settings' })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('leaves a confirmation that forces a choice in place, and the dialog behind it', async () => {
    const user = userEvent.setup()
    render(<EditWithConfirm />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Remove member' }))
    await screen.findByRole('alertdialog')

    // The alertdialog is in front and refuses Escape. The dialog behind it must
    // not take the press as its own.
    await user.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Edit member' })).toBeTruthy()
  })

  it('closes a popover without closing the modal it opened in', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Filters">
        <Popover trigger={<button>Columns</button>} label="Column picker">
          <button>Name</button>
        </Popover>
      </Modal>,
    )

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    expect(screen.getByRole('dialog', { name: 'Column picker' })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Column picker' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('dismisses a tooltip without closing the modal it is in', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Billing">
        <Tooltip content="Charged on the first of the month" delay={0}>
          <button>When am I charged?</button>
        </Tooltip>
      </Modal>,
    )

    const trigger = screen.getByRole('button', { name: 'When am I charged?' })
    await user.hover(trigger)
    await screen.findByRole('tooltip')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes a combobox list without closing the modal, then the modal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    function Harness() {
      const [value, setValue] = useState<string | null>(null)
      return (
        <Modal open onClose={onClose} title="Ship to">
          <Combobox
            label="Ship to country"
            options={[
              { value: 'de', label: 'Germany' },
              { value: 'fr', label: 'France' },
            ]}
            value={value}
            onValueChange={setValue}
          />
        </Modal>
      )
    }
    render(<Harness />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.keyboard('{ArrowDown}')
    expect(input.getAttribute('aria-expanded')).toBe('true')

    await user.keyboard('{Escape}')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does nothing to a dialog that forces a choice', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Accept the terms" dismissible={false} />)
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('layers', () => {
  it('puts a popover opened inside a modal above the modal', async () => {
    const user = userEvent.setup()
    render(
      <Modal open onClose={() => {}} title="Filters">
        <Popover trigger={<button>Columns</button>} label="Column picker">
          <button>Name</button>
        </Popover>
      </Modal>,
    )
    await user.click(screen.getByRole('button', { name: 'Columns' }))

    // The layer lives on the fixed wrapper around each overlay.
    const layerOf = (element: HTMLElement) => {
      let node: HTMLElement | null = element
      while (node && !node.style.zIndex) node = node.parentElement
      return Number(node?.style.zIndex)
    }
    const modal = layerOf(screen.getByRole('dialog', { name: 'Filters' }))
    const popover = layerOf(screen.getByRole('dialog', { name: 'Column picker' }))
    expect(popover).toBeGreaterThan(modal)
  })
})

describe('focus', () => {
  it('hands focus back to the trigger when a popover closes from inside', async () => {
    const user = userEvent.setup()
    render(
      <Popover trigger={<button>Sort</button>} label="Sort by">
        <button>Newest</button>
      </Popover>,
    )

    const trigger = screen.getByRole('button', { name: 'Sort' })
    await user.click(trigger)
    screen.getByRole('button', { name: 'Newest' }).focus()

    await user.keyboard('{Escape}')
    // It used to fall to <body> when the focused item was removed.
    expect(document.activeElement).toBe(trigger)
  })
})

describe('server rendering', () => {
  it('hydrates a ToastProvider without a mismatch', async () => {
    const tree = (
      <ToastProvider>
        <main>Dashboard</main>
      </ToastProvider>
    )
    const container = document.createElement('div')
    container.innerHTML = renderToString(tree)
    document.body.append(container)

    const errors: unknown[] = []
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args))

    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (error) => errors.push(error) })
    })

    consoleError.mockRestore()
    // Before: "Hydration failed because the initial UI does not match…", and
    // React threw away every byte of server HTML.
    expect(errors).toEqual([])
    expect(container.querySelector('main')?.textContent).toBe('Dashboard')

    act(() => root?.unmount())
    container.remove()
  })

  it('renders an open CoachTour on the server without throwing', () => {
    // `window` is defined under jsdom, so take it away for this one render.
    const saved = globalThis.window
    // @ts-expect-error — simulating a server, where there is no window.
    delete globalThis.window
    try {
      expect(() =>
        renderToString(
          <CoachTour
            open
            onClose={() => {}}
            steps={[{ id: 'a', target: '#nothing', title: 'Welcome', description: 'Start here.' }]}
          />,
        ),
      ).not.toThrow()
    } finally {
      globalThis.window = saved
    }
  })
})
