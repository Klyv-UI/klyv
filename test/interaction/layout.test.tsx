import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpandableText, SplitPane } from 'klyv'

afterEach(cleanup)

describe('SplitPane', () => {
  it('is a separator with a value that the arrow keys move', async () => {
    const user = userEvent.setup()
    const onSizeChange = vi.fn()
    render(
      <SplitPane
        label="Resize the message list"
        defaultSize={50}
        onSizeChange={onSizeChange}
        start={<p>List</p>}
        end={<p>Message</p>}
      />,
    )

    const divider = screen.getByRole('separator', { name: 'Resize the message list' })
    expect(divider.getAttribute('aria-valuenow')).toBe('50')
    expect(divider.getAttribute('aria-valuemin')).toBe('15')
    expect(divider.getAttribute('aria-valuemax')).toBe('85')
    // A separator nobody can focus is a separator nobody can move.
    expect(divider.getAttribute('tabindex')).toBe('0')

    divider.focus()
    await user.keyboard('{ArrowRight}')
    expect(divider.getAttribute('aria-valuenow')).toBe('52')
    expect(onSizeChange).toHaveBeenLastCalledWith(52)

    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(divider.getAttribute('aria-valuenow')).toBe('48')

    // Shift takes bigger steps, Home and End go to the limits.
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(divider.getAttribute('aria-valuenow')).toBe('58')
    await user.keyboard('{Home}')
    expect(divider.getAttribute('aria-valuenow')).toBe('15')
    await user.keyboard('{End}')
    expect(divider.getAttribute('aria-valuenow')).toBe('85')
  })

  it('never moves past its limits', async () => {
    const user = userEvent.setup()
    render(
      <SplitPane
        label="Resize"
        defaultSize={16}
        min={15}
        max={85}
        start={<p>Start</p>}
        end={<p>End</p>}
      />,
    )

    const divider = screen.getByRole('separator', { name: 'Resize' })
    divider.focus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(divider.getAttribute('aria-valuenow')).toBe('15')
  })

  it('announces which way it resizes', () => {
    const { rerender } = render(
      <SplitPane label="Resize" start={<p>a</p>} end={<p>b</p>} />,
    )
    // A side-by-side split is divided by a vertical separator.
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('vertical')

    rerender(<SplitPane label="Resize" orientation="vertical" start={<p>a</p>} end={<p>b</p>} />)
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('horizontal')
  })
})

describe('ExpandableText', () => {
  it('ties the toggle to the text it opens', async () => {
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    render(
      <ExpandableText expanded onExpandedChange={onExpandedChange}>
        <p>The Rotterdam to Lyon lane runs through two customs regimes.</p>
      </ExpandableText>,
    )

    const toggle = screen.getByRole('button', { name: 'Show less' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    const controls = toggle.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    expect(document.getElementById(controls as string)?.textContent).toContain('Rotterdam')

    await user.click(toggle)
    expect(onExpandedChange).toHaveBeenCalledWith(false)
  })

  it('keeps the whole text in the DOM while collapsed, so find-in-page still reaches it', () => {
    render(
      <ExpandableText expanded={false} lines={1}>
        <p>A sentence that would be clipped by the clamp, not removed from the page.</p>
      </ExpandableText>,
    )
    expect(screen.getByText(/not removed from the page/)).toBeTruthy()
  })
})
