import { Home, LogOut, Settings } from 'lucide-react'
import { Divider, IconTile, Surface, Text } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'

export default function DividerPage() {
  return (
    <DocPage
      name="Divider"
      description="A hairline on the line token. The design separates almost everything with whitespace and surface changes instead, so this appears exactly once — above the drawer's footer group. It exists so that the one place needing a rule does not hard-code a border colour."
      propNotes={[
            {
              name: 'orientation',
              type: "'horizontal' | 'vertical'",
              defaultValue: "'horizontal'",
              description: 'Vertical requires a flex parent with a resolved height.',
            },
            {
              name: 'className',
              type: 'string',
              description: 'Spacing is intentionally not built in — set the margin here.',
            },
          ]}
    >
      <Section title="Default">
        <Preview stack>
          <div className="w-full max-w-[320px]">
            <Text size="caption" weight="semibold" tone="soft">
              Above
            </Text>
            <Divider className="my-3" />
            <Text size="caption" weight="semibold" tone="soft">
              Below
            </Text>
          </div>
        </Preview>
      </Section>

      <Section
        title="Orientation"
        description="Horizontal fills its container's width; vertical stretches to the height of a flex row."
      >
        <Preview>
          <Specimen label="horizontal" className="w-[220px]">
            <div className="w-full">
              <Divider />
            </div>
          </Specimen>
          <Specimen label="vertical" hint="Needs a flex parent with a height">
            <div className="flex h-10 items-center gap-4">
              <Text size="caption" weight="semibold" tone="soft">
                USD
              </Text>
              <Divider orientation="vertical" />
              <Text size="caption" weight="semibold" tone="soft">
                GBP
              </Text>
            </div>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="States"
        description="A rule is static — no interactive or emphasis states. Spacing is the caller's, because the right gap depends entirely on what it separates."
      >
        <Preview stack>
          {['my-2', 'my-4', 'my-6'].map((spacing) => (
            <Specimen key={spacing} label={spacing} fill>
              <div className="w-full max-w-[280px] rounded-[var(--radius-tile)] bg-surface-sunken px-4 py-2">
                <Text size="caption" tone="faint">
                  Section
                </Text>
                <Divider className={spacing} />
                <Text size="caption" tone="faint">
                  Section
                </Text>
              </div>
            </Specimen>
          ))}
        </Preview>
        <Note>
          Divider renders an <Code>&lt;hr&gt;</Code>, which browsers already expose as a separator,
          so no ARIA role is added. Use it for a real content break; for the visual edge of a
          container, use a <Code>Surface</Code> border instead.
        </Note>
      </Section>

      <Section title="Examples" description="The drawer footer — the design's only rule.">
        <Preview>
          <Surface variant="floating" padding="lg" className="w-full max-w-[280px] gap-4">
            <Text size="heading">Navigation</Text>
            <ul className="flex flex-col gap-1">
              {['Overview', 'Activity', 'Manage'].map((item) => (
                <li key={item}>
                  <span
                    className={`flex rounded-[10px] px-3 py-2 text-[13px] ${
                      item === 'Overview'
                        ? 'bg-accent font-bold text-accent-ink'
                        : 'font-medium text-ink-soft'
                    }`}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <Divider className="mt-2" />
            <ul className="flex flex-col gap-1.5">
              {[
                { label: 'Home', icon: Home },
                { label: 'Settings', icon: Settings },
                { label: 'Sign out', icon: LogOut },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-3">
                  <IconTile icon={item.icon} size="sm" />
                  <Text size="caption" weight="semibold" tone="soft">
                    {item.label}
                  </Text>
                </li>
              ))}
            </ul>
          </Surface>
        </Preview>
      </Section>
    </DocPage>
  )
}
