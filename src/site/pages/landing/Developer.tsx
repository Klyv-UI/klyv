import { useState } from 'react'
import { Check } from 'lucide-react'
import { CodeBlock, Metric, Reveal, Surface, Tabs, Text } from 'klyvui'
import { brand } from '../../brand'
import { componentCount } from '../../data/catalog'
import { componentEvidence } from '../../data/evidence'
import { library } from '../../data/sizes'
import { LandingSection, SectionLink, kb } from './primitives'

const serverSafe = Object.values(componentEvidence).filter((entry) => entry.serverSafe).length

/**
 * The developer experience, shown rather than described: five short examples a
 * person could paste, each for one question they arrive with — how do I use
 * it, is it typed, how do I theme it, can I own the source, can my agent read
 * it. Every snippet uses only props and exports that exist.
 */
const EXAMPLES = [
  {
    value: 'use',
    label: 'Use it',
    language: 'tsx',
    code: `import { Button, Card, Field, Input } from '${brand.pkg}'
import '${brand.pkg}/styles.css'

export function Invite() {
  return (
    <Card title="Invite a teammate">
      <Field label="Email" hint="They will get a link that expires in 7 days.">
        <Input type="email" placeholder="ada@example.com" />
      </Field>
      <Button>Send invite</Button>
    </Card>
  )
}`,
  },
  {
    value: 'typed',
    label: 'Typed',
    language: 'tsx',
    code: `import { DataTable, type DataTableColumn } from '${brand.pkg}'

type Member = { id: string; name: string; seats: number }

const columns: DataTableColumn<Member>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortValue: (row) => row.name },
  { id: 'seats', header: 'Seats', cell: (row) => row.seats, sortValue: (row) => row.seats, tabular: true },
]

<DataTable label="Members" columns={columns} rows={members} rowId={(row) => row.id} selectable />`,
  },
  {
    value: 'theme',
    label: 'Theme',
    language: 'ts',
    code: `import { applyAccent, applyMode, restoreAccent, restoreMode, saveAccent } from '${brand.pkg}'

restoreAccent() // on boot: whatever the visitor last chose
restoreMode()

applyAccent('#8b5cf6') // four tokens, derived and written to the document
saveAccent('#8b5cf6')
applyMode('dark') // 'light' | 'dark' | 'system'`,
  },
  {
    value: 'source',
    label: 'Own the source',
    language: 'bash',
    code: `npx ${brand.pkg} add data-table   # the component and every file it imports
npx ${brand.pkg} add block login  # a whole screen, into src/blocks
npx ${brand.pkg} info combobox    # what it would bring with it`,
  },
  {
    value: 'agent',
    label: 'For agents',
    language: 'bash',
    code: `# Give Claude Code the real props, tokens and screens over MCP
claude mcp add ${brand.pkg} -- npx -y ${brand.pkg} mcp

# or, for anything that reads mcp.json
{ "mcpServers": { "${brand.pkg}": { "command": "npx", "args": ["-y", "${brand.pkg}", "mcp"] } } }`,
  },
] as const

type Example = (typeof EXAMPLES)[number]['value']

const FACTS = [
  'Props documented from the type — the API tables cannot drift from the code',
  'ESM, one module per component, side effects declared: import one, ship one',
  `'use client' only where it is needed — ${serverSafe} modules stay on the server`,
  'Copy the source with the CLI; relative imports resolve where they land',
  'Bring your own icons — anything with size and className fits',
]

export function Developer() {
  const [example, setExample] = useState<Example>('use')

  const weights = [
    { label: 'Median component', value: kb(library.median), caption: 'gzipped, dependencies included' },
    { label: 'Lightest', value: kb(library.lightest.gzip), caption: library.lightest.name },
    { label: 'Heaviest', value: kb(library.heaviest.gzip), caption: library.heaviest.name },
    { label: `All ${componentCount} at once`, value: kb(library.gzip), caption: 'the ceiling, not a bundle' },
  ]

  return (
    <LandingSection
      id="developers"
      index={11}
      eyebrow="Developer experience"
      title="Read the example,"
      tail="and you know how to use it"
      lede="Plain React components with typed props, a theme API that is two functions, and three ways to take the code: the package, the source, or your agent."
      action={<SectionLink to="/getting-started">Read the setup guide</SectionLink>}
      band
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
        <Reveal>
          <ul aria-label="What you get" className="flex flex-col">
            {FACTS.map((fact) => (
              <li key={fact} className="flex items-start gap-3 border-b border-line py-3.5 first:pt-0 last:border-0">
                <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                  <Check size={12} strokeWidth={3} />
                </span>
                <Text size="body" weight="medium" tone="soft" leading="normal">
                  {fact}
                </Text>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={80} className="min-w-0">
          <Surface variant="card" padding="md" className="gap-0">
            <Tabs
              label="Code examples"
              variant="underline"
              value={example}
              onValueChange={(value) => setExample(value as Example)}
              items={EXAMPLES.map((entry) => ({
                value: entry.value,
                label: entry.label,
                content: (
                  <div className="pt-4 [&_pre]:text-[12px]">
                    <CodeBlock language={entry.language} code={entry.code} highlight={entry.language !== 'bash'} />
                  </div>
                ),
              }))}
            />
          </Surface>
        </Reveal>
      </div>

      <Reveal>
        <div className="mt-10 flex flex-col gap-3">
          <Text as="h3" size="heading">
            What an import costs
          </Text>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {weights.map((tile) => (
              <Surface key={tile.label} variant="card" padding="lg">
                <Metric label={tile.label} value={tile.value} caption={tile.caption} />
              </Surface>
            ))}
          </div>
          <Text size="caption" tone="faint" leading="normal" className="max-w-[72ch]">
            Measured on the built package over each component's whole dependency set — what a bundler adds for that
            one import. The last figure is every module at once: an upper bound, not something any app ships.
          </Text>
        </div>
      </Reveal>
    </LandingSection>
  )
}
