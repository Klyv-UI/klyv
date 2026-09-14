import { CountUp, Text } from 'citrine'
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
 *
 * The counts run up once, with the library's own CountUp, when the strip comes
 * into view; under reduced motion they simply read their value.
 */
export function Proof() {
  const facts: { value: number | string; label: string }[] = [
    { value: componentCount, label: 'components' },
    { value: blockCount, label: 'production screens' },
    { value: templates.length, label: 'product templates' },
    { value: integrations.length, label: 'integrations' },
    { value: '4.5:1', label: 'contrast on any accent' },
    { value: mcpTools.length, label: 'MCP tools for agents' },
  ]

  return (
    // The strip's own ground matches its cells, so the row reads as one band
    // edge to edge — a shade lighter than the hero, so the two separate.
    <section aria-label="At a glance" className="border-b border-line bg-[color-mix(in_oklab,var(--color-surface)_45%,var(--color-canvas))]">
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
                {typeof fact.value === 'number' ? <CountUp value={fact.value} duration={1100} /> : fact.value}
              </Text>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
