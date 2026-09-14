import { Bot, Keyboard, Package, Palette } from 'lucide-react'
import { Reveal, Surface, Text } from 'citrine'
import { componentEvidence } from '../../data/evidence'
import { mcpTools } from '../../data/mcp'
import { LandingSection } from './primitives'

const axeClean = Object.values(componentEvidence).filter((entry) => entry.axe).length

/**
 * Why this library, in four reasons — each one with the number that backs it,
 * because a reason without evidence is a slogan.
 */
const REASONS = [
  {
    icon: Palette,
    title: 'One colour themes everything',
    body: 'Four tokens are derived from a single hue: the fill, its press state, a wash, and the text on top. No component hard-codes a colour, so a rebrand is one function call.',
    value: '4.5:1',
    unit: 'minimum contrast, on any hue',
  },
  {
    icon: Keyboard,
    title: 'Accessible, and tested to prove it',
    body: 'Every component page is audited with axe, keyboard paths are driven in tests, and anything that moves has a still state. The build fails when a rule slips.',
    value: String(axeClean),
    unit: 'components pass axe',
  },
  {
    icon: Package,
    title: 'Yours to own',
    body: 'Install the package, or copy the source with the CLI — dependencies resolved, imports intact. ESM, one module per component, nothing to configure.',
    value: '2',
    unit: 'runtime dependencies',
  },
  {
    icon: Bot,
    title: 'Readable by your coding agent',
    body: 'An MCP server and an Agent Skill ship in the package, so an agent reads the real props, tokens and screens instead of guessing at them.',
    value: String(mcpTools.length),
    unit: 'MCP tools',
  },
]

export function Why() {
  return (
    <LandingSection
      id="why"
      eyebrow="Why Citrine"
      title="A design system you can adopt this week, and still trust next year"
      lede="Most component libraries are quick to start and slow to live with. These are the four things that decide which kind a library is."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REASONS.map((reason, index) => (
          <Reveal key={reason.title} delay={index * 60} className="h-full">
            <Surface variant="card" padding="lg" className="landing-card h-full gap-5 p-6">
              {/* The wash rather than the fill: four solid accent squares in a row
                  shouted over the headings they were meant to mark. */}
              <span
                aria-hidden
                className="grid size-10 place-items-center rounded-[var(--radius-glyph)] bg-accent-soft text-ink ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-accent-strong)_35%,transparent)]"
              >
                <reason.icon size={18} strokeWidth={2} />
              </span>
              <div className="flex flex-col gap-2">
                <Text as="h3" size="heading" className="text-[16px] leading-snug">
                  {reason.title}
                </Text>
                <Text size="body" weight="medium" tone="soft" className="leading-relaxed">
                  {reason.body}
                </Text>
              </div>
              <div className="mt-auto flex items-baseline gap-2 border-t border-line pt-5">
                <Text as="span" size="title" tabular className="text-[28px] tracking-[-0.045em]">
                  {reason.value}
                </Text>
                <Text as="span" size="caption" weight="semibold" tone="faint">
                  {reason.unit}
                </Text>
              </div>
            </Surface>
          </Reveal>
        ))}
      </div>
    </LandingSection>
  )
}
