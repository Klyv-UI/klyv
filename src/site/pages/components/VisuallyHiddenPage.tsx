import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Avatar, Button, Surface, Text, VisuallyHidden } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'

export default function VisuallyHiddenPage() {
  const [visible, setVisible] = useState(true)

  return (
    <DocPage
      name="VisuallyHidden"
      description="Text that is removed from the screen but kept in the accessibility tree. It is the mechanism behind Avatar's full name and behind every place the design shows a glyph or an abbreviation where a screen reader needs a sentence."
      propNotes={[
            {
              name: 'children',
              type: 'ReactNode',
              description: 'Text exposed to assistive technology only.',
            },
          ]}
      apiNote={
        <>
          Renders a <Code>&lt;span&gt;</Code> with the <Code>sr-only</Code> utility — clipped to a
          single pixel rather than <Code>display: none</Code>, which would remove it from the
          accessibility tree as well.
        </>
      }
    >
      <Section
        title="Default"
        description="There is nothing to see — that is the point. The card below contains hidden text; reveal it with the toggle."
      >
        <Preview stack>
          <Surface variant="sunken" padding="md" className="w-full max-w-[420px] gap-2">
            <Text size="body">
              Balance{visible ? <VisuallyHidden> for account ending 5199</VisuallyHidden> : null}:
              $27,829.83
            </Text>
            <Text size="caption" weight="medium" tone="faint" leading="normal">
              {visible
                ? 'A screen reader reads “Balance for account ending 5199: $27,829.83”. Sighted users see only the short label.'
                : 'The hidden text is removed entirely, so both audiences now get the shorter, more ambiguous label.'}
            </Text>
          </Surface>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisible((previous) => !previous)}
          >
            {visible ? 'Remove the hidden text' : 'Restore the hidden text'}
          </Button>
        </Preview>
      </Section>

      <Section
        title="Where the library uses it"
        description="Two cases: text that would be redundant on screen, and an abbreviation that would be read out letter by letter."
      >
        <Preview>
          <Specimen label="Avatar" hint="Draws “DV”, announces “Daniel Vance”">
            <Avatar name="Daniel Vance" size="md" />
          </Specimen>
          <Specimen label="StatusDot" hint="Draws a pip, announces “Unread notifications”">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-accent-strong" />
              <Text size="caption" weight="semibold" tone="soft">
                with label
              </Text>
            </span>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="Extending a visible label"
        description="The most common use: a control whose visible text is fine for a sighted user scanning a row, but ambiguous when read on its own."
      >
        <Preview stack>
          <div className="flex w-full max-w-[420px] items-center justify-between gap-3 rounded-[var(--radius-tile)] bg-surface-sunken px-4 py-3">
            <div className="min-w-0">
              <Text truncate>Recent transactions</Text>
              <Text size="caption" tone="faint">
                Announced as “View all recent transactions”
              </Text>
            </div>
            <Button variant="ghost" size="sm">
              View All
              <VisuallyHidden> recent transactions</VisuallyHidden>
            </Button>
          </div>
        </Preview>
        <Note>
          Six “View All” buttons on one page are indistinguishable in a screen reader's list of
          controls. Appending the section name fixes that without changing the design.
        </Note>
      </Section>

      <Section
        title="States"
        description="It renders or it does not. What matters is when to reach for it rather than an ARIA attribute."
      >
        <Preview stack>
          <Surface variant="tile" padding="md" className="w-full gap-2">
            <Text size="caption" weight="bold" tone="soft">
              Use VisuallyHidden
            </Text>
            <Text size="caption" weight="medium" tone="faint" leading="normal">
              When the hidden text extends visible text, or when the accessible name needs markup
              or a live update. It is real text in the DOM, so it can be translated and it
              participates in the accessible name computation.
            </Text>
          </Surface>
          <Surface variant="tile" padding="md" className="w-full gap-2">
            <Text size="caption" weight="bold" tone="soft">
              Use aria-label instead
            </Text>
            <Text size="caption" weight="medium" tone="faint" leading="normal">
              When the element has no visible text at all — that is why{' '}
              <Code>IconButton</Code> takes a required <Code>label</Code> prop rather than expecting
              a hidden child.
            </Text>
          </Surface>
        </Preview>
      </Section>

      <Section
        title="Focus behaviour"
        description="Hidden text is not focusable and does not create a tab stop, so it is safe to place inside a control."
      >
        <Preview>
          <Specimen label="Tab through" hint="Two stops, not four">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                Show
                <VisuallyHidden> account balance</VisuallyHidden>
              </Button>
              <button
                type="button"
                onClick={() => setVisible((previous) => !previous)}
                className="inline-flex size-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
              >
                {visible ? <Eye size={17} /> : <EyeOff size={17} />}
                <VisuallyHidden>
                  {visible ? 'Hide account balance' : 'Show account balance'}
                </VisuallyHidden>
              </button>
            </div>
          </Specimen>
        </Preview>
      </Section>
    </DocPage>
  )
}
