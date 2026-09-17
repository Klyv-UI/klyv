import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Calendar,
  DatePicker,
  LiveChart,
  NumberInput,
  PinPad,
  TimePicker,
  TreeView,
  applyAccent,
  cn,
} from 'klyv'
import { chartScale, formatTick } from '../../src/lib/chart'

/**
 * The second round of fixes from the production-readiness audit. As with
 * regressions.test.tsx, each describe says what used to happen.
 */
afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('style')
})

describe('DatePicker', () => {
  it('opens from the keyboard without submitting the form, and hands focus back', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    function Harness() {
      const [value, setValue] = useState<string>('2026-03-10')
      return (
        <form onSubmit={onSubmit}>
          <DatePicker label="Start date" value={value} onValueChange={setValue} />
        </form>
      )
    }
    render(<Harness />)

    const field = screen.getByRole('combobox', { name: 'Start date' })
    field.focus()

    // Before: Enter sent no click to the read-only field, so nothing opened —
    // and the form was submitted instead.
    await user.keyboard('{Enter}')
    expect(field.getAttribute('aria-expanded')).toBe('true')
    expect(onSubmit).not.toHaveBeenCalled()

    // Focus goes to the selected day, not nowhere.
    await waitFor(() => expect(document.activeElement?.textContent).toContain('10 March 2026'))

    await user.keyboard('{Escape}')
    expect(field.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(field)
  })
})

describe('Calendar', () => {
  it('moves focus with the arrow keys, not just the tab stop', async () => {
    const user = userEvent.setup()
    render(<Calendar label="Due" value="2026-03-10" onValueChange={() => {}} />)

    screen.getByRole('button', { name: /10 March 2026/ }).focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    // Before: focus stayed on the 10th while tabIndex=0 moved on.
    expect(document.activeElement?.textContent).toContain('12 March 2026')
  })

  it('keeps a focused, tabbable day after PageDown', async () => {
    const user = userEvent.setup()
    render(<Calendar label="Due" value="2026-01-31" onValueChange={() => {}} />)

    screen.getByRole('button', { name: /31 January 2026/ }).focus()
    await user.keyboard('{PageDown}')

    // Before: the month changed, the focused day was unmounted, and no day in
    // the grid had tabIndex=0 — the grid could no longer be reached by Tab.
    const grid = screen.getByRole('grid')
    expect(grid.querySelectorAll('button[tabindex="0"]')).toHaveLength(1)
    // 31 January → the last day February has.
    expect(document.activeElement?.textContent).toContain('28 February 2026')
  })

  it('can move focus onto a day outside min and max, but not choose it', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Calendar label="Due" value="2026-03-10" max="2026-03-10" onValueChange={onValueChange} />)

    screen.getByRole('button', { name: /10 March 2026/ }).focus()
    await user.keyboard('{ArrowRight}')
    // Before: a disabled button refused focus and navigation stalled on it.
    expect(document.activeElement?.textContent).toContain('11 March 2026')
    await user.keyboard('{Enter}')
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('follows a controlled value into another month', () => {
    const { rerender } = render(<Calendar label="Due" value="2026-03-10" onValueChange={() => {}} />)
    expect(screen.getByText('March 2026')).toBeTruthy()
    // Before: `value` was read once, so the grid stayed on March.
    rerender(<Calendar label="Due" value="2027-08-01" onValueChange={() => {}} />)
    expect(screen.getByText('August 2027')).toBeTruthy()
  })
})

describe('TimePicker', () => {
  it('opens from the keyboard and walks its options with the arrows', async () => {
    const user = userEvent.setup()
    render(<TimePicker label="Start time" step={60} onValueChange={() => {}} />)

    const field = screen.getByRole('combobox', { name: 'Start time' })
    field.focus()
    await user.keyboard('{ArrowDown}')
    expect(field.getAttribute('aria-expanded')).toBe('true')

    await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('option'))
    const first = document.activeElement
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).not.toBe(first)
    expect(document.activeElement?.getAttribute('role')).toBe('option')
  })
})

describe('TreeView', () => {
  const nodes = [
    {
      id: 'src',
      label: 'src',
      children: [
        { id: 'app', label: 'app.tsx' },
        { id: 'main', label: 'main.tsx' },
      ],
    },
    { id: 'readme', label: 'README.md' },
  ]

  it('moves focus down the rows and steps out to the parent', async () => {
    const user = userEvent.setup()
    render(<TreeView label="Files" nodes={nodes} defaultExpanded={['src']} />)

    screen.getByRole('treeitem', { name: /src/ }).focus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    // Before: focus stayed on the first row while the tab stop moved.
    expect(document.activeElement?.textContent).toContain('main.tsx')

    await user.keyboard('{ArrowLeft}')
    // Before: ArrowLeft on a child went to the row above (app.tsx).
    expect(document.activeElement?.textContent).toContain('src')
  })

  it('states each row’s place among its siblings', () => {
    render(<TreeView label="Files" nodes={nodes} defaultExpanded={['src']} />)
    const main = screen.getByRole('treeitem', { name: /main\.tsx/ })
    expect(main.getAttribute('aria-posinset')).toBe('2')
    expect(main.getAttribute('aria-setsize')).toBe('2')
  })
})

describe('NumberInput', () => {
  function Harness({ onChange }: { onChange: (value: number) => void }) {
    const [value, setValue] = useState(10)
    return (
      <NumberInput
        aria-label="Seats"
        min={10}
        max={100}
        value={value}
        onValueChange={(next) => {
          setValue(next)
          onChange(next)
        }}
      />
    )
  }

  it('lets a number be typed that passes through the range on the way', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const field = screen.getByRole('spinbutton', { name: 'Seats' }) as HTMLInputElement
    await user.tripleClick(field)
    await user.keyboard('25')
    await user.tab()

    // Before: "2" clamped to 10, then "105" clamped to 100.
    expect(field.value).toBe('25')
    expect(onChange).toHaveBeenLastCalledWith(25)
    expect(onChange).not.toHaveBeenCalledWith(100)
  })

  it('clamps when the person finishes, and reverts an empty field', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const field = screen.getByRole('spinbutton', { name: 'Seats' }) as HTMLInputElement

    await user.tripleClick(field)
    await user.keyboard('500{Enter}')
    expect(field.value).toBe('100')
    expect(onChange).toHaveBeenLastCalledWith(100)

    await user.clear(field)
    // Before: an emptied field snapped to the minimum on the spot.
    expect(field.value).toBe('')
    await user.tab()
    expect(field.value).toBe('100')
  })
})

describe('PinPad', () => {
  it('submits a code once, however often the parent re-renders', async () => {
    const onComplete = vi.fn()
    function Harness() {
      const [attempts, setAttempts] = useState(0)
      return (
        <>
          <span>{attempts}</span>
          <PinPad
            label="PIN"
            onComplete={(code) => {
              // A new inline handler every render, and state set inside it:
              // before, this pair called onComplete again on every render.
              onComplete(code)
              setAttempts((count) => count + 1)
            }}
          />
        </>
      )
    }
    render(<Harness />)

    const pad = screen.getByRole('group', { name: 'PIN' })
    for (const digit of '1234') fireEvent.keyDown(pad, { key: digit })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('1234')
  })
})

describe('accent wash', () => {
  it('lets the stylesheet choose the wash on the root, so it follows the theme', () => {
    applyAccent('#8b5cf6')
    const style = document.documentElement.style
    // Before: the wash for the theme at that moment was written inline, which
    // outranked the dark block when the system flipped — about 1.1:1 text.
    expect(style.getPropertyValue('--color-accent-soft')).toBe('')
    expect(style.getPropertyValue('--accent-soft-light')).not.toBe('')
    expect(style.getPropertyValue('--accent-soft-dark')).not.toBe('')
  })

  it('still writes the resolved wash on a scoped element', () => {
    const section = document.createElement('section')
    applyAccent('#8b5cf6', section)
    expect(section.style.getPropertyValue('--color-accent-soft')).not.toBe('')
  })
})

describe('cn', () => {
  it.each([
    // Before, the shadow token was read as a shadow colour.
    ['shadow-[var(--shadow-float)] shadow-none', 'shadow-none'],
    ['shadow-[var(--shadow-card)] shadow-lg', 'shadow-lg'],
    ['shadow-[var(--shadow-tile)] shadow-black/20', 'shadow-[var(--shadow-tile)] shadow-black/20'],
    // Before, tailwind-merge 2 did not know these Tailwind v4 names.
    ['text-ink text-shadow-sm', 'text-ink text-shadow-sm'],
    ['bg-accent bg-linear-to-r', 'bg-accent bg-linear-to-r'],
    // And the ordinary merges still happen.
    ['text-ink text-accent', 'text-accent'],
    ['text-[13px] text-sm', 'text-sm'],
  ])('%s → %s', (input, expected) => {
    expect(cn(input)).toBe(expected)
  })
})

describe('charts', () => {
  const geometry = { width: 100, height: 100, padding: { top: 0, right: 0, bottom: 0, left: 0 } }

  it('scales a stacked chart to its totals', () => {
    const series = [
      { id: 'a', label: 'A', values: [40, 60] },
      { id: 'b', label: 'B', values: [50, 70] },
    ]
    // Before: the max was 70, and a stack of 130 drew above the plot.
    expect(chartScale(series, geometry, { stacked: true }).max).toBe(130)
    expect(chartScale(series, geometry).max).toBe(70)
  })

  it('ignores values that are not finite instead of turning everything NaN', () => {
    const scale = chartScale([{ id: 'a', label: 'A', values: [10, Number.NaN, 30] }], geometry)
    expect(scale.max).toBe(30)
    expect(scale.ticks.every(Number.isFinite)).toBe(true)
  })

  it('handles a very long series', () => {
    const values = Array.from({ length: 250_000 }, (_, index) => index)
    // Before: Math.max(...values) threw "Maximum call stack size exceeded".
    expect(chartScale([{ id: 'a', label: 'A', values }], geometry).max).toBe(249_999)
  })

  it('rolls ticks over into the next unit', () => {
    expect(formatTick(999_999)).toBe('1.0m')
    expect(formatTick(1_500_000_000)).toBe('1.5b')
    expect(formatTick(12_400)).toBe('12.4k')
  })

  it('announces a live reading only when it crosses the threshold', () => {
    const threshold = { value: 80, label: 'the limit' }
    const { rerender } = render(<LiveChart label="CPU" values={[10]} threshold={threshold} />)
    const status = screen.getByRole('status')

    // Before: every sample was announced.
    rerender(<LiveChart label="CPU" values={[10, 20]} threshold={threshold} />)
    rerender(<LiveChart label="CPU" values={[10, 20, 30]} threshold={threshold} />)
    expect(status.textContent).toBe('')

    rerender(<LiveChart label="CPU" values={[10, 20, 30, 90]} threshold={threshold} />)
    expect(status.textContent).toBe('CPU: 90, above the limit')
  })

  it('keeps drawing after a sample that is not a number', () => {
    const { container, rerender } = render(<LiveChart label="CPU" values={[10, 20]} />)
    rerender(<LiveChart label="CPU" values={[10, 20, Number.NaN, 30]} />)
    const path = container.querySelector('path[stroke]')?.getAttribute('d') ?? ''
    expect(path).not.toContain('NaN')
    expect(path.length).toBeGreaterThan(0)
  })
})
