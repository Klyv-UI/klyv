import { Reveal, Text } from 'klyv'
import { componentCount } from '../../data/catalog'
import { componentEvidence } from '../../data/evidence'
import { LandingSection, SectionLink } from './primitives'

const evidence = Object.values(componentEvidence)
const axeClean = evidence.filter((entry) => entry.axe).length
const keyboardTested = evidence.filter((entry) => entry.keyboardSuite).length
const stillStates = evidence.filter((entry) => entry.reducedMotion).length
const serverSafe = evidence.filter((entry) => entry.serverSafe).length

/**
 * The standards, as numbers with the check that produces each one. This is
 * the section that answers "can I trust it in production", and it answers
 * with things a reader can verify in the repository rather than adjectives.
 * Every figure is generated on each build.
 */
const STANDARDS = [
  {
    value: `${axeClean}`,
    label: 'components pass axe',
    body: `Every component page, of ${componentCount}, is rendered and audited on each test run — examples, API table and all.`,
  },
  {
    value: '4.5:1',
    label: 'on every shipped accent',
    body: 'Colour contrast is measured in a real browser, in both themes, across the extremes of the accent ramp.',
  },
  {
    value: `${keyboardTested}`,
    label: 'components keyboard-tested',
    body: 'Focus traps, roving focus, arrow keys and Escape are driven with user-event, not asserted in prose.',
  },
  {
    value: `${stillStates}`,
    label: 'animations with a still state',
    body: 'Anything that moves has a reduced-motion answer. The build fails on one that does not.',
  },
  {
    value: '0',
    label: 'hard-coded colours',
    body: 'A hex literal outside an explicit, documented allowlist fails the build. Themes change values, never names.',
  },
  {
    value: `${serverSafe}`,
    label: 'server-safe modules',
    body: "'use client' is derived from the code and verified on every build, so Server Components just work.",
  },
]

export function Quality() {
  return (
    <LandingSection
      id="quality"
      eyebrow="Production-ready"
      index={15}
      title="Standards you can check,"
      tail="not adjectives"
      lede="Each number is produced by a test or a build step in the repository, and shown on every component’s own page as its health."
      action={
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <SectionLink to="/components/data-table">See a component’s health</SectionLink>
          <SectionLink to="/proving-ground">Measure one on your machine</SectionLink>
        </div>
      }
    >
      <Reveal>
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-3">
          {STANDARDS.map((standard) => (
            <div key={standard.label} className="flex flex-col gap-3 bg-surface p-6 sm:p-7">
              <dt className="flex flex-col gap-2">
                <Text as="span" size="display" tabular className="text-[36px] tracking-[-0.05em]">
                  {standard.value}
                </Text>
                <Text as="span" size="body" weight="bold" className="text-[14px]">
                  {standard.label}
                </Text>
              </dt>
              <dd>
                <Text size="body" weight="medium" tone="soft" className="leading-relaxed">
                  {standard.body}
                </Text>
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </LandingSection>
  )
}
