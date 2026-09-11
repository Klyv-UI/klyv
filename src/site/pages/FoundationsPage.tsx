import { Bell, Home, Music } from 'lucide-react'
import { Avatar, Badge, Button, IconButton, IconTile, StatusDot, Surface, Text } from 'citrine'
import { Code, Note, Preview, Specimen, Step } from '../components/Doc'
import { PageIntro } from '../components/PageIntro'

/**
 * The rules behind the tokens: how the design stacks surfaces, ranks text,
 * spends its one accent colour, and handles focus. Numbered, because they
 * build on each other and are meant to be read in order.
 */
export default function FoundationsPage() {
  return (
    <article className="flex flex-col gap-12">
      <PageIntro
        eyebrow="Design system"
        title="Foundations"
        stats={[
          { value: '6', label: 'rules' },
          { value: '4', label: 'elevations' },
          { value: '3', label: 'inks' },
          { value: '1', label: 'accent' },
        ]}
      >
        Six rules the whole library obeys. They explain why the tokens are shaped the way they are, and they are the
        reason a new component almost never needs a new value.
      </PageIntro>

      <div className="flex flex-col gap-10">
        <Step
          number={1}
          title="Surfaces stack, they do not tint"
          description="Five planes, from the page behind the window to the tiles nested inside a card. Depth comes from the stack order and a hairline, not from shadow."
        >
          <Preview background="canvas" className="p-8">
            <div className="w-full rounded-[var(--radius-window)] bg-app p-5 shadow-[var(--shadow-window)]">
              <Text size="caption" weight="semibold" tone="faint" className="mb-3">
                app — content area inside the window
              </Text>
              <Surface variant="card" padding="lg" className="gap-3">
                <Text size="heading">surface — a card</Text>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Surface variant="tile" padding="sm">
                    <Text size="caption" weight="semibold" tone="soft">
                      tile — bordered, nested
                    </Text>
                  </Surface>
                  <Surface variant="field" padding="md">
                    <Text size="caption" weight="semibold" tone="soft">
                      field — filled input
                    </Text>
                  </Surface>
                </div>
                <Surface variant="sunken" padding="sm">
                  <Text size="caption" weight="semibold" tone="soft">
                    sunken — read-only row
                  </Text>
                </Surface>
              </Surface>
            </div>
          </Preview>
          <Note>
            Only four elevations exist. Everything else separates with a <Code>line</Code> hairline, which is why cards
            can sit 16px apart without the page feeling noisy.
          </Note>
        </Step>

        <Step
          number={2}
          title="Three inks, always in the same order"
          description="Primary carries the value, secondary the label, tertiary the meta. A row never uses two inks of the same rank."
        >
          <Preview>
            <Specimen label="ink" hint="Values, headings, row titles">
              <Text size="stat">$27,829.83</Text>
            </Specimen>
            <Specimen label="ink-soft" hint="Secondary text, inactive nav">
              <Text size="stat" weight="medium" tone="soft">
                Inactive item
              </Text>
            </Specimen>
            <Specimen label="ink-faint" hint="Captions, meta, placeholders">
              <Text size="stat" weight="medium" tone="faint">
                Monthly Plan
              </Text>
            </Specimen>
          </Preview>
        </Step>

        <Step
          number={3}
          title="One accent, spent sparingly"
          description="The accent marks exactly one thing per region: the current page, the primary action, the earned part of a meter. Status colours exist but the design barely uses them."
        >
          <Preview>
            <Specimen label="Primary action">
              <Button>Send</Button>
            </Specimen>
            <Specimen label="Current page">
              <span className="rounded-full bg-accent px-3.5 py-2 text-[13px] font-bold leading-none text-accent-ink">
                Overview
              </span>
            </Specimen>
            <Specimen label="Qualifier">
              <Badge>+10%</Badge>
            </Specimen>
            <Specimen label="Unread">
              <span className="relative inline-flex">
                <IconButton icon={Bell} label="Notifications" />
                <StatusDot ring className="absolute right-2 top-2" />
              </span>
            </Specimen>
            <Specimen label="Selected">
              <IconTile icon={Music} tone="accent" />
            </Specimen>
          </Preview>
        </Step>

        <Step
          number={4}
          title="Radius grows with the container"
          description="A 12px glyph sits inside a 14px tile, inside a 20px card, inside a 32px window. Nesting a larger radius inside a smaller one never happens."
        >
          <Preview background="app">
            <div className="rounded-[var(--radius-window)] border border-line bg-surface p-4">
              <div className="rounded-[var(--radius-card)] bg-app p-4">
                <div className="rounded-[var(--radius-tile)] bg-surface-muted p-4">
                  <div className="rounded-[var(--radius-glyph)] bg-accent p-4">
                    <Text size="caption" weight="bold" tone="accent-ink">
                      12
                    </Text>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {[
                ['window', '32px', 'App frame'],
                ['card', '20px', 'Cards'],
                ['tile', '14px', 'Nested tiles, menus'],
                ['glyph', '12px', 'Icon plates, rate rows'],
              ].map(([name, value, usage]) => (
                <div key={name} className="flex items-baseline gap-3">
                  <Code>{name}</Code>
                  <span className="font-mono text-[11px] font-semibold text-ink-soft">{value}</span>
                  <Text size="caption" weight="medium" tone="faint">
                    {usage}
                  </Text>
                </div>
              ))}
            </div>
          </Preview>
        </Step>

        <Step
          number={5}
          title="Interaction is a colour change"
          description="Hover shifts one step along the same ramp — accent to accent-strong, line to line-strong, transparent to surface-muted. Nothing moves, scales or lifts."
        >
          <Preview stack>
            <div className="flex flex-wrap items-center gap-5">
              <Specimen label="accent → accent-strong">
                <div className="flex gap-2">
                  <Button>Rest</Button>
                  <Button className="bg-accent-strong">Hover</Button>
                </div>
              </Specimen>
              <Specimen label="line → line-strong">
                <div className="flex gap-2">
                  <Surface variant="tile" padding="sm">
                    <Text size="caption" weight="semibold" tone="soft">
                      Rest
                    </Text>
                  </Surface>
                  <Surface variant="tile" padding="sm" className="border-line-strong">
                    <Text size="caption" weight="semibold" tone="soft">
                      Hover
                    </Text>
                  </Surface>
                </div>
              </Specimen>
              <Specimen label="Live" hint="Hover or tab to these">
                <div className="flex gap-2">
                  <Button variant="outline">Withdraw</Button>
                  <IconButton icon={Home} label="Home" tone="plain" shape="square" />
                </div>
              </Specimen>
            </div>
          </Preview>
        </Step>

        <Step
          number={6}
          title="Focus is global and visible"
          description="A single base rule gives every focusable element a 2px accent-strong outline offset by 2px. Components never remove it and never reimplement it."
        >
          <Preview>
            <Specimen label="Tab through these" hint="Focus rings are not shown on click, only on keyboard focus">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Send</Button>
                <Button variant="outline">Withdraw</Button>
                <IconButton icon={Bell} label="Notifications" tone="white" />
                <Avatar name="Daniel Vance" size="md" ring />
              </div>
            </Specimen>
          </Preview>
          <Note>
            Icon-only controls take a required <Code>label</Code>, which becomes both the accessible name and the
            tooltip. There is no way to render one without a name.
          </Note>
        </Step>
      </div>
    </article>
  )
}
