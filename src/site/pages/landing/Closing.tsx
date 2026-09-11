import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, Reveal, Surface, Text } from 'citrine'
import { blockCount } from '../../data/blocks'
import { componentCountRounded } from '../../data/catalog'
import { InstallCommand } from './primitives'

/** The last ask: one command, and the two places to go next. */
export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="mx-auto w-full max-w-[1400px] px-5 pb-24 pt-8 lg:px-8">
      <Reveal>
        <Surface variant="card" padding="lg" className="items-center gap-6 overflow-hidden bg-accent px-6 py-16 text-center sm:py-24">
          <Text as="h2" id="closing-title" size="title" className="max-w-[20ch] text-balance text-accent-ink sm:text-[40px] sm:leading-[1.05]">
            Ship the first screen today
          </Text>
          <Text size="body" weight="medium" leading="normal" className="max-w-[52ch] text-balance text-accent-ink sm:text-[15px]">
            Start from one of {blockCount} screens or compose your own from {componentCountRounded} components. Pick
            one colour. Every part of it is yours to copy.
          </Text>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Button as={Link} to="/getting-started" variant="white">
              Get started
              <ArrowRight size={14} aria-hidden />
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
