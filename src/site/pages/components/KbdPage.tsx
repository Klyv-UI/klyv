import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input, Kbd, Surface, Text } from 'citrine'
import { Code, DocPage, Note, Preview, Section, Specimen } from '../../components/Doc'
import { Playground, TextControl } from '../../components/Playground'

const SHORTCUTS = [
  { keys: ['⌘', 'K'], action: 'Open search' },
  { keys: ['⌘', 'N'], action: 'New transfer' },
  { keys: ['G', 'O'], action: 'Go to Overview' },
  { keys: ['Esc'], action: 'Close this panel' },
]

export default function KbdPage() {
  const [key, setKey] = useState('K')

  return (
    <DocPage
      name="Kbd"
      description="A single keyboard key, for shortcut hints. It renders a real <kbd> element so the meaning is in the markup, not only in the styling, and sits on the tile shadow so a row of keys reads as physically raised without needing a border-heavy treatment."
      propNotes={[
            {
              name: 'children',
              type: 'ReactNode',
              description: 'One key. Use several Kbd elements for a chord.',
            },
            { name: 'className', type: 'string', description: 'Merged last, so it wins.' },
          ]}
    >
      <Section title="Default">
        <Preview>
          <Kbd>K</Kbd>
        </Preview>
      </Section>

      <Section
        title="Content"
        description="One key per element. The minimum width keeps single characters square while longer key names widen naturally."
      >
        <Preview>
          {['K', '⌘', '⌥', '⇧', 'Esc', 'Enter', 'Space'].map((value) => (
            <Specimen key={value} label={`"${value}"`}>
              <Kbd>{value}</Kbd>
            </Specimen>
          ))}
        </Preview>
      </Section>

      <Section
        title="Combinations"
        description="A chord is several Kbd elements with a separator between them, not one Kbd containing a plus sign — that way each key is announced separately."
      >
        <Preview stack>
          <Specimen label="modifier chord" fill>
            <span className="inline-flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Text as="span" size="caption" tone="faint">
                +
              </Text>
              <Kbd>K</Kbd>
            </span>
          </Specimen>
          <Specimen label="sequence" hint="Press one after the other" fill>
            <span className="inline-flex items-center gap-1">
              <Kbd>G</Kbd>
              <Text as="span" size="caption" tone="faint">
                then
              </Text>
              <Kbd>O</Kbd>
            </span>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="States"
        description="Kbd is static — it documents a key, it does not respond to one. There is no pressed state, because the physical key is what gets pressed."
      >
        <Preview background="app">
          <Specimen label="on surface">
            <Surface variant="tile" padding="sm" className="bg-surface">
              <Kbd>⌘</Kbd>
            </Surface>
          </Specimen>
          <Specimen label="on app">
            <Kbd>⌘</Kbd>
          </Specimen>
          <Specimen label="inline in text">
            <Text size="caption" weight="medium" tone="soft">
              Press <Kbd>Esc</Kbd> to close
            </Text>
          </Specimen>
        </Preview>
      </Section>

      <Section
        title="Examples"
        description="The two places shortcut hints appear — trailing a search field, and in a shortcut list."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Surface variant="card" padding="lg" className="items-start gap-3">
            <Text size="caption" weight="semibold" tone="faint">
              Search affordance
            </Text>
            <Input
              placeholder="Search transactions"
              aria-label="Search transactions"
              leading={<Search size={15} strokeWidth={2.25} />}
              trailing={<Kbd>⌘K</Kbd>}
              containerClassName="w-full"
            />
          </Surface>

          <Surface variant="card" padding="lg" className="gap-2">
            <Text size="caption" weight="semibold" tone="faint" className="mb-1">
              Shortcuts
            </Text>
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.action} className="flex items-center justify-between gap-3">
                <Text size="caption" weight="medium" tone="soft">
                  {shortcut.action}
                </Text>
                <span className="inline-flex items-center gap-1">
                  {shortcut.keys.map((value) => (
                    <Kbd key={value}>{value}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </Surface>
        </div>
        <Note>
          The trailing slot above is not pointer-transparent, so a <Code>Kbd</Code> there sits over
          the field. That is fine for a hint — do not put an interactive control behind it.
        </Note>
      </Section>

      <Section title="Playground">
        <Playground
          stage={
            <span className="inline-flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Text as="span" size="caption" tone="faint">
                +
              </Text>
              <Kbd>{key || 'K'}</Kbd>
            </span>
          }
          controls={<TextControl label="children" value={key} onChange={setKey} />}
        />
      </Section>
    </DocPage>
  )
}
