import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lightbox, Modal, type LightboxImage } from 'klyv'

/**
 * What overlays promise, exercised through the keyboard.
 *
 * Every assertion here is a claim the docs make in words — Escape closes,
 * focus is trapped and handed back, the page behind does not scroll. Until
 * now nothing checked that any of it was still true.
 */
afterEach(cleanup)

function ModalHarness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Invite</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a member"
        dismissible={dismissible}
      >
        <input aria-label="Email" />
        <button>Send invite</button>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('traps focus, closes on Escape, and hands focus back to the opener', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)

    const opener = screen.getByRole('button', { name: 'Invite' })
    await user.click(opener)

    const dialog = await screen.findByRole('dialog', { name: 'Invite a member' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    // Tab all the way round: focus never leaves the dialog.
    for (let step = 0; step < 6; step += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(opener)
  })

  it('ignores Escape when a choice is required', async () => {
    const user = userEvent.setup()
    render(<ModalHarness dismissible={false} />)

    await user.click(screen.getByRole('button', { name: 'Invite' }))
    await screen.findByRole('dialog')

    await user.keyboard('{Escape}')
    // Give the close animation the time it would have taken.
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })
})

const PHOTOS: LightboxImage[] = [
  { src: 'a.png', alt: 'Dunes at dawn', caption: 'Dawn' },
  { src: 'b.png', alt: 'Lake at noon', caption: 'Noon' },
  { src: 'c.png', alt: 'Hills at dusk', caption: 'Dusk' },
]

function GalleryHarness() {
  const [index, setIndex] = useState<number | null>(null)
  return (
    <>
      {PHOTOS.map((photo, position) => (
        <button key={photo.src} onClick={() => setIndex(position)}>
          {`Open ${photo.alt}`}
        </button>
      ))}
      <Lightbox images={PHOTOS} index={index} onIndexChange={setIndex} label="Photo viewer" />
    </>
  )
}

describe('Lightbox', () => {
  it('moves with the arrow keys, Home and End, and announces the position', async () => {
    const user = userEvent.setup()
    render(<GalleryHarness />)

    await user.click(screen.getByRole('button', { name: 'Open Lake at noon' }))
    const dialog = await screen.findByRole('dialog', { name: 'Photo viewer' })
    expect(screen.getByRole('img', { name: 'Lake at noon' })).toBeTruthy()
    expect(dialog.textContent).toContain('2 / 3')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('img', { name: 'Hills at dusk' })).toBeTruthy()

    // Past the end it wraps rather than stopping dead.
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('img', { name: 'Dunes at dawn' })).toBeTruthy()

    await user.keyboard('{End}')
    expect(screen.getByRole('img', { name: 'Hills at dusk' })).toBeTruthy()
    await user.keyboard('{Home}')
    expect(screen.getByRole('img', { name: 'Dunes at dawn' })).toBeTruthy()

    const status = dialog.querySelector('[role="status"]')
    expect(status?.textContent).toBe('Image 1 of 3: Dawn')
  })

  it('locks the page behind it, and gives focus back on Escape', async () => {
    const user = userEvent.setup()
    render(<GalleryHarness />)

    const opener = screen.getByRole('button', { name: 'Open Dunes at dawn' })
    await user.click(opener)
    await screen.findByRole('dialog', { name: 'Photo viewer' })
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(document.activeElement).toBe(opener)
  })

  it('shows nothing at all when closed', () => {
    const onIndexChange = vi.fn()
    render(<Lightbox images={PHOTOS} index={null} onIndexChange={onIndexChange} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onIndexChange).not.toHaveBeenCalled()
  })
})
