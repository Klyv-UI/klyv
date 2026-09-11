import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyButton, InlineEdit, PasswordStrength } from 'citrine'

afterEach(cleanup)

function EditHarness({ onSave = vi.fn() }: { onSave?: (value: string) => void }) {
  const [value, setValue] = useState('Northern corridor')
  return (
    <InlineEdit
      label="Workspace name"
      value={value}
      onSave={(next) => {
        setValue(next)
        onSave(next)
      }}
      validate={(next) => (next ? undefined : 'A workspace needs a name.')}
    />
  )
}

describe('InlineEdit', () => {
  it('saves on Enter and returns focus to the text', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHarness onSave={onSave} />)

    const reading = screen.getByRole('button', { name: /Workspace name: Northern corridor/ })
    await user.click(reading)

    const field = await screen.findByRole('textbox', { name: 'Workspace name' })
    await waitFor(() => expect(document.activeElement).toBe(field))

    await user.clear(field)
    await user.type(field, 'Southern corridor{Enter}')

    expect(onSave).toHaveBeenCalledWith('Southern corridor')
    const updated = await screen.findByRole('button', { name: /Southern corridor/ })
    await waitFor(() => expect(document.activeElement).toBe(updated))
  })

  it('restores the original on Escape, saving nothing', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHarness onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: /Northern corridor/ }))
    const field = await screen.findByRole('textbox', { name: 'Workspace name' })
    await user.clear(field)
    await user.type(field, 'Discarded{Escape}')

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Northern corridor/ })).toBeTruthy()
  })

  it('keeps the field open and says why when a value is rejected', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHarness onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: /Northern corridor/ }))
    const field = await screen.findByRole('textbox', { name: 'Workspace name' })
    await user.clear(field)
    await user.keyboard('{Enter}')

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('A workspace needs a name.')).toBeTruthy()
    // The reason is tied to the field, not just printed near it.
    const describedBy = field.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      'A workspace needs a name.',
    )
  })
})

/**
 * Real timers here on purpose: Testing Library's waitFor only recognises
 * Jest's fake clock, so with vitest's it would poll a clock that never moves
 * and hang. The reset is short enough to simply wait out.
 */
describe('CopyButton', () => {
  it('writes to the clipboard, announces it, and resets itself', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<CopyButton value="npm i citrine" label="Copy command" />)

    await user.click(screen.getByRole('button', { name: /Copy command/ }))
    expect(writeText).toHaveBeenCalledWith('npm i citrine')

    // Shown and spoken: a glyph turning into a tick is invisible to a reader.
    const copied = await screen.findByRole('button', { name: /Copied/ })
    expect(copied).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Copied')

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Copy command/ })).toBeTruthy()
        expect(screen.getByRole('status').textContent).toBe('')
      },
      { timeout: 3_000 },
    )
  })

  it('says so when the clipboard refuses', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })

    render(<CopyButton value="secret" label="Copy" />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(await screen.findByRole('button', { name: /Copy failed/ })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Copy failed')
  })
})

describe('PasswordStrength', () => {
  it('scores as a measurement, and names every rule that is not met yet', () => {
    const { rerender } = render(<PasswordStrength value="short" />)

    const meter = screen.getByRole('progressbar')
    expect(meter.getAttribute('aria-valuenow')).toBe('0')
    expect(meter.getAttribute('aria-valuemax')).toBe('4')
    expect(meter.getAttribute('aria-label')).toContain('Too weak')
    // One "not met yet" per rule, said in words rather than shown in colour.
    expect(screen.getAllByText(/not met yet/)).toHaveLength(4)

    rerender(<PasswordStrength value="Tr4ck!ng-Parcels" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('4')
    expect(screen.getByRole('status').textContent).toBe('Password strength: Strong')
    expect(screen.queryByText(/not met yet/)).toBeNull()
  })
})
