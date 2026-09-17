import { useEffect, useState } from 'react'
import { Surface, Text, resolveToken, tokenGroups, type TokenEntry, type TokenGroup } from 'klyv'
import { Code, Note, Section } from '../components/Doc'
import { AccentPicker } from '../components/AccentPicker'
import { PageIntro } from '../components/PageIntro'
import { componentCount } from '../data/catalog'

/**
 * Reads every value live from the document, so the viewer can never disagree
 * with `src/styles/tokens.css`.
 */
function useTokenValues(): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const group of tokenGroups) {
      for (const token of group.tokens) {
        next[token.cssVar] = resolveToken(token.cssVar)
      }
    }
    setValues(next)
  }, [])

  return values
}

function TokenMeta({ token, value }: { token: TokenEntry; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Text size="body" weight="bold" truncate>
        {token.name}
      </Text>
      <span className="truncate font-mono text-[11px] font-medium text-ink-soft">{value || '—'}</span>
      <Text size="caption" weight="medium" tone="faint" leading="normal">
        {token.usage}
      </Text>
    </div>
  )
}

const card = 'flex flex-col gap-3 bg-surface'

function ColorCard({ token, value }: { token: TokenEntry; value: string }) {
  return (
    <Surface variant="tile" padding="sm" interactive className={card}>
      <span className="h-14 w-full rounded-[10px] border border-line" style={{ background: `var(${token.cssVar})` }} aria-hidden="true" />
      <TokenMeta token={token} value={value} />
    </Surface>
  )
}

function RadiusCard({ token, value }: { token: TokenEntry; value: string }) {
  return (
    <Surface variant="tile" padding="sm" interactive className={card}>
      <span
        className="flex h-14 w-full items-end justify-end border-2 border-dashed border-line-strong bg-accent-soft"
        style={{ borderRadius: `var(${token.cssVar})` }}
        aria-hidden="true"
      />
      <TokenMeta token={token} value={value} />
    </Surface>
  )
}

function ShadowCard({ token, value }: { token: TokenEntry; value: string }) {
  return (
    <Surface variant="tile" padding="sm" interactive className={card}>
      <span className="flex h-20 items-center justify-center rounded-[10px] bg-app" aria-hidden="true">
        <span className="size-12 rounded-[var(--radius-tile)] bg-surface" style={{ boxShadow: `var(${token.cssVar})` }} />
      </span>
      <TokenMeta token={token} value={value} />
    </Surface>
  )
}

function MotionCard({ token, value }: { token: TokenEntry; value: string }) {
  const [on, setOn] = useState(false)
  return (
    <Surface variant="tile" padding="sm" interactive className={card}>
      <button
        type="button"
        onClick={() => setOn((previous) => !previous)}
        aria-label={`Preview ${token.name} duration`}
        className="flex h-14 items-center rounded-[10px] bg-app px-2"
      >
        <span
          className="size-8 rounded-full bg-accent-strong transition-transform"
          style={{ transitionDuration: `var(${token.cssVar})`, transform: on ? 'translateX(calc(100% + 8px))' : 'none' }}
        />
      </button>
      <TokenMeta token={token} value={value} />
    </Surface>
  )
}

function LayerCard({ token, value }: { token: TokenEntry; value: string }) {
  return (
    <Surface variant="tile" padding="sm" interactive className={card}>
      <span className="flex h-14 items-center justify-center rounded-[10px] bg-app" aria-hidden="true">
        <Text size="title" tone="faint" tabular>
          {value || '—'}
        </Text>
      </span>
      <TokenMeta token={token} value={value} />
    </Surface>
  )
}

function GroupGrid({ group, values }: { group: TokenGroup; values: Record<string, string> }) {
  const Card =
    group.kind === 'radius'
      ? RadiusCard
      : group.kind === 'shadow'
        ? ShadowCard
        : group.kind === 'motion'
          ? MotionCard
          : group.kind === 'layer'
            ? LayerCard
            : ColorCard

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {group.tokens.map((token) => (
        <Card key={token.cssVar} token={token} value={values[token.cssVar] ?? ''} />
      ))}
    </div>
  )
}

const TYPE_SPECIMENS = [
  { size: 'display', sample: '$27,829.83', usage: 'Account balance' },
  { size: 'title', sample: '$1,154.00', usage: 'Available cashback, page titles' },
  { size: 'amount', sample: '£ 369.41', usage: 'Exchange amounts' },
  { size: 'subtitle', sample: 'Page not found', usage: 'Placeholder headings' },
  { size: 'heading', sample: 'Recent transactions', usage: 'Card titles' },
  { size: 'stat', sample: '$160 /month', usage: 'Instalment figures' },
  { size: 'body', sample: 'Sarah Rosewood', usage: 'Row titles, values' },
  { size: 'label', sample: 'Your Balance', usage: 'Field labels, quiet links' },
  { size: 'caption', sample: 'Monthly Plan', usage: 'Captions, meta, hints' },
  { size: 'micro', sample: '+10%', usage: 'Badges' },
] as const

const tokenCount = tokenGroups.reduce((sum, group) => sum + group.tokens.length, 0)

/** The page's own contents, so a reader can jump straight to radius or motion. */
const JUMPS = [
  { id: 'typography', label: 'Typography' },
  { id: 'theme', label: 'Theme' },
  ...tokenGroups.map((group) => ({ id: group.id, label: group.title })),
  { id: 'spacing', label: 'Spacing' },
]

export default function TokensPage() {
  const values = useTokenValues()

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <PageIntro
          eyebrow="Design system"
          title="Design Tokens"
          stats={[
            { value: tokenCount, label: 'tokens' },
            { value: tokenGroups.length, label: 'groups' },
            { value: TYPE_SPECIMENS.length, label: 'type steps' },
            { value: 1, label: 'colour you choose' },
          ]}
        >
          Every value below is read live from the running document, so this page cannot drift from{' '}
          <Code>src/styles/tokens.css</Code>. Each token is annotated with where the design actually uses it.
        </PageIntro>
        <nav aria-label="Token groups" className="flex flex-wrap gap-1.5">
          {JUMPS.map((jump) => (
            <a
              key={jump.id}
              href={`#${jump.id}`}
              className="rounded-full bg-surface-muted px-3 py-1.5 text-[12px] font-bold text-ink-soft transition-colors hover:bg-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {jump.label}
            </a>
          ))}
        </nav>
      </div>

      <Section
        id="typography"
        title="Typography"
        description="Ten steps. Size, tracking and default line-height travel together, because the design tightens tracking as type grows."
      >
        <Surface variant="card" className="divide-y divide-line">
          {TYPE_SPECIMENS.map((specimen) => (
            <div key={specimen.size} className="flex flex-wrap items-baseline justify-between gap-4 px-5 py-4">
              <Text size={specimen.size} className="min-w-0">
                {specimen.sample}
              </Text>
              <div className="flex shrink-0 items-baseline gap-4">
                <Text size="caption" weight="medium" tone="faint">
                  {specimen.usage}
                </Text>
                <Code>size=&quot;{specimen.size}&quot;</Code>
              </div>
            </div>
          ))}
        </Surface>
        <Note>
          Weight is a separate prop. Each size carries the weight the design pairs it with most often, so{' '}
          <Code>&lt;Text size=&quot;caption&quot; /&gt;</Code> already looks right.
        </Note>
      </Section>

      <Section
        id="theme"
        title="Theme"
        description={`One hue drives every emphasis in the library. Pick another and watch all ${componentCount} components follow — nothing below is hard-coded.`}
      >
        <Surface variant="card" padding="lg">
          <AccentPicker />
        </Surface>
        <Note>
          Only <Code>--color-accent</Code> is chosen. Strong, soft and ink are derived from it — which is why a deep
          accent gets white labels and a pale one gets near-black, without anybody configuring the pair.
        </Note>
      </Section>

      {tokenGroups.map((group) => (
        <Section key={group.id} title={group.title} description={group.description} id={group.id}>
          <GroupGrid group={group} values={values} />
        </Section>
      ))}

      <Section
        id="spacing"
        title="Spacing & breakpoints"
        description="The library uses Tailwind's default 4px spacing scale unmodified, and its default breakpoints. Only the measurements below are design-specific."
      >
        <Surface variant="card" className="divide-y divide-line">
          {[
            ['Grid gutter', '16px', 'Between cards, in both directions'],
            ['Card band height', '306px', 'Each of the two card rows at xl and above'],
            ['Header height', '76px', 'Fixed, at every breakpoint'],
            ['Icon rail width', '42px', 'Left rail from lg up'],
            ['Banner height', '150px / 160px', 'Below sm / from sm up'],
            ['Content max width', '1512px', 'The design viewport'],
            ['Breakpoints', 'md 768 · lg 1024 · xl 1280', 'Drawer / rail / framed window'],
          ].map(([name, value, usage]) => (
            <div key={name} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3.5">
              <Text size="body">{name}</Text>
              <div className="flex items-baseline gap-4">
                <Text size="caption" weight="medium" tone="faint">
                  {usage}
                </Text>
                <span className="font-mono text-[11px] font-semibold text-ink-soft">{value}</span>
              </div>
            </div>
          ))}
        </Surface>
      </Section>
    </div>
  )
}
