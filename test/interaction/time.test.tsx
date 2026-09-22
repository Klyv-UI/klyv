import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { Countdown, RelativeTime } from 'klyvui'

/**
 * Both of these components tell the time, which makes them the two that a
 * test suite has to freeze it for.
 */
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

/**
 * Moves the clock the way a browser does: one interval at a time.
 *
 * Both components schedule the next tick from an effect, and React only runs
 * effects when an act block finishes — so advancing an hour inside one block
 * fires exactly one timer. Stepping gives each tick its own flush, which is
 * what really happens when every timeout lands on its own task.
 */
async function tick(total: number, step: number) {
  for (let elapsed = 0; elapsed < total; elapsed += step) {
    // eslint-disable-next-line no-await-in-loop -- the point is to serialise
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step)
    })
  }
}

describe('Countdown', () => {
  it('counts down, spells the remainder out, and calls back exactly once', async () => {
    const onComplete = vi.fn()
    render(
      <Countdown
        to={Date.now() + 3_000}
        label="Early-bird pricing ends"
        units={['minutes', 'seconds']}
        onComplete={onComplete}
      />,
    )

    // A timer, not a live region: silent until read, and read in words. Units
    // that are zero are left out rather than announced as "0 minutes".
    const timer = screen.getByRole('timer')
    expect(timer.getAttribute('aria-label')).toBe('Early-bird pricing ends: 3 seconds remaining')

    await tick(2_000, 1_000)
    expect(screen.getByRole('timer').getAttribute('aria-label')).toContain('1 second remaining')
    expect(onComplete).not.toHaveBeenCalled()

    await tick(2_000, 1_000)
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe(
      'Early-bird pricing ends: ended',
    )
    expect(onComplete).toHaveBeenCalledOnce()

    // Still once, however long the page stays open afterwards.
    await tick(10_000, 1_000)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('settles at zero for a moment already past', () => {
    render(<Countdown to={Date.now() - 60_000} label="Offer" units={['minutes', 'seconds']} />)
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('Offer: ended')
  })
})

describe('RelativeTime', () => {
  it('phrases the distance and keeps the exact moment in the markup', () => {
    const when = new Date(Date.now() - 12 * 60_000)
    render(<RelativeTime date={when} locale="en" />)

    const time = screen.getByText('12 minutes ago')
    expect(time.tagName).toBe('TIME')
    // The phrase is the convenience; the precise value is never lost.
    expect(time.getAttribute('datetime')).toBe(when.toISOString())
    expect(time.getAttribute('title')).toBeTruthy()
  })

  it('catches up as time passes', async () => {
    // `time` has no ARIA role, so the element is read straight from the DOM.
    const phrase = () => document.querySelector('time')?.textContent
    render(<RelativeTime date={Date.now() - 60_000} locale="en" />)
    expect(phrase()).toBe('1 minute ago')

    // It re-phrases every thirty seconds within the hour.
    await tick(9 * 60_000, 30_000)
    expect(phrase()).toBe('10 minutes ago')
  })

  it('stops re-phrasing when asked to', async () => {
    const phrase = () => document.querySelector('time')?.textContent
    render(<RelativeTime date={Date.now() - 60_000} locale="en" live={false} />)
    expect(phrase()).toBe('1 minute ago')

    await tick(30 * 60_000, 30_000)
    expect(phrase()).toBe('1 minute ago')
  })

  it('uses the locale it is given', () => {
    render(<RelativeTime date={Date.now() - 3 * 3_600_000} locale="de" />)
    expect(screen.getByText(/vor 3 Stunden/)).toBeTruthy()
  })
})
