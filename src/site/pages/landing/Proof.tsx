import { Text } from 'klyv'
import { blockCount } from '../../data/blocks'
import { componentCount } from '../../data/catalog'
import { integrations } from '../../data/integrations'
import { mcpTools } from '../../data/mcp'
import { templates } from '../../data/templates'

/**
 * The numbers, straight after the hero.
 *
 * Every figure is derived — from the catalogue, the block list, the generated
 * MCP definitions, or the contrast guarantee in the accent maths — so none of
 * them can quietly go stale. There are no borrowed logos, because there are
 * none to borrow.
 *
 * They are printed, not counted up: the strip sits below the workbench, and a
 * count that waits to be scrolled into view read as a row of zeros to anyone
 * who arrived by anchor, print or preview.
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
    // The strip's own ground matches its cells, so the row reads as one band
    // edge to edge — a shade lighter than the hero, so the two separate.
    <section aria-label="At a glance" className="border-y border-line bg-[color-mix(in_oklab,var(--color-surface)_45%,var(--color-canvas))]">
      {/* A one-pixel gap over a line-coloured ground draws the hairlines, so the
          dividers stay right at every column count. */}
      <dl className="mx-auto grid w-full max-w-[1400px] grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-col gap-1.5 bg-[color-mix(in_oklab,var(--color-surface)_45%,var(--color-canvas))] px-5 py-6 sm:py-7 lg:px-8"
          >
            <dt className="order-2">
              <Text as="span" size="label" weight="semibold" tone="faint">
                {fact.label}
              </Text>
            </dt>
            <dd className="order-1">
              <Text as="span" size="title" tabular className="text-[28px] tracking-[-0.045em] sm:text-[32px]">
                {fact.value}
              </Text>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
