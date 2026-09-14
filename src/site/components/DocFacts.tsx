import type { ReactNode } from 'react'
import { Surface, Text } from 'citrine'
import { sizeOf } from '../data/sizes'
import { dependenciesOf } from '../data/dependencies'
import { ariaRoles } from '../data/aria'

/**
 * The three numbers worth knowing before you import something: what it weighs,
 * how many files come with it, and whether it can run on a server.
 *
 * All measured, none asserted — the weight comes from the built package over
 * the component's whole dependency set, which is what a bundler would actually
 * add.
 *
 * Its own module because the dependency graph behind it is large and sits at
 * the bottom of the page; the page renders without waiting for it.
 */
export function Facts({ name }: { name: string }) {
  const size = sizeOf(name)
  if (!size) return null

  const resolved = dependenciesOf(name)
  const brought = resolved.components.length - 1

  return (
    <Surface variant="card" padding="lg">
      <dl className="flex flex-col">
        <Fact label="Size">
          {(size.gzip / 1024).toFixed(2)} kB{' '}
          <span className="font-normal text-ink-faint">gzipped</span>
        </Fact>
        <Fact label="Brings">
          {brought === 0 ? 'nothing' : `${brought} component${brought === 1 ? '' : 's'}`}
        </Fact>
        <Fact label="Files">{resolved.files.length}</Fact>
        {ariaRoles[name] && <Fact label="Roles">{ariaRoles[name].join(', ')}</Fact>}
      </dl>
    </Surface>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt>
        <Text as="span" size="caption" weight="semibold" tone="soft">
          {label}
        </Text>
      </dt>
      <dd className="min-w-0 text-right">
        <Text as="span" size="caption" weight="bold" tabular>
          {children}
        </Text>
      </dd>
    </div>
  )
}
