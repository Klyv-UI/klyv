import { Text } from 'citrine'
import { blockCount } from '../../data/blocks'
import { componentCount } from '../../data/catalog'
import { integrations } from '../../data/integrations'
import { mcpTools } from '../../data/mcp'
import { templates } from '../../data/templates'

/**
 * The numbers, straight after the pitch.
 *
 * Every figure is derived — from the catalogue, the block list, the generated
 * MCP definitions, or the contrast guarantee in the accent maths — so none of
 * them can quietly go stale. There are no borrowed logos, because there are
 * none to borrow.
 */
export function Proof() {
  const facts = [
    { value: String(componentCount), label: 'components' },
    { value: String(blockCount), label: 'production screens' },
    { value: String(templates.length), label: 'product templates' },
    { value: String(integrations.length), label: 'integrations' },
    { value: '4.5:1', label: 'contrast on any accent' },
    { value: String(mcpTools.length), label: 'MCP tools for agents' },
  ]

  return (
    <section aria-label="At a glance" className="border-b border-line">
      {/* A one-pixel gap over a line-coloured ground draws the hairlines, so the
          dividers stay right at every column count. */}
      <dl className="mx-auto grid w-full max-w-[1400px] grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-1 bg-canvas px-5 py-6 lg:px-8">
            <dt className="order-2">
              <Text as="span" size="caption" weight="semibold" tone="faint">
                {fact.label}
              </Text>
            </dt>
            <dd className="order-1">
              <Text as="span" size="title" tabular className="tracking-[-0.03em]">
                {fact.value}
              </Text>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
