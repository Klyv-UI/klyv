import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChefHat, Compass, PanelsTopLeft, Plug, Search, WandSparkles } from 'lucide-react'
import { Button, CodeBlock, IconTile, Kbd, Reveal, StatusDot, Surface, Tag, Text, cn } from 'citrine'
import { brand } from '../../brand'
import { STATUS_LABELS, healthOf } from '../../data/health'
import { integrations } from '../../data/integrations'
import { recipes } from '../../data/recipes'
import { showcase } from '../../data/showcase'
import { templates } from '../../data/templates'
import { LandingSection, SectionLink } from './primitives'

/**
 * What comes with the components, as one bento — the Composer large, because
 * it is the new way to use everything else, and the rest sized by how much
 * they have to show. Each tile holds something real: the code the Composer
 * writes, a button that opens search, the integrations themselves, a
 * component's actual health.
 */
const COMPOSER_SAMPLE = `import { Button, Card, Field, Input } from '${brand.pkg}'

export default function Screen() {
  return (
    <Card title="Invite a teammate">
      <Field label="Email">
        <Input type="email" />
      </Field>
      <Button fullWidth>Send invite</Button>
    </Card>
  )
}`

/** The search palette listens for the shortcut on the window; this presses it. */
const openSearch = () =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }))

export function Platform() {
  const health = healthOf('DataTable')

  return (
    <LandingSection
      id="platform"
      eyebrow="The platform"
      index={4}
      title="Everything between an idea"
      tail="and a production screen"
      lede="The components are the start. Around them: a Composer, search that understands what you mean, recommendations, starters, recipes and setup guides — all built from the same system and the same data."
      band
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
        <Tile className="md:col-span-2 lg:col-span-4 lg:row-span-2">
          <div className="grid h-full gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="flex flex-col gap-4">
              <IconTile icon={WandSparkles} tone="accent" />
              <div className="flex flex-col gap-2">
                <Text as="h3" size="subtitle">
                  Composer
                </Text>
                <Text size="body" weight="medium" tone="soft" leading="normal">
                  Drag real components and blocks onto a canvas, edit the props that matter, undo anything, and
                  preview at desktop, tablet and phone widths. Then take the code — imports, install commands and
                  every dependency included.
                </Text>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3">
                <Button as={Link} to="/composer" size="sm">
                  Open the Composer
                </Button>
                <SectionLink to="/blocks">Or start from a block</SectionLink>
              </div>
            </div>
            <div className="min-w-0 [&_pre]:text-[12px]">
              <CodeBlock language="tsx" code={COMPOSER_SAMPLE} copyable={false} />
              <Text size="caption" tone="faint" className="mt-2">
                What the Composer writes for an invite card.
              </Text>
            </div>
          </div>
        </Tile>

        <Tile className="lg:col-span-2" delay={60}>
          <TileHead icon={Search} title="Search that understands you" />
          <Text size="body" weight="medium" tone="soft" className="leading-relaxed">
            One palette over components, screens, recipes, tokens, docs and releases. It ranks, forgives a typo, and
            knows that “login” means authentication.
          </Text>
          <div className="mt-auto flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
            <Button size="sm" variant="outline" onClick={openSearch}>
              Try it
            </Button>
          </div>
        </Tile>

        <Tile className="lg:col-span-2" delay={120}>
          <TileHead icon={Compass} title="Find My UI" />
          <Text size="body" weight="medium" tone="soft" className="leading-relaxed">
            Say what you are building and what it needs. Get the components, screens, templates and recipes that fit —
            each with the reason it was picked.
          </Text>
          <SectionLink to="/find" className="mt-auto">
            Answer two questions
          </SectionLink>
        </Tile>

        <Tile className="lg:col-span-2" delay={60}>
          <TileHead icon={PanelsTopLeft} title="Starters and recipes" />
          <Text size="body" weight="medium" tone="soft" className="leading-relaxed">
            {templates.length} templates — sets of screens that make a product together — and {recipes.length} recipes
            that walk through building a login flow, a billing page or a data view.
          </Text>
          <ul aria-label="Templates" className="flex flex-wrap gap-1.5">
            {templates.map((template) => (
              <li key={template.slug}>
                <Tag size="sm">{template.name}</Tag>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1">
            <SectionLink to="/templates">Templates</SectionLink>
            <SectionLink to="/recipes">
              <ChefHat size={12} aria-hidden className="mr-0.5" />
              Recipes
            </SectionLink>
          </div>
        </Tile>

        <Tile className="lg:col-span-2" delay={120}>
          <TileHead icon={Plug} title="Fits your stack" />
          <ul aria-label="Integrations" className="grid grid-cols-4 gap-1.5">
            {integrations.slice(0, 8).map((integration) => (
              <li key={integration.slug}>
                <Link
                  to={`/integrations/${integration.slug}`}
                  title={integration.name}
                  className="grid h-10 place-items-center rounded-[var(--radius-glyph)] border border-line bg-surface text-[11px] font-extrabold tracking-[-0.02em] text-ink transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-line-strong hover:shadow-[var(--shadow-tile)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span aria-hidden>{integration.monogram}</span>
                  <span className="sr-only">{integration.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <SectionLink to="/integrations" className="mt-auto">
            All {integrations.length}, with honest statuses
          </SectionLink>
        </Tile>

        <Tile className="lg:col-span-2" delay={180}>
          <TileHead icon={Check} title="Health you can check" />
          {health && (
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5">
                <StatusDot tone="success" />
                <Text as="span" size="caption" weight="bold">
                  DataTable · {STATUS_LABELS[health.status]}
                </Text>
              </span>
              <ul aria-label="DataTable capabilities" className="flex flex-wrap gap-x-3 gap-y-1">
                {health.capabilities.map((capability) => (
                  <li key={capability.id} className="inline-flex items-center gap-1">
                    <Check size={12} strokeWidth={2.5} aria-hidden className="text-ink-faint" />
                    <Text as="span" size="caption" tone="soft">
                      {capability.label}
                    </Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Text size="label" tone="faint" leading="normal">
            Only what is measured is shown. A test fails if a claim appears without evidence.
          </Text>
          <SectionLink to="/components/data-table" className="mt-auto">
            See the evidence
          </SectionLink>
        </Tile>
      </div>

      <Reveal>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Text as="span" size="caption" tone="faint">
            Also:
          </Text>
          <SectionLink to="/built-with">Built With — {showcase.length} live projects</SectionLink>
          <SectionLink to="/changelog">The changelog, commit by commit</SectionLink>
          <SectionLink to="/agents">MCP server and Agent Skill</SectionLink>
        </div>
      </Reveal>
    </LandingSection>
  )
}

function Tile({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={cn('flex', className)}>
      <Surface variant="card" padding="lg" className="landing-card w-full gap-3.5 p-6">
        {children}
      </Surface>
    </Reveal>
  )
}

function TileHead({ icon, title }: { icon: typeof Search; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={icon} tone="muted" size="sm" />
      <Text as="h3" size="heading" className="text-[16px]">
        {title}
      </Text>
    </div>
  )
}
