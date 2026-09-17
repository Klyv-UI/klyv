import { act, fireEvent, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioVisualizer, Field, HoldToConfirm, Input, QRCode, Textarea, TwoFactorSetup } from 'citrine'

/**
 * One test per defect from the production-readiness audit that was fixed in a
 * single component. Each was reproduced against the old code first; the
 * comment on each says what used to happen.
 */
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Field', () => {
  it('keeps a child’s own disabled, required and aria-describedby', () => {
    render(
      <>
        <p id="own-hint">Work address only</p>
        <Field label="Email" hint="We never share it">
          <Input disabled required aria-describedby="own-hint" />
        </Field>
      </>,
    )
    const input = screen.getByLabelText('Email') as HTMLInputElement

    // Before: cloned with `disabled: undefined`, which overwrote the child's
    // `disabled` — the input came out editable, optional and undescribed.
    expect(input.disabled).toBe(true)
    expect(input.required).toBe(true)

    const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(describedBy).toContain('own-hint')
    // …and Field's own hint is linked as well, not instead.
    expect(describedBy).toHaveLength(2)
    expect(document.getElementById(describedBy[1])?.textContent).toContain('We never share it')
  })

  it('labels a control by the id it already has', () => {
    render(
      <Field label="Company">
        <Input id="company-name" />
      </Field>,
    )
    expect(screen.getByLabelText('Company').id).toBe('company-name')
  })
})

describe('HoldToConfirm', () => {
  // jsdom stamps animation frames from a different clock than performance.now()
  // — 146ms against 2782ms in a probe — and the component compares the two, so
  // under jsdom a hold never completed and the "does not fire" tests below
  // would have passed on the broken code too. Browsers use one clock for both.
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16),
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  })

  it('does not fire when focus leaves mid-hold', async () => {
    const onConfirm = vi.fn()
    render(<HoldToConfirm label="Delete project" onConfirm={onConfirm} duration={60} />)
    const button = screen.getByRole('button')

    // Space goes down on the button, focus moves away, and the keyup lands on
    // whatever took focus. Before: the hold never ended, and the action fired
    // with nobody holding it.
    fireEvent.keyDown(button, { key: ' ' })
    fireEvent.blur(button)

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not fire when the window loses focus mid-hold', async () => {
    const onConfirm = vi.fn()
    render(<HoldToConfirm label="Delete project" onConfirm={onConfirm} duration={60} />)

    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('still fires for a hold that is actually held', async () => {
    // The control for the two above: without it they would pass on a button
    // that never fires at all.
    const onConfirm = vi.fn()
    render(<HoldToConfirm label="Delete project" onConfirm={onConfirm} duration={60} />)

    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1), { timeout: 1000 })
  })
})

describe('AudioVisualizer', () => {
  it('releases the microphone when it unmounts', async () => {
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }, { stop }] }
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn(async () => stream) },
    })

    const node = () => ({ connect: vi.fn(), disconnect: vi.fn() })
    class FakeAudioContext {
      destination = {}
      createAnalyser() {
        return { ...node(), fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 0, getByteFrequencyData() {} }
      }
      createMediaStreamSource() {
        return node()
      }
      resume = vi.fn(async () => {})
      close = vi.fn(async () => {})
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)

    const user = userEvent.setup()
    const { unmount } = render(<AudioVisualizer microphone label="Input level" />)
    await user.click(screen.getByRole('button', { name: 'Use the microphone' }))
    await screen.findByRole('button', { name: 'Listening' })

    unmount()
    // Before: only the AudioContext was closed. That does not release a
    // MediaStream — the browser went on recording, indicator lit.
    expect(stop).toHaveBeenCalledTimes(2)
  })
})

describe('TwoFactorSetup', () => {
  const props = {
    otpauthUrl: 'otpauth://totp/Acme:ada@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Acme',
    secret: 'JBSWY3DPEHPK3PXP',
    onVerify: async () => false as const,
    onComplete: () => {},
  }

  it('does not draw the mock QRCode for a real enrolment', () => {
    render(<TwoFactorSetup {...props} />)
    // Before: the otpauth URI went to QRCode, which draws a pattern no
    // authenticator can scan.
    expect(screen.queryByRole('img', { name: /QR code/i })).toBeNull()
    expect(screen.getByRole('link', { name: 'Open in authenticator app' }).getAttribute('href')).toBe(
      props.otpauthUrl,
    )
  })

  it('shows a real code when one is supplied', () => {
    render(<TwoFactorSetup {...props} qrCode={<img alt="Scan with your authenticator" src="data:," />} />)
    expect(screen.getByRole('img', { name: 'Scan with your authenticator' })).toBeTruthy()
  })
})

describe('QRCode', () => {
  it('does not put its value in the accessible name', () => {
    const secret = 'otpauth://totp/Acme?secret=JBSWY3DPEHPK3PXP'
    const { container } = render(<QRCode value={secret} />)
    const labelled = container.querySelector('[aria-label]')
    // Before: "QR code for otpauth://totp/Acme?secret=…" — the 2FA secret,
    // readable by anything that reads the accessibility tree.
    expect(labelled?.getAttribute('aria-label')).toBe('QR code')
  })
})

describe('focus visibility', () => {
  // jsdom does not cascade layered stylesheets, so the ring itself is checked
  // in the browser. What can be checked here is the class that used to switch
  // it off: `outline-none` is a utility, it outranks the base :focus-visible
  // rule, and on these fields it left a 1.1:1 border change as the only cue.
  it('does not switch off the focus ring on a text field', () => {
    render(
      <>
        <Input aria-label="Name" />
        <Textarea aria-label="Notes" />
      </>,
    )
    expect(screen.getByLabelText('Name').className).not.toMatch(/\boutline-none\b/)
    expect(screen.getByLabelText('Notes').className).not.toMatch(/\boutline-none\b/)
  })
})
