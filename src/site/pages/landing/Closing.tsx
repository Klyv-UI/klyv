import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, Reveal, Surface, Text } from 'klyv'
import { blockCount } from '../../data/blocks'
import { componentCountRounded } from '../../data/catalog'
import { InstallCommand } from './primitives'

/** The last ask: one command, and the two places to go next. */
export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="px-3 pb-10 pt-1.5 sm:px-4 sm:pb-14 lg:px-5">
      <Reveal>
        <Surface
          variant="card"
          padding="lg"
          className="relative isolate mx-auto w-full max-w-[1400px] items-center gap-6 overflow-hidden border-transparent bg-accent px-6 py-16 text-center sm:py-24"
        >
          {/* Hairlines in the ink that sits on the accent, fading out behind the
              words: a texture on the slab, never a second colour. */}
          <div aria-hidden className="landing-closing-grid pointer-events-none absolute inset-0 -z-10" />
          <Text
            as="h2"
            id="closing-title"
            size="title"
            className="max-w-[18ch] text-balance text-[32px] leading-[1.02] tracking-[-0.045em] text-accent-ink sm:text-[44px] lg:text-[52px]"
          >
            Ship the first screen today
          </Text>
          <Text size="body" weight="medium" className="max-w-[52ch] text-balance text-[15px] leading-relaxed text-accent-ink sm:text-[16px]">
            Start from one of {blockCount} screens or compose your own from {componentCountRounded} components. Pick
            one colour. Every part of it is yours to copy.
          </Text>
          <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
            <Button
              as={Link}
              to="/getting-started"
              variant="white"
              className="group h-11 px-6 text-[14px] transition-[background-color,transform] active:translate-y-px motion-reduce:transition-none"
            >
              Get started
              <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Button>
            <Link
              to="/composer"
              className="rounded-md text-[13px] font-bold text-accent-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
            >
              Open the Composer
            </Link>
          </div>
          <InstallCommand />
        </Surface>
      </Reveal>
    </section>
  )
}
