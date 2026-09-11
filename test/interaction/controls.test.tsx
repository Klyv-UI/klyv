import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl, Tabs, ToggleGroup } from 'citrine'

afterEach(cleanup)

function ToggleHarness({ type = 'multiple' as 'single' | 'multiple' }) {
  const [value, setValue] = useState<string[]>([])
  return (
    <>
      <ToggleGroup
        label="Text style"
        type={type}
        value={value}
        onValueChange={setValue}
        items={[
          { value: 'bold', label: 'Bold' },
          { value: 'italic', label: 'Italic' },
          { value: 'underline', label: 'Underline', disabled: true },
        ]}
      />
      <p>{`pressed: ${value.join(',') || 'none'}`}</p>
    </>
  )
}

describe('ToggleGroup', () => {
  it('announces each toggle as pressed or not, and allows any combination', async () => {
    const user = userEvent.setup()
    render(<ToggleHarness />)

    const bold = screen.getByRole('button', { name: 'Bold' })
    const italic = screen.getByRole('button', { name: 'Italic' })
    expect(bold.getAttribute('aria-pressed')).toBe('false')

    await user.click(bold)
    await user.click(italic)
    expect(bold.getAttribute('aria-pressed')).toBe('true')
    expect(italic.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('pressed: bold,italic')).toBeTruthy()

    await user.click(bold)
    expect(bold.getAttribute('aria-pressed')).toBe('false')
  })

  it('in single mode keeps one at most, and lets it be switched off again', async () => {
    const user = userEvent.setup()
    render(<ToggleHarness type="single" />)

    await user.click(screen.getByRole('button', { name: 'Bold' }))
    await user.click(screen.getByRole('button', { name: 'Italic' }))
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('pressed: italic')).toBeTruthy()

    // The difference from SegmentedControl: none pressed is a valid state.
    await user.click(screen.getByRole('button', { name: 'Italic' }))
    expect(screen.getByText('pressed: none')).toBeTruthy()
  })

  it('does not act on a disabled toggle', async () => {
    const user = userEvent.setup()
    render(<ToggleHarness />)
    await user.click(screen.getByRole('button', { name: 'Underline' }))
    expect(screen.getByText('pressed: none')).toBeTruthy()
  })
})

function SegmentedHarness() {
  const [value, setValue] = useState('week')
  return (
    <SegmentedControl
      label="Range"
      value={value}
      onValueChange={setValue}
      options={[
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
        { value: 'year', label: 'Year' },
      ]}
    />
  )
}

describe('SegmentedControl', () => {
  it('is a radio group where only the chosen option is a tab stop', async () => {
    const user = userEvent.setup()
    render(<SegmentedHarness />)

    screen.getByRole('radiogroup', { name: 'Range' })
    const week = screen.getByRole('radio', { name: 'Week' })
    const month = screen.getByRole('radio', { name: 'Month' })
    expect(week.getAttribute('aria-checked')).toBe('true')
    expect(week.getAttribute('tabindex')).toBe('0')
    expect(month.getAttribute('tabindex')).toBe('-1')

    // Tab reaches the group once, then the arrows move within it.
    await user.tab()
    expect(document.activeElement).toBe(week)

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Month' }).getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Month' }))

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Week' }).getAttribute('aria-checked')).toBe('true')
  })
})

function TabsHarness() {
  const [value, setValue] = useState('profile')
  return (
    <Tabs
      label="Settings sections"
      value={value}
      onValueChange={setValue}
      items={[
        { value: 'profile', label: 'Profile', content: <p>Who you are</p> },
        { value: 'alerts', label: 'Notifications', content: <p>What reaches you</p> },
        { value: 'billing', label: 'Billing', content: <p>Your plan</p> },
      ]}
    />
  )
}

describe('Tabs', () => {
  it('moves with the arrow keys, Home and End, and shows only the open panel', async () => {
    const user = userEvent.setup()
    render(<TabsHarness />)

    screen.getByRole('tablist', { name: 'Settings sections' })
    expect(screen.getByText('Who you are')).toBeTruthy()
    expect(screen.queryByText('Your plan')).toBeNull()

    const profile = screen.getByRole('tab', { name: 'Profile' })
    expect(profile.getAttribute('aria-selected')).toBe('true')
    profile.focus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Notifications' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('What reaches you')).toBeTruthy()

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Billing' }).getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Profile' }).getAttribute('aria-selected')).toBe('true')
  })

  it('ties each panel to the tab that opens it', () => {
    render(<TabsHarness />)
    const tab = screen.getByRole('tab', { name: 'Profile' })
    const panel = screen.getByRole('tabpanel')
    expect(tab.getAttribute('aria-controls')).toBe(panel.getAttribute('id'))
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.getAttribute('id'))
  })
})
