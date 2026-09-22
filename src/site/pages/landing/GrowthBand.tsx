import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge, Button, LazyMount, ReactionDiffusion, Reveal, Text } from 'klyvui'
import { SHOWPIECE_COMPONENTS } from '../../data/catalog'

/**
 * A full-width band after the showpieces: one of them, running large, with
 * the claim written over it.
 *
 * The pattern is `ReactionDiffusion` growing coral in the accent. The words
 * sit over a pool of the page's own ground and let the pointer through, so
 * moving across them seeds new growth; the buttons take the pointer back. The
 * stage mounts only near the viewport and is dropped again once scrolled
 * past, so its GPU loop never runs unseen.
 */
export function GrowthBand() {
  return (
    <section aria-labelledby="growth-title" className="px-3 py-1.5 sm:px-4 lg:px-5">
      <Reveal>
        <div className="relative isolate mx-auto w-full max-w-[1400px] overflow-hidden rounded-[var(--radius-window)] border border-line bg-surface shadow-[var(--shadow-window)]">
          <LazyMount rootMargin="200px" minHeight={480} unmountWhenHidden className="absolute inset-0 -z-10">
            <ReactionDiffusion preset="coral" contain={false} speed={10} label="Coral growing in the accent colour" className="size-full" />
          </LazyMount>
          <div aria-hidden className="landing-stage-scrim pointer-events-none absolute inset-0 -z-10" />

          <div className="pointer-events-none flex min-h-[480px] flex-col items-center justify-center gap-5 px-6 py-16 text-center sm:min-h-[520px] sm:py-20">
            <Badge>Showpiece</Badge>
            <Text
              as="h2"
              id="growth-title"
              size="title"
              className="max-w-[18ch] text-balance text-[32px] leading-[1.02] tracking-[-0.045em] sm:text-[44px] lg:text-[56px]"
            >
              Grown, not drawn
            </Text>
            <Text size="body" weight="medium" tone="soft" className="max-w-[54ch] text-balance text-[15px] leading-relaxed sm:text-[16px]">
              Behind these words is <code className="font-mono text-ink">ReactionDiffusion</code>: two chemicals feeding
              and consuming each other on the GPU, coloured by the same accent as every button on this page. Move the
              pointer across it to seed new growth.
            </Text>
            <div className="pointer-events-auto mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <Button
                as={Link}
                to="/components/reaction-diffusion"
                className="group h-11 px-6 text-[14px] transition-[background-color,transform] active:translate-y-px motion-reduce:transition-none"
              >
                Open ReactionDiffusion
                <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Button>
              <Button as={Link} to="/components?showpiece=1" variant="outline" className="h-11 px-6 text-[14px]">
                All {SHOWPIECE_COMPONENTS.size} showpieces
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
