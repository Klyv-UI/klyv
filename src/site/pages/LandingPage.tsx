import { useEffect } from 'react'
import { AnchorNav } from 'klyv'
import { Assistant } from './landing/Assistant'
import { Closing } from './landing/Closing'
import { Developer } from './landing/Developer'
import { Hero } from './landing/Hero'
import { HowItWorks } from './landing/HowItWorks'
import { Parts } from './landing/Parts'
import { Platform } from './landing/Platform'
import { Proof } from './landing/Proof'
import { Quality } from './landing/Quality'
import { Screens } from './landing/Screens'
import { Showpieces } from './landing/Showpieces'
import { Theming } from './landing/Theming'
import { Why } from './landing/Why'
import { Workspace } from './landing/Workspace'
import './landing/landing.css'

/**
 * The front page.
 *
 * It answers a visitor's questions in the order they ask them: what is this
 * (a centred statement, and a workbench of real components the reader can
 * repaint), why this one, how would I use it, can it build a real screen,
 * what else comes with it, what is in the range, how far does the range go,
 * how will I find the right part in it, can I make it mine, how does it feel
 * in code, can I trust it in production — and then one command to start.
 *
 * Every specimen on it is a real component, running — not a screenshot and not
 * a mock. That is the entire argument the page is making, so faking any part
 * of it would be self-defeating. The one thing on the page that is not live
 * yet is the assistant's understanding, and that section says so on its face,
 * twice, rather than letting a visitor assume otherwise. Each section lives in
 * `./landing`.
 */
export default function LandingPage() {
  // Arriving from another page with a section in the URL — the header's
  // Assistant mark does exactly that. The browser scrolls to a hash on a cold
  // load, but a client-side navigation lands before this page has mounted, so
  // there is nothing to scroll to yet. One pass after mount puts that right.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const target = document.getElementById(id)
    target?.scrollIntoView({ block: 'start' })
  }, [])

  // One listener lights every card: it writes the pointer's position onto the
  // card beneath it, and landing.css draws the spotlight there. Mouse and pen
  // only — on touch there is no hover for the light to follow.
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const onMove = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest<HTMLElement>('.landing-card')
      if (!card) return
      const box = card.getBoundingClientRect()
      card.style.setProperty('--spot-x', `${event.clientX - box.left}px`)
      card.style.setProperty('--spot-y', `${event.clientY - box.top}px`)
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => document.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <>
      <Hero />
      <Proof />
      {/* The numbered sections share one wrapper, so the section pill starts
          where they start, sticks for exactly that stretch, and no further. */}
      <div>
        <SectionNav />
        <Why />
        <HowItWorks />
        <Screens />
        <Platform />
        <Parts />
        <Showpieces />
        <Assistant />
        <Theming />
        <Developer />
        <Workspace />
        <Quality />
        <Closing />
      </div>
    </>
  )
}

/** The sections, in page order — the same order their eyebrows number. */
const ON_THIS_PAGE = [
  { id: 'why', label: 'Why' },
  { id: 'how-it-works', label: 'How' },
  { id: 'screens', label: 'Screens' },
  { id: 'platform', label: 'Platform' },
  { id: 'components', label: 'Components' },
  { id: 'showpieces', label: 'Showpieces' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'theming', label: 'Theming' },
  { id: 'developers', label: 'Code' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'quality', label: 'Quality' },
]

/**
 * A floating pill of the page's sections, pinned under the header from `lg`.
 *
 * It sits in a zero-height sticky strip, so it floats over the sections
 * instead of pushing them down, and only the pill itself takes the pointer.
 * `items-start`, because a flex row stretches its children to its own height,
 * and at zero that flattened the pill to its padding.
 */
function SectionNav() {
  return (
    <div className="pointer-events-none sticky top-[84px] z-30 hidden h-0 items-start justify-center lg:flex">
      <AnchorNav
        items={ON_THIS_PAGE}
        orientation="horizontal"
        offset={170}
        label="On this page"
        className="pointer-events-auto mt-1 rounded-full border border-line bg-[color-mix(in_oklab,var(--color-surface)_80%,transparent)] p-1 shadow-[var(--shadow-float)] backdrop-blur-xl [&_a]:rounded-full [&_a]:px-3 [&_ul]:flex-nowrap [&_ul]:gap-0.5"
      />
    </div>
  )
}
