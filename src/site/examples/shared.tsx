import { Badge, Surface, Text } from 'klyv'
import type { ExampleSection } from './types'

/**
 * The two blocks every component page ends with.
 *
 * They are shared rather than repeated per module because the whole argument
 * for this set is that each component is assembled from the levels below it —
 * and that claim is only checkable if every page states it the same way.
 */

export function BuiltFrom({ parts }: { parts: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Text as="span" size="caption" weight="semibold" tone="faint">
        Built from
      </Text>
      {parts.map((part) => (
        <Badge key={part} tone="neutral">
          {part}
        </Badge>
      ))}
    </div>
  )
}

/** Problem / why / where, plus the parts list. */
export function rationale(
  problem: string,
  why: string,
  where: string,
  parts: string[],
): ExampleSection {
  return {
    title: 'Why it exists',
    bare: true,
    Content: () => (
      <div className="flex w-full flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ['Problem it solves', problem],
            ['Why it was chosen', why],
            ['Where it fits', where],
          ].map(([heading, copy]) => (
            <Surface key={heading} variant="tile" padding="md" className="gap-1.5">
              <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
                {heading}
              </Text>
              <Text size="caption" weight="medium" tone="soft" leading="normal">
                {copy}
              </Text>
            </Surface>
          ))}
        </div>
        <BuiltFrom parts={parts} />
      </div>
    ),
  }
}

/** The reduced-motion promise, stated once per page that makes it. */
export function motionNote(fallback: string): ExampleSection['note'] {
  return (
    <>
      <strong className="font-bold text-ink">Reduced motion:</strong> {fallback}
    </>
  )
}
