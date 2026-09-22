import { CodeBlock, Surface, Text } from 'klyvui'
import { Code, Note, Section } from '../components/Doc'
import { PageIntro } from '../components/PageIntro'
import { brand } from '../brand'
import { groups } from '../data/groups'
import { mcpFacts, mcpResources, mcpTools } from '../data/mcp'

/**
 * How an AI coding agent connects to the library.
 *
 * The tool table is generated from the server's own definitions rather than
 * written here, so a tool added to `mcp/server.mjs` documents itself and this
 * page can never describe a server that no longer exists.
 */
export default function AgentsPage() {
  return (
    <article className="flex flex-col gap-12">
      <PageIntro
        eyebrow="Developer"
        title="For AI agents"
        stats={[
          { value: mcpFacts.components, label: 'components' },
          { value: groups.length, label: 'groups' },
          { value: mcpFacts.props, label: 'documented props' },
          { value: mcpFacts.tokens, label: 'tokens' },
          { value: mcpTools.length, label: 'MCP tools' },
        ]}
      >
        An agent writing UI with {brand.name} should not have to guess a prop name or invent a colour. Connect it over
        MCP, or hand it the skill file, and it reads the catalogue, the real types and the tokens — the same data this
        site is built from.
      </PageIntro>

      <Section title="Connect the MCP server" description="It ships inside the package, so there is nothing extra to install.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Surface variant="card" padding="lg" className="gap-3">
            <Text as="h3" size="heading">
              Claude Code
            </Text>
            <CodeBlock language="bash" code={CLAUDE_CODE} highlight={false} />
            <Text size="caption" tone="soft" leading="normal">
              One command. The server starts on demand over stdio.
            </Text>
          </Surface>
          <Surface variant="card" padding="lg" className="gap-3">
            <Text as="h3" size="heading">
              Anything that reads mcp.json
            </Text>
            <CodeBlock language="json" code={MCP_JSON} />
            <Text size="caption" tone="soft" leading="normal">
              Already installed? Point at the local copy and skip the fetch:{' '}
              <Code>node ./node_modules/{brand.pkg}/mcp/server.mjs</Code>.
            </Text>
          </Surface>
        </div>
      </Section>

      <Section title="Tools" description="Generated from the server's own definitions, so this table and the server cannot disagree.">
        <Surface variant="card" className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {['Tool', 'Takes', 'What it answers'].map((heading) => (
                  <th key={heading} className="px-4 py-3">
                    <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
                      {heading}
                    </Text>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mcpTools.map((tool) => (
                <tr key={tool.name} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3">
                    <Code>{tool.name}</Code>
                  </td>
                  <td className="px-4 py-3">
                    {tool.args.length === 0 ? (
                      <Text size="caption" tone="faint">
                        —
                      </Text>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {tool.args.map((arg) => (
                          <span key={arg.name} className="font-mono text-[11px] font-medium text-ink-soft">
                            {arg.name}
                            {arg.required ? '' : '?'}: {arg.type}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Text size="caption" weight="medium" tone="soft" leading="normal">
                      {tool.description}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
        <Note>
          Names are forgiving. <Code>DataTable</Code>, <Code>data-table</Code> and <Code>datatable</Code> all resolve to
          the same component, and a miss comes back with near matches rather than an error.
        </Note>
      </Section>

      <Section title="Resources" description="The same knowledge as attachable documents, for clients that prefer them to tool calls.">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {mcpResources.map((resource) => (
            <Surface key={resource.uri} variant="tile" padding="md" className="gap-1.5 bg-surface">
              <span className="font-mono text-[11.5px] font-semibold text-ink">{resource.uri}</span>
              <Text size="caption" weight="medium" tone="soft" leading="normal">
                {resource.description}
              </Text>
            </Surface>
          ))}
        </div>
      </Section>

      <Section title="The Agent Skill" description="For harnesses that load skills instead of connecting a server.">
        <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[72ch]">
          <Code>skills/{brand.pkg}/SKILL.md</Code> ships in the package and carries the same guidance in one file: find
          the component before inventing one, read its real props, never invent a colour, plus the theming API and the
          mistakes that come up most. It works alongside the MCP server or on its own.
        </Text>
        <Note>
          Every prop claim in the skill was checked against the generated types rather than written from memory — a
          skill that confidently names a prop that does not exist is worse than no skill at all.
        </Note>
      </Section>

      <Section title="Without a harness" description="The same facts are on disk, so any tool can read them.">
        <CodeBlock language="bash" code={CLI} highlight={false} />
        <Text size="caption" tone="soft" leading="normal" className="max-w-[72ch]">
          And the generated bundle ships as plain JSON: <Code>data/components.json</Code>, <Code>data/props.json</Code>,{' '}
          <Code>data/aria.json</Code>, <Code>data/sizes.json</Code> and <Code>data/tokens.json</Code> — the last in W3C
          Design Tokens format. The CLI, the MCP server and this site all read them, which is why none of the three can
          drift.
        </Text>
      </Section>
    </article>
  )
}

const CLAUDE_CODE = `claude mcp add ${brand.pkg} -- npx -y ${brand.pkg} mcp`

const MCP_JSON = `{
  "mcpServers": {
    "${brand.pkg}": {
      "command": "npx",
      "args": ["-y", "${brand.pkg}", "mcp"]
    }
  }
}`

const CLI = `npx ${brand.pkg} list chart     # search the catalogue
npx ${brand.pkg} info combobox   # what it brings with it
npx ${brand.pkg} add data-table  # copy the source, dependencies included`
