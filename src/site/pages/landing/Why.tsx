import { Bot, Keyboard, Package, Palette } from 'lucide-react'
import { Reveal, Surface, Text, cn, deriveAccent } from 'klyvui'
import { useAccent } from '../../components/useTheme'
import { componentEvidence } from '../../data/evidence'
import { mcpTools } from '../../data/mcp'
import { LandingSection, TokenSwatch } from './primitives'

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
    body: 'Install the package, or copy the source with the CLI — dependencies resolved, imports intact.',
    value: '2',
    unit: 'runtime dependencies',
  },
  {
    icon: Bot,
    title: 'Readable by your agent',
    body: 'An MCP server and an Agent Skill ship in the package, so an agent reads the real props and tokens.',
    value: String(mcpTools.length),
    unit: 'MCP tools',
  },
]

const [LEAD, ...REST] = REASONS

/**
 * An asymmetric bento: the theming reason large, because it is the library's
 * thesis, carrying the four tokens the current accent derives — pick another
 * hue in the hero and they change here too. The other three share the rest.
 */
export function Why() {
  const family = deriveAccent(useAccent())

  return (
    <LandingSection
      id="why"
      index={1}
      eyebrow="Why Klyv"
      title="A design system you can adopt this week,"
      tail="and still trust next year"
      lede="Most component libraries are quick to start and slow to live with. These are the four things that decide which kind a library is."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal className="sm:col-span-2 lg:row-span-2">
          <Surface variant="card" padding="lg" className="landing-card h-full gap-8 p-7 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-2">
                <Text as="span" size="display" tabular className="text-[64px] tracking-[-0.06em] sm:text-[80px]">
                  {LEAD.value}
                </Text>
                <Text as="span" size="label" weight="semibold" tone="faint">
                  {LEAD.unit}
                </Text>
              </div>
              <ReasonIcon icon={LEAD.icon} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TokenSwatch token="--color-accent" value={family.accent} />
              <TokenSwatch token="--color-accent-strong" value={family.strong} />
              <TokenSwatch token="--color-accent-soft" value={family.soft} />
              <TokenSwatch token="--color-accent-ink" value={family.ink} />
            </div>
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-6">
              <Text as="h3" size="subtitle" className="text-[22px] leading-snug">
                {LEAD.title}
              </Text>
              <Text size="body" weight="medium" tone="soft" className="max-w-[52ch] text-[14px] leading-relaxed">
                {LEAD.body}
              </Text>
            </div>
          </Surface>
        </Reveal>

        {REST.map((reason, index) => (
          <Reveal key={reason.title} delay={(index + 1) * 60} className={cn('h-full', index === 0 && 'sm:col-span-2')}>
            <Surface variant="card" padding="lg" className="landing-card h-full gap-6 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Text as="span" size="display" tabular className="text-[40px] tracking-[-0.05em]">
                    {reason.value}
                  </Text>
                  <Text as="span" size="label" weight="semibold" tone="faint">
                    {reason.unit}
                  </Text>
                </div>
                <ReasonIcon icon={reason.icon} />
              </div>
              <div className="mt-auto flex flex-col gap-2">
                <Text as="h3" size="heading" className="text-[16px] leading-snug">
                  {reason.title}
                </Text>
                <Text size="body" weight="medium" tone="soft" className="leading-relaxed">
                  {reason.body}
                </Text>
              </div>
            </Surface>
          </Reveal>
        ))}
      </div>
    </LandingSection>
  )
}

function ReasonIcon({ icon: Icon }: { icon: typeof Palette }) {
  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-glyph)] bg-accent-soft text-ink ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-accent-strong)_35%,transparent)]"
    >
      <Icon size={18} strokeWidth={2} />
    </span>
  )
}
