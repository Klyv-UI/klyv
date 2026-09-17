import { SkipLink, Surface, Text, Wordmark } from 'klyv'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'

export default function SkipLinkPage() {
  return (
    <DocPage
      name="SkipLink"
      description="The first thing in the tab order: a link that lets a keyboard user jump past the navigation straight to the content. It is invisible until it receives focus, then it appears over the header — the one component in the library whose default state is to not be seen."
      propNotes={[
            {
              name: 'target',
              type: 'string',
              description:
                'Id of the landmark to jump to, without the hash. That element needs tabIndex={-1}.',
            },
            {
              name: 'children',
              type: 'ReactNode',
              defaultValue: "'Skip to content'",
              description: 'Link text. Say where it goes, not just “skip”.',
            },
            {
              name: '…props',
              type: 'AnchorHTMLAttributes<HTMLAnchorElement>',
              description: 'Everything a native anchor takes, except href.',
            },
          ]}
    >
      <Section
        title="Default"
        description="Click into the frame below and press Tab. The link appears at the top-left of the demo, then disappears when focus moves on."
      >
        <Preview>
          <div className="relative w-full overflow-hidden rounded-[var(--radius-tile)] border border-line bg-app">
            <SkipLink target="skiplink-demo-main" className="focus-visible:absolute" />
            <div className="flex items-center gap-4 px-4 py-3">
              <Wordmark name="Klyv" size="sm" />
              <nav aria-label="Demo" className="ml-auto flex gap-3">
                {['Overview', 'Activity', 'Manage'].map((item) => (
                  <a
                    key={item}
                    href="#skiplink-demo-main"
                    className="text-[12px] font-medium text-ink-soft hover:text-ink"
                  >
                    {item}
                  </a>
                ))}
              </nav>
            </div>
            <div
              id="skiplink-demo-main"
              tabIndex={-1}
              className="border-t border-line bg-surface px-4 py-6"
            >
              <Text size="caption" weight="semibold" tone="soft">
                Main content — the skip link lands here
              </Text>
            </div>
          </div>
        </Preview>
        <Note>
          The demo pins the link with <Code>focus-visible:absolute</Code> so it stays inside the
          frame. In a real page it uses <Code>position: fixed</Code> and appears at the top-left of
          the viewport.
        </Note>
      </Section>

      <Section
        title="States"
        description="Two, and only two. It is in the accessibility tree at all times so a screen reader can find it; it becomes visible only on keyboard focus."
      >
        <Preview stack>
          <Specimen label="resting" hint="sr-only — present but not painted" fill>
            <div className="flex items-center gap-3">
              <span className="inline-block h-10 w-px bg-line-strong" aria-hidden="true" />
              <Text size="caption" tone="faint">
                Nothing is rendered here; the element occupies no space.
              </Text>
            </div>
          </Specimen>
          <Specimen label="focused" hint="What it looks like when it appears" fill>
            <span className="inline-flex h-10 items-center rounded-full bg-surface px-4 text-[13px] font-bold leading-none text-ink shadow-[var(--shadow-float)]">
              Skip to content
            </span>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="Placement"
        description="It has to be the first focusable element in the document, or a user has already tabbed through the navigation before reaching it."
      >
        <Preview>
          <Surface variant="sunken" padding="md" className="w-full gap-2">
            <Text size="caption" weight="bold" tone="soft">
              Correct
            </Text>
            <Text size="caption" weight="medium" tone="faint" leading="normal">
              First child of the layout, before the header. The target is the main landmark, which
              needs <Code>tabIndex={-1}</Code> so focus can actually move to it after the jump.
            </Text>
          </Surface>
          <Surface variant="sunken" padding="md" className="w-full gap-2">
            <Text size="caption" weight="bold" tone="soft">
              Incorrect
            </Text>
            <Text size="caption" weight="medium" tone="faint" leading="normal">
              Anywhere after the navigation, or pointing at an id that does not exist. Both make the
              link worse than useless — it consumes a tab stop and delivers nothing.
            </Text>
          </Surface>
        </Preview>
      </Section>

      <Section title="Examples" description="How it sits in an application layout.">
        <Preview>
          <Surface variant="sunken" padding="md" className="w-full">
            <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-ink-soft">
{`<div className="min-h-dvh">
  <SkipLink target="main-content" />
  <AppHeader />
  <main id="main-content" tabIndex={-1}>
    …
  </main>
</div>`}
            </pre>
          </Surface>
        </Preview>
      </Section>
    </DocPage>
  )
}
