import type { ReactNode } from 'react'
import { Compass, Palette, Rocket, WandSparkles } from 'lucide-react'
import { ACCENT_PRESETS, Kbd, Reveal, Text } from 'klyvui'
import { brand } from '../../brand'
import { LandingSection, SectionLink } from './primitives'

/**
 * The path from an idea to a shipped screen, as four steps that each open the
 * tool for that step. It is the page's answer to "how would I actually use
 * this", so every step names something you can go and do right now.
 */
const STEPS: {
  icon: typeof Compass
  title: string
  body: string
  to: string
  link: string
  artifact: ReactNode
}[] = [
  {
    icon: Compass,
    title: 'Find',
    body: 'Search everything with ⌘K, or answer two questions and get the components, screens and recipes that fit.',
    to: '/find',
    link: 'Find My UI',
    artifact: (
      <span className="inline-flex items-center gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    ),
  },
  {
    icon: WandSparkles,
    title: 'Compose',
    body: 'Start from a finished block, or assemble a screen in the Composer from the real components.',
    to: '/composer',
    link: 'Open the Composer',
    artifact: (
      <Text as="span" size="caption" weight="semibold" tone="faint" className="font-mono">
        Card › Field › Input
      </Text>
    ),
  },
  {
    icon: Palette,
    title: 'Theme',
    body: 'Pass one colour. The fill, press state, wash and label colour are derived from it, readable on every hue.',
    to: '/tokens',
    link: 'See the tokens',
    artifact: (
      <span aria-hidden className="flex -space-x-1">
        {ACCENT_PRESETS.slice(0, 5).map((preset) => (
          <span key={preset.id} className="size-4 rounded-full border-2 border-surface" style={{ background: preset.hex }} />
        ))}
      </span>
    ),
  },
  {
    icon: Rocket,
    title: 'Ship',
    body: 'Install the package, or take the source with the CLI — every file a component imports comes with it.',
    to: '/getting-started',
    link: 'Get started',
    artifact: (
      <Text as="span" size="caption" weight="semibold" tone="faint" className="font-mono">
        npx {brand.pkg} add
      </Text>
    ),
  },
]

export function HowItWorks() {
  return (
    <LandingSection
      id="how-it-works"
      eyebrow="How it works"
      index={2}
      title="From idea to shipped screen,"
      tail="in four steps"
      lede="Each step is a tool on this site, built from the same design system as the components themselves."
    >
      <ol className="relative grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* The rail that joins the steps on wide screens, at the height of the
            step icons: the cards cover it, so it shows only in the gaps, as a
            connector from one step to the next. */}
        <span aria-hidden className="absolute left-5 right-5 top-11 hidden h-px bg-line-strong xl:block" />
        {STEPS.map((step, index) => (
          <li key={step.title} className="relative">
            <Reveal
              delay={index * 80}
              className="landing-card flex h-full flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-tile)]"
            >
              <div className="flex items-center gap-3">
                <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink">
                  <step.icon size={17} aria-hidden />
                </span>
                <Text as="span" size="micro" weight="bold" tone="faint" tabular className="uppercase tracking-[0.18em]">
                  Step {index + 1}
                </Text>
              </div>
              <div className="flex flex-col gap-1.5">
                <Text as="h3" size="subtitle">
                  {step.title}
                </Text>
                <Text size="body" weight="medium" tone="soft" className="max-w-[40ch] leading-relaxed">
                  {step.body}
                </Text>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                {step.artifact}
                <SectionLink to={step.to}>{step.link}</SectionLink>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </LandingSection>
  )
}
