import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ACCENT_PRESETS, Badge, Button, Text, VisuallyHidden, applyAccent, cn, saveAccent } from 'klyv'
import { useAccent } from '../../components/useTheme'
import { blockCount } from '../../data/blocks'
import { componentCount } from '../../data/catalog'
import { InstallCommand, enter } from './primitives'
import { HeroStack } from './Workbench'

/**
 * The hero: a stage inset under the header, on the page's own theme — light
 * on a light page, dark on a dark one.
 *
 * On the left, the statement and the ways in; on the right, real components
 * tilted back into the stage and running off its edge.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-3 pb-6 pt-2 sm:px-4 sm:pb-8 lg:px-5">
      <div className="relative isolate overflow-hidden rounded-[var(--radius-window)] border border-line bg-[color-mix(in_oklab,var(--color-surface)_55%,var(--color-canvas))] text-ink shadow-[var(--shadow-window)]">
        {/* A hairline grid, strongest behind the components. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background-image:linear-gradient(var(--color-line-strong)_1px,transparent_1px),linear-gradient(90deg,var(--color-line-strong)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(60%_70%_at_75%_45%,#000_10%,transparent_75%)]"
        />
        <div aria-hidden className="landing-grain pointer-events-none absolute inset-0 -z-10" />
        {/* The spotlight: the accent falling on the components, and a low
            reflection of it under the statement. */}
        <div
          aria-hidden
          className="landing-drift pointer-events-none absolute -inset-[10%] -z-10 bg-[radial-gradient(36%_42%_at_72%_46%,color-mix(in_oklab,var(--color-accent)_20%,transparent),transparent_72%),radial-gradient(30%_32%_at_12%_100%,color-mix(in_oklab,var(--color-accent-soft)_70%,transparent),transparent_70%)]"
        />
        {/* A lit top edge, brightest in the middle. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_10%,color-mix(in_oklab,var(--color-accent)_55%,transparent)_50%,transparent_90%)]"
        />

        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-12 px-6 py-14 sm:px-10 sm:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8 lg:px-14 lg:py-24">
          <div className="flex min-w-0 flex-col items-start">
            <a
              href="#platform"
              style={enter(0)}
              className="landing-enter group inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Badge>New</Badge>
              <Text as="span" size="label" weight="semibold" tone="soft" truncate className="text-[11px] sm:text-[12px]">
                Composer, smart search<span className="hidden sm:inline"> and a personal workspace</span>
              </Text>
              <ArrowRight size={13} aria-hidden className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </a>

            <h1
              id="hero-title"
              style={enter(60)}
              className="landing-enter mt-7 text-balance text-[38px] font-extrabold leading-[0.96] tracking-[-0.055em] text-ink sm:text-[56px] lg:max-w-[15ch] lg:text-[58px] xl:text-[68px]"
            >
              Production React UI, themed by{' '}
              {/* A flat marker under the words rather than coloured words: the
                  accent is the subject of the sentence, and a bright hue set as
                  text on a light page would not be readable. It draws in once. */}
              <span className="relative isolate whitespace-nowrap">
                <span
                  aria-hidden
                  className="landing-mark absolute inset-x-[-0.06em] bottom-[0.05em] -z-10 h-[0.32em] rounded-[0.08em] bg-accent"
                />
                one colour
              </span>
            </h1>

            <Text
              size="body"
              weight="medium"
              tone="soft"
              style={enter(120)}
              className="landing-enter mt-6 max-w-[48ch] text-pretty text-[16px] leading-[1.65] sm:text-[18px]"
            >
              {componentCount} accessible components and {blockCount} finished screens. Install them, copy them as
              source, or assemble them in the Composer — then change one colour and every one of them follows.
            </Text>

            <div style={enter(180)} className="landing-enter mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button
                as={Link}
                to="/getting-started"
                className="group h-11 px-6 text-[14px] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-accent)_45%,#ffffff),0_12px_32px_-12px_color-mix(in_oklab,var(--color-accent)_70%,transparent)] transition-[background-color,box-shadow,transform] hover:shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-accent)_45%,#ffffff),0_16px_40px_-12px_color-mix(in_oklab,var(--color-accent)_80%,transparent)] active:translate-y-px motion-reduce:transition-none"
              >
                Get started
                <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Button>
              <Button
                as={Link}
                to="/composer"
                variant="outline"
                className="h-11 px-6 text-[14px] transition-[background-color,transform] active:translate-y-px motion-reduce:transition-none"
              >
                Open the Composer
              </Button>
            </div>

            <div style={enter(220)} className="landing-enter mt-4 w-full sm:w-auto">
              <InstallCommand className="w-full sm:w-auto" />
            </div>

            {/* The headline's claim, one click away: pick a hue and the stage —
                and the rest of the page — repaints. */}
            <div
              style={enter(260)}
              className="landing-enter mt-10 flex w-full flex-col items-start gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:gap-4"
            >
              <Text as="span" size="label" weight="semibold" tone="soft">
                Try a colour
              </Text>
              <AccentSwatches />
            </div>
          </div>

          <HeroStack />
        </div>
      </div>
    </section>
  )
}

/** Every preset as a swatch. A click repaints the page and is remembered. */
function AccentSwatches() {
  const hex = useAccent()

  return (
    // 24px swatches with a 6px gap keep all ten presets on one row inside the
    // stage's padding at 360px and up; 24px is still the minimum touch target.
    <div role="group" aria-label="Accent colour" className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {ACCENT_PRESETS.map((preset) => {
        const active = preset.hex.toLowerCase() === hex.toLowerCase()
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            title={preset.name}
            onClick={() => {
              applyAccent(preset.hex)
              saveAccent(preset.hex)
            }}
            className={cn(
              'size-6 rounded-full border border-black/10 transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none motion-reduce:hover:scale-100 sm:size-6',
              active && 'ring-2 ring-ink ring-offset-2 ring-offset-canvas',
            )}
            style={{ background: preset.hex }}
          >
            <VisuallyHidden>{preset.name}</VisuallyHidden>
          </button>
        )
      })}
    </div>
  )
}
