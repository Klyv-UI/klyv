import { Link } from 'react-router-dom'
import { Badge, Button, CodeBlock, Surface, Text } from 'citrine'
import { Code, Note, Preview, Section, Specimen } from '../components/Doc'
import { brand } from '../brand'
import { componentCount } from '../data/catalog'

/**
 * Everything a new project needs before it writes any UI.
 *
 * Ordered as the work actually happens — install, stylesheet, first component,
 * then theme — rather than as a feature list, because the reader is following
 * along rather than browsing.
 */
export default function GettingStartedPage() {
  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Text as="h1" size="title">
          Get started
        </Text>
        <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[68ch]">
          Two lines and you are running. {brand.name} ships prebuilt CSS, so there is no Tailwind to
          configure, no plugin to register and no theme file to copy before the first component
          renders.
        </Text>
      </header>

      <Section title="1 — Install" description="One package. React is a peer dependency, so bring your own.">
        <CodeBlock language="bash" code={INSTALL} highlight={false} />
        <Note>
          <Code>react</Code> and <Code>react-dom</Code> are peer dependencies — React 18.3 or 19,
          installed by you. The only runtime dependencies {brand.pkg} adds are <Code>clsx</Code> and{' '}
          <Code>tailwind-merge</Code>.
        </Note>
      </Section>

      <Section
        title="2 — Import the stylesheet"
        description="Pick one of two, depending on whether the project already runs Tailwind."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Surface variant="card" padding="lg" className="gap-3">
            <div className="flex items-center gap-2">
              <Text size="heading">No Tailwind</Text>
              <Badge>Most projects</Badge>
            </div>
            <CodeBlock language="tsx" code={`import '${brand.pkg}/styles.css'`} />
            <Text size="caption" tone="soft" leading="normal">
              Prebuilt and complete: the tokens, the base layer, the keyframes and exactly the
              utilities the library uses. About 14.7 kB gzipped. You do not need Tailwind installed.
            </Text>
          </Surface>

          <Surface variant="card" padding="lg" className="gap-3">
            <Text size="heading">Already using Tailwind</Text>
            <CodeBlock language="css" code={TAILWIND} />
            <Text size="caption" tone="soft" leading="normal">
              Import the preset instead, in your own CSS entry. The utilities are generated into
              your build rather than shipped a second time alongside it.
            </Text>
          </Surface>
        </div>

        <Surface variant="card" className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {['Export', 'What it is'].map((heading) => (
                  <th key={heading} className="px-4 py-3">
                    <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
                      {heading}
                    </Text>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXPORTS.map((row) => (
                <tr key={row.name} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Code>{row.name}</Code>
                  </td>
                  <td className="px-4 py-3">
                    <Text size="caption" weight="medium" tone="soft" leading="normal">
                      {row.what}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </Section>

      <Section title="3 — Render something" description="That is the whole setup. This is a real one.">
        <Preview>
          <Specimen label="Button" hint="Takes its colour from the accent">
            <Button>Send</Button>
          </Specimen>
          <Specimen label="Badge" hint="Same accent, quieter role">
            <Badge>+10%</Badge>
          </Specimen>
        </Preview>
        <CodeBlock language="tsx" code={FIRST} />
      </Section>

      <Section
        title="4 — Pick your accent"
        description="Four CSS custom properties are derived from one colour and written to the document. Nothing in the library hard-codes a colour, so one call repaints all of it."
      >
        <CodeBlock language="ts" code={ACCENT} />
        <Note>
          The text colour that sits on the accent is chosen by contrast, not by a lightness
          threshold, so any hue you pass stays readable. Use <Code>text-accent-ink</Code> for your
          own labels on an accent fill rather than picking black or white yourself.
        </Note>
      </Section>

      <Section
        title="5 — Dark mode"
        description="Token values change; token names never do. No component has a dark variant, and there is not a single dark: class in the library."
      >
        <CodeBlock language="ts" code={MODE} />
        <Text size="caption" tone="soft" leading="normal" className="max-w-[72ch]">
          <Code>system</Code> follows the operating system and keeps following it, so a visitor who
          changes theme at lunch does not have to reload. Call <Code>restoreMode()</Code> once as the
          app boots to re-apply whatever they last chose.
        </Text>
      </Section>

      <Section title="6 — Good to know" description="The things that usually come up next.">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {NOTES.map((note) => (
            <Surface key={note.title} variant="tile" padding="sm" className="gap-1.5">
              <Text size="caption" weight="bold">
                {note.title}
              </Text>
              <Text size="caption" weight="medium" tone="soft" leading="normal">
                {note.body}
              </Text>
            </Surface>
          ))}
        </div>
      </Section>

      <Section
        title="7 — Or copy the source instead"
        description="If you would rather own the file than depend on the package."
      >
        <CodeBlock language="bash" code={CLI} highlight={false} />
        <Text size="caption" tone="soft" leading="normal" className="max-w-[72ch]">
          The folders are flat and every internal import is relative, so copied files compile where
          they land — no rewriting and no codemod. Dependencies come with it: two thirds of the
          library imports at least one sibling, so a single file on its own would not build.
        </Text>
      </Section>

      <Section title="Where to next" description="">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {NEXT.map((item) => (
            <Link key={item.to} to={item.to} className="rounded-[var(--radius-card)]">
              <Surface variant="tile" padding="sm" interactive className="h-full gap-1.5">
                <Text size="caption" weight="bold">
                  {item.title}
                </Text>
                <Text size="caption" weight="medium" tone="soft" leading="normal">
                  {item.body}
                </Text>
              </Surface>
            </Link>
          ))}
        </div>
      </Section>
    </article>
  )
}

/* ------------------------------------------------------------------ content */

const INSTALL = `npm install ${brand.pkg}
# pnpm add ${brand.pkg}   ·   yarn add ${brand.pkg}   ·   bun add ${brand.pkg}`

const TAILWIND = `@import 'tailwindcss';
@import '${brand.pkg}/preset.css';`

const FIRST = `import { Badge, Button } from '${brand.pkg}'
import '${brand.pkg}/styles.css'

export default function App() {
  return (
    <>
      <Button>Send</Button>
      <Badge>+10%</Badge>
    </>
  )
}`

const ACCENT = `import { applyAccent, saveAccent, restoreAccent } from '${brand.pkg}'

// Once, as the app boots: re-apply whatever the visitor last chose.
restoreAccent()

// Whenever they pick a new one.
applyAccent('#8b5cf6')
saveAccent('#8b5cf6')`

const MODE = `import { applyMode, restoreMode } from '${brand.pkg}'

restoreMode()        // on boot — light, dark or system, as last saved
applyMode('dark')    // switch now
applyMode('system')  // follow the operating system, and keep following it`

const CLI = `npx ${brand.pkg} add data-table   # the component and everything it imports
npx ${brand.pkg} list drag        # search by name, group, section or description
npx ${brand.pkg} info combobox    # what it would bring with it`

const EXPORTS = [
  { name: brand.pkg, what: 'The components, cn, the token registry and the theme API.' },
  { name: `${brand.pkg}/styles.css`, what: 'The prebuilt stylesheet. No Tailwind required.' },
  { name: `${brand.pkg}/preset.css`, what: 'Tokens plus an @source, for projects already running Tailwind.' },
  { name: `${brand.pkg}/tokens.css`, what: 'The tokens on their own.' },
  { name: `${brand.pkg}/tokens.json`, what: 'The tokens as W3C Design Tokens data.' },
]

const NOTES = [
  {
    title: 'ESM only',
    body: 'One module per component with sideEffects declared, so a bundler drops everything you do not import.',
  },
  {
    title: 'Types are included',
    body: 'Written in TypeScript and shipped with declarations. Every prop table on this site is generated from those same types.',
  },
  {
    title: 'Bring your own icons',
    body: 'An icon is a structural type, not an import: anything taking size, strokeWidth and className works — Lucide, Phosphor, your own SVG.',
  },
  {
    title: 'Server components work',
    body: "Modules that can run on a server boundary do, and the rest already carry 'use client'. There is nothing to configure.",
  },
]

const NEXT = [
  {
    to: '/components',
    title: `All ${componentCount} components`,
    body: 'The catalogue, filterable by group and searchable by what a component does.',
  },
  {
    to: '/foundations',
    title: 'Foundations',
    body: 'The six rules behind the tokens, and why a new component almost never needs a new value.',
  },
  {
    to: '/tokens',
    title: 'Tokens',
    body: 'Every colour, radius, shadow and type step, read live from the page you are on.',
  },
  {
    to: '/playground',
    title: 'Playground',
    body: 'Change props on a live component and watch the code update with them.',
  },
  {
    to: '/agents',
    title: 'For AI agents',
    body: 'Connect a coding agent over MCP so it reads the real props and tokens instead of guessing.',
  },
]
